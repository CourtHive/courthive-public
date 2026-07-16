import { installApiMocks, installDeclarationsMocks, installHiveIDMeMocks, seedHiveIDSessionInitScript } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';

/**
 * My CourtHive availability collection (`/#/me/availability/:providerAbbr`).
 *
 * A signed-in HiveID identity opens the provider-scoped availability page. It is
 * gated on consent: an adult grants consent once, then a rolling 4-week per-day
 * grid appears; tapping a day cycles Not set → Available → If needed →
 * Unavailable and auto-saves to the (mocked) declarations service. A minor must
 * additionally supply guardian consent before the grid appears.
 */
const BUTTON = 'button';
const GRID = '.chp-avail-grid';
const SESSION_PERSON = 'person-e2e';
const CACHED = {
  standardGivenName: 'Pat',
  standardFamilyName: 'Player',
  birthDate: '1990-01-01',
  sex: 'MALE',
  nationalityCode: 'USA',
};

function meResponse() {
  return {
    userId: 'user-e2e',
    email: 'pat@example.com',
    emailVerifiedAt: '2026-06-01T00:00:00.000Z',
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

async function bootstrap(page: any, opts: { requireGuardian?: boolean } = {}) {
  const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
  await installApiMocks(page, fixture);
  await installHiveIDMeMocks(page, { me: meResponse() });
  const decl = await installDeclarationsMocks(page, { requireGuardian: opts.requireGuardian });
  await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: SESSION_PERSON, cached: CACHED });
  return decl;
}

test.describe('My CourtHive — availability collection', () => {
  test('grants consent, then marks a day Unavailable and auto-saves it', async ({ page }) => {
    const decl = await bootstrap(page);

    await page.goto('/#/me/availability/BOBOCA');

    const shell = page.locator('#hiveid-me');
    await expect(shell).toContainText(/Availability · BOBOCA/i);

    // Consent gate first.
    const consentBtn = shell.getByRole(BUTTON, { name: /give consent/i });
    await expect(consentBtn).toBeVisible();
    await shell.getByRole('checkbox').check();
    await consentBtn.click();

    // Grid appears once consent is satisfied.
    const grid = shell.locator(GRID);
    await expect(grid).toBeVisible();

    // Cycle the first day through to Unavailable (3 taps from Not set).
    const firstDay = shell.locator('.chp-avail-day').first();
    await firstDay.click();
    await firstDay.click();
    await firstDay.click();
    await expect(firstDay).toHaveAttribute('data-state', 'UNAVAILABLE');

    // Auto-save confirms, and the service received an UNAVAILABLE day.
    await expect(shell.locator('.chp-avail-status')).toHaveText(/saved/i);
    await expect
      .poll(() => {
        const saved = decl.savedAvailability();
        return saved ? Object.values(saved.payload.days) : [];
      })
      .toContain('UNAVAILABLE');
  });

  test('a minor must supply guardian consent before the grid appears', async ({ page }) => {
    await bootstrap(page, { requireGuardian: true });

    await page.goto('/#/me/availability/BOBOCA');
    const shell = page.locator('#hiveid-me');

    await shell.getByRole('checkbox').check();
    await shell.getByRole(BUTTON, { name: /give consent/i }).click();

    // Service reports parental consent required → guardian fields reveal.
    await expect(shell).toContainText(/under age/i);
    await expect(shell.locator('.chp-avail-guardian.is-required')).toBeVisible();
    await expect(shell.locator(GRID)).toHaveCount(0);

    // Supplying a guardian email lets consent through and the grid renders.
    await shell.getByPlaceholder('Guardian email').fill('parent@example.com');
    await shell.getByRole(BUTTON, { name: /give consent/i }).click();
    await expect(shell.locator(GRID)).toBeVisible();
  });
});
