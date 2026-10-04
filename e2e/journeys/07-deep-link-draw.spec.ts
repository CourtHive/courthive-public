import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { sel } from '../helpers/selectors';
import { test, expect } from '@playwright/test';

test.describe('tournament — deep-link to a draw', () => {
  test('an /event/:eventId/draw/:drawId URL opens the events tab on that draw', async ({ page }) => {
    const fixture = buildPublishedTournament({ eventNames: ["Men's Singles"] });
    await installApiMocks(page, fixture);

    // Deep link straight to a specific event + draw.
    await gotoTournament(page, fixture, `/event/${fixture.eventId}/draw/${fixture.drawId}`);

    // The events tab is active with the deep-linked event selected and its draw painted.
    const eventButton = page.locator(sel.eventButton);
    await expect(eventButton).toBeVisible();
    await expect(eventButton).toContainText("Men's Singles");
    await expect(page.locator(sel.flightDisplay).locator('*')).not.toHaveCount(0);
  });
});
