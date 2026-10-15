import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect, type Page } from '@playwright/test';

/**
 * Track scoring by a signed-out visitor is local-only, so the visitor's device is the only place it
 * lives. A reload must bring it back exactly as it was — until the TD's official score supersedes it.
 */

test.describe.configure({ mode: 'serial' });

async function enableTrack(page: Page): Promise<void> {
  const toggle = page.locator('[data-role="live-scoring-toggle"]').first();
  await expect(toggle).toBeVisible();
  await toggle.click();
}

async function scoreGame(page: Page, matchUpId: string, sideNumber: 1 | 2): Promise<void> {
  await page
    .locator(`[data-matchup-id="${matchUpId}"] [sidenumber="${sideNumber}"] .chc-inline-scoring-clickable`)
    .first()
    .click();
}

function setScoreText(page: Page, matchUpId: string) {
  return page.locator(`[data-matchup-id="${matchUpId}"]`).first();
}

// Production serves draw STUBS and loads each draw's structures afterwards; the whole-event payload
// is the older server shape. Both must resume.
for (const lazyDraws of [true, false]) {
  test(`games scored while signed out survive a refresh (${lazyDraws ? 'lazy draws' : 'whole event'})`, async ({
    page,
  }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, completeAllMatchUps: false, scheduleFirstRound: false });
    await installApiMocks(page, fixture, { lazyDraws });
    const matchUps = fixture.eventData[fixture.eventId].eventData.drawsData[0].structures[0].roundMatchUps[1];
    const matchUpId = matchUps[0].matchUpId;

    await gotoTournament(page, fixture, '/events');
    await enableTrack(page);
    await scoreGame(page, matchUpId, 1);
    await scoreGame(page, matchUpId, 1);
    await scoreGame(page, matchUpId, 2);
    await expect(setScoreText(page, matchUpId)).toContainText('2');

    const before = await setScoreText(page, matchUpId).innerText();
    // Let the debounced IndexedDB write land before the reload.
    await page.waitForTimeout(600);
    await page.reload();

    await expect(setScoreText(page, matchUpId)).toBeVisible();
    await expect.poll(async () => setScoreText(page, matchUpId).innerText()).toBe(before);
  });
}
