import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { sel, tabId } from '../helpers/selectors';
import { test, expect } from '@playwright/test';

test.describe('tournament — populated schedule', () => {
  test('renders the court grid with scheduled matchUps', async ({ page }) => {
    // Leave round-1 matchUps unplayed so they sit on the grid (not in the
    // completed bucket); scheduleFirstRound assigns them to courts/times.
    const fixture = buildPublishedTournament({ completeAllMatchUps: false, scheduleFirstRound: true });
    await installApiMocks(page, fixture);

    const scheduleRequest = page.waitForRequest('**/factory/scheduledmatchUps');
    await gotoTournament(page, fixture, '/schedule');

    await expect(page.locator(tabId('Schedule'))).toBeVisible();
    await scheduleRequest;

    const grid = page.locator(sel.scheduleGrid);
    await expect(grid).toBeVisible();
    // The court grid rendered (not the empty placeholder) with court columns
    // and at least one populated matchUp cell.
    await expect(grid.locator('.chp-schedule-placeholder')).toHaveCount(0);
    await expect(grid.locator('.chp-schedule-grid')).toBeVisible();
    await expect(grid.locator('.chp-schedule-court-header').first()).toBeVisible();
    await expect(grid.locator('.chp-schedule-cell:not(.chp-schedule-cell--empty)').first()).toBeVisible();
  });
});
