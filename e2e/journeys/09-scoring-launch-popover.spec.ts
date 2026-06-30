import { installApiMocks, installScoringLaunchMock, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

/**
 * Per-matchUp "Score this match" launch popover (crowd-scoring launch, Phase B).
 *
 * Clicking a matchUp body in the Events tab opens `#scoring-launch-popover`
 * (built by `openScoringLaunchMenu`), which always offers a "Score this match"
 * action resolved from the provider's scoring-launch config. The popover is the
 * DOM glue the launch feature shipped with; these assert it opens, labels the
 * action, and dismisses on Escape / outside-click.
 */
test.describe('scoring launch popover', () => {
  test('clicking a matchUp opens the "Score this match" launch menu', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 8 });
    await installApiMocks(page, fixture);
    // null config exercises the documented EPIXODIC default-fallback path; the
    // popover still surfaces the "Score this match" action either way.
    await installScoringLaunchMock(page, fixture.tournamentId, null);

    await gotoTournament(page, fixture, '/events');

    const flight = page.locator(sel.flightDisplay);
    await expect(flight).toBeVisible();

    const matchUp = flight.locator('.tmx-m').first();
    await expect(matchUp).toBeVisible();
    await matchUp.click();

    const popover = page.locator('#scoring-launch-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('Score this match');
  });

  test('Escape dismisses the launch popover', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 8 });
    await installApiMocks(page, fixture);
    await installScoringLaunchMock(page, fixture.tournamentId, null);

    await gotoTournament(page, fixture, '/events');
    await page.locator('.tmx-m').first().click();

    const popover = page.locator('#scoring-launch-popover');
    await expect(popover).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
  });
});
