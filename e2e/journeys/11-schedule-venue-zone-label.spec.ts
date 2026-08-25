import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { sel, tabId } from '../helpers/selectors';
import { test, expect } from '@playwright/test';

/**
 * Journey 11 — the schedule says which clock its times are on.
 *
 * Every time on this page is a bare venue wall clock: `scheduledTime` is stored
 * as `HH:MM` with no zone and rendered through untouched, so the digits are
 * already correct AT THE VENUE. Nothing is converted, and nothing should be —
 * this is deliberately NOT the conversion bug TMX had (#1362).
 *
 * What was missing is that a public schedule is read from anywhere. "09:00" is
 * right for the spectator in the building and unreadable for the one deciding
 * whether to travel or stream — the number makes no statement about which clock
 * it belongs to.
 *
 * The label's decision logic has unit coverage (`venueZoneLabelText`). What no
 * unit test can see is whether it reaches the screen, because this repo's vitest
 * has no DOM. That is what this journey is for.
 */

const VENUE_ZONE = 'America/Denver';
const ZONE_LABEL = '.chp-schedule-zone';

/** The fixture projects a real `getTournamentInfo`; set the zone on its result. */
function withVenueZone(fixture: any, localTimeZone: string) {
  fixture.tournamentInfo.tournamentInfo.localTimeZone = localTimeZone;
  return fixture;
}

test.describe('tournament schedule — venue zone label', () => {
  test('names the venue zone when the tournament carries one', async ({ page }) => {
    const fixture = withVenueZone(
      buildPublishedTournament({ completeAllMatchUps: false, scheduleFirstRound: true }),
      VENUE_ZONE,
    );
    await installApiMocks(page, fixture);

    const scheduleRequest = page.waitForRequest('**/factory/scheduledmatchUps');
    await gotoTournament(page, fixture, '/schedule');
    await expect(page.locator(tabId('Schedule'))).toBeVisible();
    await scheduleRequest;
    await expect(page.locator(sel.scheduleGrid)).toBeVisible();

    const label = page.locator(ZONE_LABEL);
    await expect(label).toBeVisible();
    await expect(label).toContainText(VENUE_ZONE);
  });

  /**
   * The load-bearing case, and the reason the label is `null` rather than a
   * fallback. Most tournaments carry no zone. An unlabelled schedule makes NO
   * claim; a guessed one ("your zone, probably") would make a false claim, since
   * the viewer's zone is precisely what these times are not in.
   *
   * Asserted after the grid is visible, so the absence is a decision the code
   * made and not a page that has not finished rendering.
   */
  test('says nothing at all when the tournament has no zone', async ({ page }) => {
    const fixture = buildPublishedTournament({ completeAllMatchUps: false, scheduleFirstRound: true });
    // Premise of the test: a future fixture default supplying a zone would
    // invert this silently rather than fail.
    expect(fixture.tournamentInfo.tournamentInfo.localTimeZone).toBeFalsy();
    await installApiMocks(page, fixture);

    const scheduleRequest = page.waitForRequest('**/factory/scheduledmatchUps');
    await gotoTournament(page, fixture, '/schedule');
    await expect(page.locator(tabId('Schedule'))).toBeVisible();
    await scheduleRequest;
    await expect(page.locator(sel.scheduleGrid)).toBeVisible();

    await expect(page.locator(ZONE_LABEL)).toHaveCount(0);
  });
});
