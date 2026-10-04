import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

test.describe('tournament — events view', () => {
  test('renders the event selector and draw from /factory/eventdata', async ({ page }) => {
    const fixture = buildPublishedTournament({ eventNames: ["Women's Singles"], drawSize: 8 });
    await installApiMocks(page, fixture);

    // Deep-link straight to the Events tab.
    await gotoTournament(page, fixture, '/events');

    // The event dropdown button is labelled with the event name.
    const eventButton = page.locator(sel.eventButton);
    await expect(eventButton).toBeVisible();
    await expect(eventButton).toContainText("Women's Singles");

    // renderEvent fetches eventdata and paints the draw into #flightDisplay.
    const flight = page.locator(sel.flightDisplay);
    await expect(flight).toBeVisible();
    await expect(flight.locator('*')).not.toHaveCount(0);
  });
});
