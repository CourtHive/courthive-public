import {
  installApiMocks,
  installHiveIDMeMocks,
  seedHiveIDSessionInitScript,
  gotoTournament,
} from '../helpers/routes';
import { buildPublishedTournament, PublicTournamentFixture } from '../helpers/fixtures';
import { test, expect, Page, Route } from '@playwright/test';

/**
 * Info-tab registration CTA (post-migration). The button no longer submits to
 * the mutation server: the actionable state navigates to /#/register/:id, and
 * the existing-registration check reads the person's snapshot from the
 * courthive-declarations service, scoped by the tournament's owning provider
 * (`parentOrganisation.organisationId`). See the registration consumer
 * migration — CFS `/me/registrations` intake retired.
 */

const PROVIDER = 'BOBOCA';
const DECLARATIONS = 'http://localhost:3120';

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

/** A published fixture whose tournamentInfo advertises an OPEN registration window + provider. */
function openRegistrationFixture(): PublicTournamentFixture {
  const fixture = buildPublishedTournament({ tournamentName: 'Registration Migration Live' });
  const info = fixture.tournamentInfo.tournamentInfo;
  info.parentOrganisation = {
    organisationId: PROVIDER,
    organisationName: 'Boboca Tennis',
    organisationAbbreviation: PROVIDER,
  };
  info.registrationProfile = {
    entriesOpen: '2020-01-01T00:00:00.000Z',
    entriesClose: '2099-01-01T00:00:00.000Z',
  };
  return fixture;
}

/**
 * Mock the declarations existing-registration read the Info-tab CTA performs.
 * Returns `snapshot` for GET /me/registrations/:tid and records the URL the app
 * requested so the test can assert it hit declarations with the provider query.
 */
async function installExistingRegistrationMock(page: Page, snapshot: unknown): Promise<{ url: () => string | null }> {
  let requestedUrl: string | null = null;
  await page.route(`${DECLARATIONS}/me/registrations/**`, (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      void route.fulfill({ status: 204, headers: CORS });
      return;
    }
    requestedUrl = route.request().url();
    void route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  });
  return { url: () => requestedUrl };
}

async function signInAndLoad(page: Page, fixture: PublicTournamentFixture) {
  await seedHiveIDSessionInitScript(page);
  await installHiveIDMeMocks(page, {
    me: {
      userId: 'user-e2e',
      email: 'pat@example.com',
      contactEmail: 'pat@example.com',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      personId: 'person-e2e',
      personRevision: 1,
      cached: {
        standardGivenName: 'Pat',
        standardFamilyName: 'Player',
        birthDate: '1990-01-01',
        sex: 'MALE',
        nationalityCode: 'USA',
      },
      consentPreferences: {},
    },
  });
  await installApiMocks(page, fixture);
  await gotoTournament(page, fixture);
  await expect(page.locator('#tournament')).toBeVisible();
}

test.describe('info tab — registration CTA (declarations migration)', () => {
  test('no existing registration → "Register" navigates to /#/register/:id (not a CFS submit)', async ({ page }) => {
    const fixture = openRegistrationFixture();
    const mock = await installExistingRegistrationMock(page, null);
    await signInAndLoad(page, fixture);

    const cta = page.locator('.chp-register-button');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText('Register for this tournament');

    // The existing-check hit the declarations service, scoped by provider.
    expect(mock.url()).toContain(`${DECLARATIONS}/me/registrations/${fixture.tournamentId}`);
    expect(mock.url()).toContain(`provider=${PROVIDER}`);

    await cta.click();
    await expect(page).toHaveURL(new RegExp(`#/register/${fixture.tournamentId}`));
  });

  test('withdrawn declarations snapshot → CTA stays "open" (re-registration allowed)', async ({ page }) => {
    // Regression guard for the status-aware mapping: a WITHDRAWN snapshot is
    // still returned by the service, and must NOT show "already registered".
    const fixture = openRegistrationFixture();
    await installExistingRegistrationMock(page, {
      personId: 'person-e2e',
      providerId: PROVIDER,
      tournamentId: fixture.tournamentId,
      status: 'WITHDRAWN',
      payload: { eventIds: [] },
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    await signInAndLoad(page, fixture);

    const cta = page.locator('.chp-register-button');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText('Register for this tournament');
    await cta.click();
    await expect(page).toHaveURL(new RegExp(`#/register/${fixture.tournamentId}`));
  });

  test('submitted declarations snapshot → "Registered" CTA links to My CourtHive', async ({ page }) => {
    const fixture = openRegistrationFixture();
    await installExistingRegistrationMock(page, {
      personId: 'person-e2e',
      providerId: PROVIDER,
      tournamentId: fixture.tournamentId,
      status: 'SUBMITTED',
      payload: { eventIds: ["Men's Singles"] },
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    await signInAndLoad(page, fixture);

    const cta = page.locator('.chp-register-button');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText('Registered');
    await cta.click();
    await expect(page).toHaveURL(/#\/me/);
  });
});
