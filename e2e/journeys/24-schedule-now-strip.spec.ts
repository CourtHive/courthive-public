import { buildPublishedTournament, todayIsoDate } from '../helpers/fixtures';
import { installApiMocks, gotoTournament } from '../helpers/routes';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

/**
 * The "Now" strip belongs to today only.
 *
 * Two fixtures, one difference: the scheduled date. Both must be asserted —
 * a spec that only checked the hidden case would pass with the strip deleted
 * outright, and one that only checked today would pass with the date gate
 * removed.
 */
test.describe('schedule "Now" strip', () => {
  test('renders on a schedule dated today', async ({ page }) => {
    const fixture = buildPublishedTournament({
      startDate: todayIsoDate(),
      completeAllMatchUps: false,
      scheduleFirstRound: true,
    });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/schedule');

    const grid = page.locator(sel.scheduleGrid);
    await expect(grid.locator('.chp-schedule-grid')).toBeVisible();
    await expect(grid.locator('.spl-active-strip')).toBeVisible();
    await expect(grid.locator('.spl-active-strip-spacer')).toContainText('Now');
    // The grid's sticky headers stick BELOW the strip on this date.
    await expect(grid.locator('.chp-schedule')).not.toHaveCSS('--chp-strip-offset', '0px');
  });

  test('is absent on any other date', async ({ page }) => {
    // The default fixture date is fixed in the past.
    const fixture = buildPublishedTournament({ completeAllMatchUps: false, scheduleFirstRound: true });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/schedule');

    const grid = page.locator(sel.scheduleGrid);
    // Control: the grid itself rendered, so "no strip" is a statement about the
    // strip and not about an empty schedule.
    await expect(grid.locator('.chp-schedule-grid')).toBeVisible();
    await expect(grid.locator('.chp-schedule-cell:not(.chp-schedule-cell--empty)').first()).toBeVisible();
    await expect(grid.locator('.spl-active-strip')).toHaveCount(0);
    // POSITIVE half of the same claim. An absence assertion alone can be
    // satisfied by a render that has not happened yet; the offset variable is
    // written by the same render that decided against the strip, so `0px` says
    // the decision was made and went the right way. (Observed once during
    // falsification: the absence assertion passing on a retry while the gate
    // was deliberately open.)
    await expect(grid.locator('.chp-schedule')).toHaveCSS('--chp-strip-offset', '0px');
  });
});
