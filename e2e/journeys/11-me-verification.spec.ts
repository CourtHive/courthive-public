import { installApiMocks, installHiveIDMeMocks, seedHiveIDSessionInitScript } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';

/**
 * My CourtHive (`/#/me`) email-verification section (HiveID, Phase C/D).
 *
 * A signed-in identity (seeded `hiveidSession` + mocked `/auth/hiveid/me`)
 * renders an "Email verification" section into `#hiveid-me`. Unverified shows
 * a resend control whose click confirms the send; verified shows the verified
 * status with no resend control. The mocked `me` deliberately matches the
 * seeded session's personId + cached fields so the page's best-effort refresh
 * doesn't trigger a re-render mid-assertion.
 */
const SESSION_PERSON = 'person-e2e';
const ME_SELECTOR = '#hiveid-me';
const CACHED = {
  standardGivenName: 'Pat',
  standardFamilyName: 'Player',
  birthDate: '1990-01-01',
  sex: 'MALE',
  nationalityCode: 'USA',
};

function meResponse(emailVerifiedAt: string | null) {
  return {
    userId: 'user-e2e',
    email: 'pat@example.com',
    emailVerifiedAt,
    personId: SESSION_PERSON,
    personRevision: 1,
    cached: {
      standardFamilyName: CACHED.standardFamilyName,
      standardGivenName: CACHED.standardGivenName,
      birthDate: CACHED.birthDate,
      sex: CACHED.sex,
      nationalityCode: CACHED.nationalityCode,
    },
    consentPreferences: {},
  };
}

test.describe('My CourtHive — email verification', () => {
  test('unverified email shows resend, and resending confirms', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await installHiveIDMeMocks(page, { me: meResponse(null), resendStatus: 'sent' });
    await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: SESSION_PERSON, cached: CACHED });

    await page.goto('/#/me');

    const me = page.locator(ME_SELECTOR);
    await expect(me).toContainText('Email verification');
    await expect(me).toContainText(/is not verified yet/i);

    const resend = me.getByRole('button', { name: /resend verification email/i });
    await expect(resend).toBeVisible();
    await resend.click();

    await expect(me).toContainText(/verification email sent/i);
  });

  test('verified email shows the verified status and no resend control', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await installHiveIDMeMocks(page, { me: meResponse('2026-06-01T00:00:00.000Z') });
    await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: SESSION_PERSON, cached: CACHED });

    await page.goto('/#/me');

    const me = page.locator(ME_SELECTOR);
    await expect(me).toContainText('Email verification');
    await expect(me).toContainText(/is verified/i);
    await expect(me.getByRole('button', { name: /resend verification email/i })).toHaveCount(0);
  });

  test('a never-verified email can be changed in place', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    const meMock = await installHiveIDMeMocks(page, { me: meResponse(null) });
    await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: SESSION_PERSON, cached: CACHED });

    await page.goto('/#/me');
    const me = page.locator(ME_SELECTOR);
    await expect(me).toContainText(/is not verified yet/i);

    await me.getByRole('button', { name: /change email/i }).click();
    const input = me.locator('.chp-me-email-editor input[type="email"]');
    await input.fill('real@example.com');
    await me.getByRole('button', { name: /save email/i }).click();

    await expect.poll(() => meMock.savedContactEmail()).toBe('real@example.com');
  });

  // A stored token whose server-side session has expired must be treated as logged
  // out — not rendered as a "logged in" shell whose panels all say "Sign in…".
  test('a rejected (expired) session is treated as logged out and cleared', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await page.route('**/auth/hiveid/me', (route) => {
      if (route.request().method() === 'OPTIONS') {
        void route.fulfill({
          status: 204,
          headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type' },
        });
        return;
      }
      void route.fulfill({
        status: 401,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'unauthorized' }),
      });
    });
    await seedHiveIDSessionInitScript(page, { token: 'stale.token', personId: SESSION_PERSON, cached: CACHED });

    await page.goto('/#/me');

    const me = page.locator(ME_SELECTOR);
    await expect(me).toContainText(/session has expired/i);
    await expect(me).not.toContainText(/Email verification/);
    // The stale session is cleared so nothing else in the app claims to be logged in.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('hiveidSession'))).toBeNull();
  });
});
