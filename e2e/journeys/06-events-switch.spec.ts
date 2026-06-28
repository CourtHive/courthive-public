import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { sel } from '../helpers/selectors';
import { test, expect } from '@playwright/test';

const MENS = "Men's Singles";
const WOMENS = "Women's Singles";

test.describe('tournament — multi-event switch', () => {
  test('switching the event dropdown loads the other event from /factory/eventdata', async ({ page }) => {
    const fixture = buildPublishedTournament({ eventNames: [MENS, WOMENS] });
    const womens = fixture.events.find((e) => e.eventName === WOMENS);
    await installApiMocks(page, fixture);

    await gotoTournament(page, fixture, '/events');

    // Lands on the first event.
    const eventButton = page.locator(sel.eventButton);
    await expect(eventButton).toContainText(MENS);

    // Open the dropdown and pick the second event; assert its eventdata is fetched.
    const womensRequest = page.waitForRequest(
      (req) => req.url().includes('/factory/eventdata') && req.postDataJSON()?.eventId === womens.eventId,
    );
    await eventButton.click();
    await page.locator(`${sel.eventButton} .dropdown-item`, { hasText: WOMENS }).click();
    await womensRequest;

    await expect(eventButton).toContainText(WOMENS);
    await expect(page.locator(sel.flightDisplay).locator('*')).not.toHaveCount(0);
  });
});
