import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { sel, tabId } from '../helpers/selectors';
import { test, expect } from '@playwright/test';

test.describe('tournament — players view', () => {
  test('shows the Players tab and renders the roster from /factory/participants', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 8 });
    await installApiMocks(page, fixture);

    const participantsRequest = page.waitForRequest('**/factory/participants');
    await gotoTournament(page, fixture, '/participants');

    // Publishing participants surfaces the Players tab.
    await expect(page.locator(tabId('Players'))).toBeVisible();

    await participantsRequest;

    // The roster is a Tabulator table — assert it rendered at least one row.
    const table = page.locator(sel.playersTable);
    await expect(table).toBeVisible();
    await expect(table.locator('.tabulator-row').first()).toBeVisible();
  });
});
