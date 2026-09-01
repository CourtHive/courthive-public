import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

/**
 * Participant search on the schedule grid.
 *
 * "Which court is my daughter on?" is the single most common question a public
 * schedule is asked, and until now the only way to answer it was to read every
 * cell. Matching cells are outlined and the rest dimmed — the grid keeps its
 * court/time geometry, which is the thing being scanned.
 */
function scheduledParticipantName(fixture: any): string {
  const court = (fixture.scheduleData.courtsData ?? []).find((c: any) => c.matchUps?.length);
  const matchUp = court?.matchUps?.[0];
  const participantId = matchUp?.sides?.find((side: any) => side.participantId)?.participantId;
  const name = fixture.scheduleData.mappedParticipants?.[participantId]?.participantName;
  if (!name) throw new Error('fixture has no scheduled participant name to search for');
  return name;
}

const DIMMED = '.chp-schedule-cell--dimmed';
const MATCHED = '.chp-schedule-cell--match';

test.describe('schedule participant search', () => {
  test('dims the cells that do not carry the searched participant', async ({ page }) => {
    const fixture = buildPublishedTournament({ completeAllMatchUps: false, scheduleFirstRound: true });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/schedule');

    const grid = page.locator(sel.scheduleGrid);
    const populated = grid.locator('.chp-schedule-cell[data-matchup-id]');
    // Control: more than one populated cell, or "one matched, rest dimmed"
    // would be true of a grid with a single match in it.
    expect(await populated.count()).toBeGreaterThan(1);
    await expect(grid.locator(DIMMED)).toHaveCount(0);

    await page.locator('#scheduleSearch input').fill(scheduledParticipantName(fixture));

    await expect(grid.locator(MATCHED)).toHaveCount(1);
    expect(await grid.locator(DIMMED).count()).toBeGreaterThan(0);

    await page.locator('#scheduleSearch .chp-search__clear').click();
    await expect(grid.locator(DIMMED)).toHaveCount(0);
    await expect(grid.locator(MATCHED)).toHaveCount(0);
  });

  test('says so when nothing matches', async ({ page }) => {
    const fixture = buildPublishedTournament({ completeAllMatchUps: false, scheduleFirstRound: true });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/schedule');

    await page.locator('#scheduleSearch input').fill('Nobody Whatsoever');

    await expect(page.locator(sel.scheduleGrid).locator('.chp-schedule-notice')).toBeVisible();
    await expect(page.locator(sel.scheduleGrid).locator(MATCHED)).toHaveCount(0);
  });
});
