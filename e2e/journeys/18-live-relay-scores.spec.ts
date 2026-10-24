/**
 * Journey 18 — live scores from the score-relay reach spectators
 *
 * A tracker (epixodic, or a provider's own app such as IONSport) streams each point to the score-relay, which fans it
 * out on `/live` — as it does a crowd session once a TD promotes it. courthive-public used to listen only to the
 * factory server's `/public` namespace (official changes), so a spectator saw nothing until the result was entered.
 *
 * The relay is faked at the socket (`installFakeScoreRelay`), so the app's real socket.io client receives the frames.
 * Round 1 is scheduled for today and unplayed. Verifies:
 *   - the app subscribes to the tournament on `/live`,
 *   - bracket: a frame puts the live sets + game points in the match's cell, with the renderer's LIVE pill,
 *   - a later frame updates it in place,
 *   - schedule (today): the grid cell shows LIVE beside the score, and the Now strip reads LIVE.
 */
import { buildPublishedTournament, todayIsoDate } from '../helpers/fixtures';
import { installApiMocks, gotoTournament } from '../helpers/routes';
import { installFakeScoreRelay } from '../helpers/fakeScoreRelay';
import { test, expect } from '@playwright/test';
import { tabId } from '../helpers/selectors';

test.describe('live relay scores', () => {
  test('a tracked match shows its live score in the bracket and on today’s schedule', async ({ page }) => {
    const relay = await installFakeScoreRelay(page); // before goto — see the helper
    const fixture = buildPublishedTournament({
      completeAllMatchUps: false,
      scheduleFirstRound: true,
      startDate: todayIsoDate(),
    });
    await installApiMocks(page, fixture);
    const matchUpId: string = fixture.scheduleData.dateMatchUps[0].matchUpId;

    await gotoTournament(page, fixture, `/event/${fixture.eventId}/draw/${fixture.drawId}`);
    await expect.poll(() => relay.subscribedTo(), { timeout: 10_000 }).toBe(fixture.tournamentId);

    // ── Bracket ──
    const cell = page.locator(`.tmx-m[id="${matchUpId}"]`);
    const side1 = cell.locator('.tmx-sd[sideNumber="1"] .tmx-scr');
    const side2 = cell.locator('.tmx-sd[sideNumber="2"] .tmx-scr');
    const livePill = cell.getByText('LIVE', { exact: true });
    await expect(cell).toBeVisible();
    await expect(livePill).toHaveCount(0);

    relay.sendScore({
      matchUpId,
      tournamentId: fixture.tournamentId,
      matchUpStatus: 'IN_PROGRESS',
      source: 'tracker',
      score: { sets: [{ setNumber: 1, side1Score: 4, side2Score: 3, side1PointScore: '30', side2PointScore: '15' }] },
    });
    await expect(livePill.first()).toBeVisible();
    await expect(side1).toContainText('4');
    await expect(side1).toContainText('30');
    await expect(side2).toContainText('3');
    await expect(side2).toContainText('15');

    relay.sendScore({
      matchUpId,
      tournamentId: fixture.tournamentId,
      matchUpStatus: 'IN_PROGRESS',
      source: 'crowd',
      score: { sets: [{ setNumber: 1, side1Score: 5, side2Score: 3 }] },
    });
    await expect(side1).toContainText('5');
    await expect(side1).not.toContainText('30');

    // ── Schedule (today): grid cell + Now strip ──
    await page.locator(tabId('Schedule')).click();
    const gridCell = page.locator(`.chp-schedule-cell .spl-grid-cell[data-matchup-id="${matchUpId}"]`);
    await expect(gridCell).toBeVisible({ timeout: 10_000 });
    await expect(gridCell.locator('.spl-grid-cell__score .chp-live-tag')).toHaveText('LIVE');
    await expect(gridCell).toContainText('5-3');
    const stripCell = page.locator('.spl-active-strip-cell', {
      has: page.locator(`.spl-grid-cell[data-matchup-id="${matchUpId}"]`),
    });
    await expect(stripCell.locator('.spl-active-strip-state-pill')).toHaveText('LIVE');
    await expect(stripCell.locator('.chp-live-tag')).toHaveCount(0);
  });
});
