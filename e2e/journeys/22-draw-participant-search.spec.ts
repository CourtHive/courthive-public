import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

/**
 * Participant search on the Events tab (TMX parity).
 *
 * TMX's event control bar filters the rendered structure by participant name;
 * this is the same affordance on the published bracket. The search name is read
 * out of the fixture rather than hardcoded, so a change to mocksEngine's name
 * pool cannot silently turn this into a test of nothing.
 */
function firstRoundName(fixture: any): string {
  const structure = fixture.eventData[fixture.eventId].eventData.drawsData[0].structures[0];
  const firstRound = structure.roundMatchUps['1'];
  const name = firstRound[0].sides[0].participant?.participantName;
  if (!name) throw new Error('fixture has no round-1 participant name to search for');
  return name;
}

test.describe('draw participant search', () => {
  test('filters the bracket to the searched participant, and restores on clear', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 16, completeAllMatchUps: false });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/events');

    const flight = page.locator(sel.flightDisplay);
    const matchUps = flight.locator('.tmx-m');
    // A 16 draw renders 8 + 4 + 2 + 1 matchUps. The control that matters is
    // that the unfiltered bracket is non-degenerate before anything is typed —
    // a one-card bracket would satisfy the filtered assertion by accident.
    await expect(matchUps).toHaveCount(15);

    const target = firstRoundName(fixture);
    const search = page.locator('#eventSearch input');
    await expect(search).toBeVisible();
    await search.fill(target);

    // The searched player appears once in round 1 of a 16 draw (unplayed, so no
    // later rounds carry them).
    await expect(matchUps).toHaveCount(1);
    await expect(flight).toContainText(target);

    await page.locator('#eventSearch .chp-search__clear').click();
    await expect(matchUps).toHaveCount(15);
  });

  test('a name nobody has empties the bracket rather than ignoring the search', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 8, completeAllMatchUps: false });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/events');

    const matchUps = page.locator(`${sel.flightDisplay} .tmx-m`);
    await expect(matchUps).toHaveCount(7);

    await page.locator('#eventSearch input').fill('Nobody Whatsoever');
    await expect(matchUps).toHaveCount(0);
  });
});
