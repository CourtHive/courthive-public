import { installApiMocks, installScoringLaunchMock, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

/**
 * Schedule cell → popover → the matchUp in its draw (TMX parity).
 *
 * TMX's grid cells open a popover whose "View draw" action lands on the right
 * event, draw AND structure. That is the navigation the public schedule was
 * missing entirely: a viewer could read "Court 1, 09:00, Quarterfinal" and had
 * no route from there to the bracket.
 */
function firstScheduledMatchUp(fixture: any): any {
  const court = (fixture.scheduleData.courtsData ?? []).find((c: any) => c.matchUps?.length);
  const matchUp = court?.matchUps?.[0];
  if (!matchUp) throw new Error('fixture has no scheduled matchUp');
  return matchUp;
}

test.describe('schedule cell popover', () => {
  test('opens on a populated cell and offers both actions', async ({ page }) => {
    const fixture = buildPublishedTournament({ completeAllMatchUps: false, scheduleFirstRound: true });
    await installApiMocks(page, fixture);
    await installScoringLaunchMock(page, fixture.tournamentId, null);
    await gotoTournament(page, fixture, '/schedule');

    const cell = page.locator(`${sel.scheduleGrid} .chp-schedule-cell[data-matchup-id]`).first();
    await expect(cell).toBeVisible();
    await cell.click();

    const popover = page.locator('#schedule-cell-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('View in draw');
    await expect(popover).toContainText('Score this match');

    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
  });

  test('"View in draw" lands on the matchUp inside its own structure', async ({ page }) => {
    const fixture = buildPublishedTournament({ completeAllMatchUps: false, scheduleFirstRound: true });
    await installApiMocks(page, fixture);
    await installScoringLaunchMock(page, fixture.tournamentId, null);
    await gotoTournament(page, fixture, '/schedule');

    const matchUp = firstScheduledMatchUp(fixture);
    const cell = page.locator(`${sel.scheduleGrid} [data-matchup-id="${matchUp.matchUpId}"]`).first();
    await expect(cell).toBeVisible();
    await cell.click();

    await page.locator('#schedule-cell-popover').getByText('View in draw').click();

    // The route carries the full chain — event, draw AND structure — so a
    // multi-structure draw opens on the right one rather than its default.
    await expect(page).toHaveURL(
      new RegExp(`/event/${matchUp.eventId}/draw/${matchUp.drawId}/structure/${matchUp.structureId}`),
    );

    // And the match itself is on screen, in the bracket.
    // Attribute selector, not `#id`: matchUpIds are UUIDs and can begin with a
    // digit, which is not a valid CSS id selector.
    const rendered = page.locator(`${sel.flightDisplay} [id="${matchUp.matchUpId}"]`);
    await expect(rendered).toBeVisible();
  });
});
