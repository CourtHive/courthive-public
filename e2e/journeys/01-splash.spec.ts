import { buildPublishedTournament } from '../helpers/fixtures';
import { installApiMocks } from '../helpers/routes';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

test.describe('splash', () => {
  test('renders the default CourtHive landing page at the root route', async ({ page }) => {
    // Splash needs no tournament data, but install mocks so the i18n + socket
    // channels are stubbed and the console stays clean.
    await installApiMocks(page, buildPublishedTournament());

    await page.goto('/#/');

    const splash = page.locator(sel.splash);
    await expect(splash).toBeVisible();
    await expect(splash.locator('h1.name')).toHaveText('CourtHive');
    await expect(splash.locator('a[href="https://courthive.com"]')).toBeVisible();
  });
});
