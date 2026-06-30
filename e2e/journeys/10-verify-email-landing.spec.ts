import { installApiMocks, installVerifyEmailMock } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';

/**
 * Email-verification landing page (HiveID, Phase C) at `/#/verify-email/:token`.
 *
 * The page POSTs the token to `/auth/verify-email` and renders one of three
 * terminal messages into `#hiveid-magic`. With no HiveID session present the
 * success path lands on the "you can now sign in" message; a failed POST lands
 * on the invalid/expired message. `installApiMocks` supplies the hermetic boot
 * mocks (version + i18n manifest + socket abort) so the app stays on bundled
 * English; the tournament fixture itself is unused by this route.
 */
test.describe('verify-email landing', () => {
  test('a valid token (signed out) reports verified + prompts sign-in', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await installVerifyEmailMock(page, { ok: true });

    await page.goto('/#/verify-email/good-token');

    const magic = page.locator('#hiveid-magic');
    await expect(magic).toContainText(/your email is verified/i);
    await expect(magic).toContainText(/sign in/i);
  });

  test('an invalid/expired token reports the failure', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await installVerifyEmailMock(page, { ok: false, status: 400, message: 'token expired' });

    await page.goto('/#/verify-email/bad-token');

    const magic = page.locator('#hiveid-magic');
    await expect(magic).toContainText(/invalid or has expired/i);
  });
});
