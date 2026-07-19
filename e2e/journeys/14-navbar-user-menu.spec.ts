import { installApiMocks, seedHiveIDSessionInitScript } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';

/**
 * Navbar person icon. Signed in, it opens a menu offering "My CourtHive" and a
 * real "Sign out" (previously it only navigated to /me, which no-ops when already
 * there, and gave no way to log out from the navbar).
 */
const CACHED = {
  standardGivenName: 'Pat',
  standardFamilyName: 'Player',
  birthDate: '1990-01-01',
  sex: 'MALE',
  nationalityCode: 'USA',
};

test.describe('Navbar user menu', () => {
  test('signed-in person icon offers Sign out, which clears the session', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: 'person-e2e', cached: CACHED });

    await page.goto('/#/');
    await page.locator('.navbar-end .user-login').click();

    const menu = page.locator('.chp-user-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: /my courthive/i })).toBeVisible();

    await menu.getByRole('button', { name: /sign out/i }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('hiveidSession'))).toBeNull();
    // The menu closes on sign-out.
    await expect(page.locator('.chp-user-menu')).toHaveCount(0);
  });
});
