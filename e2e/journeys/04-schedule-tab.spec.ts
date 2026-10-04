import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { sel, tabId } from '../helpers/selectors';
import { test, expect } from '@playwright/test';

test.describe('tournament — schedule view', () => {
  test('shows the Schedule tab and fetches /factory/scheduledmatchUps on activation', async ({ page }) => {
    const fixture = buildPublishedTournament();
    // No matchUps are scheduled to courts in the default fixture, so the
    // schedule fetch returns an empty payload and the grid shows its empty
    // state — this proves the tab is wired and the fetch fires.
    await installApiMocks(page, fixture, { scheduleData: {} });

    const scheduleRequest = page.waitForRequest('**/factory/scheduledmatchUps');
    await gotoTournament(page, fixture, '/schedule');

    // Publishing the order of play surfaces the Schedule tab.
    await expect(page.locator(tabId('Schedule'))).toBeVisible();

    await scheduleRequest;

    const grid = page.locator(sel.scheduleGrid);
    await expect(grid).toBeVisible();
    await expect(grid.locator('.chp-schedule-placeholder')).toHaveText('No scheduled matches');
  });
});
