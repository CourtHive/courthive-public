import {
  installApiMocks,
  installDeclarationsMocks,
  installHiveIDSignupMock,
  installProposalRegistrationMocks,
  seedHiveIDSessionInitScript,
} from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';

/**
 * Proposal registration page (`/#/register/:tournamentId`). Renders from a
 * sanctioning proposal (AMS public read) — before the tournamentRecord exists —
 * and lets a signed-in person submit a REGISTRATION declaration. An unauthenticated
 * visitor onboards inline: consent notice + checkbox → create-account (mint-on-signup
 * carrying the tournament's provider) → consent recorded → registration form.
 */
const REGISTER = '#register';
const TID = 'tid-1';
const MENS = "Men's Singles";
const NAME = 'Spring Open';
const PERSON = 'person-e2e';
const STATUS = '.chp-reg-status';
const VIEW = {
  tournamentId: TID,
  tournamentName: NAME,
  proposedStartDate: '2027-06-01',
  proposedEndDate: '2027-06-07',
  provider: 'BOBOCA',
  sanctioningStatus: 'APPROVED',
  events: [
    { eventName: MENS, eventType: 'SINGLES', gender: 'MALE' },
    { eventName: "Women's Singles", eventType: 'SINGLES', gender: 'FEMALE' },
  ],
  registration: { entriesOpen: '2027-01-01', entriesClose: '2027-05-01', entryMethod: 'online' },
};

async function bootstrap(page: any) {
  const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
  await installApiMocks(page, fixture);
  return installProposalRegistrationMocks(page, VIEW);
}

test.describe('Proposal registration', () => {
  test('a signed-in person registers for an event', async ({ page }) => {
    const reg = await bootstrap(page);
    await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: PERSON, cached: {} });

    await page.goto(`/#/register/${TID}`);
    const shell = page.locator(REGISTER);
    await expect(shell).toContainText(NAME);
    await expect(shell).toContainText(MENS);

    await shell.getByRole('checkbox').first().check();
    await shell.getByRole('button', { name: /^register$/i }).click();

    await expect(shell.locator(STATUS)).toHaveText(/registered/i);
    await expect.poll(() => reg.savedRegistration()?.payload?.eventIds).toContain(MENS);
  });

  test('an unauthenticated visitor sees the inline create-account panel', async ({ page }) => {
    await bootstrap(page);
    await page.goto(`/#/register/${TID}`);
    const shell = page.locator(REGISTER);
    await expect(shell).toContainText(NAME);
    // Consent notice is shown first; DOB/sex/signup fields are gated behind the checkbox.
    await expect(shell).toContainText(/consent to CourtHive collecting/i);
    await expect(shell.locator('.chp-reg-create-shell')).toBeHidden();
  });

  test('a brand-new person onboards inline: consent → create account → register', async ({ page }) => {
    const reg = await bootstrap(page);
    const decl = await installDeclarationsMocks(page);
    const signupMock = await installHiveIDSignupMock(page, { personId: PERSON });

    await page.goto(`/#/register/${TID}`);
    const shell = page.locator(REGISTER);
    await expect(shell).toContainText(NAME);

    // 1. Consent gate — the signup shell is hidden until the notice is acknowledged.
    const createShell = shell.locator('.chp-reg-create-shell');
    await expect(createShell).toBeHidden();
    await shell.locator('.chp-reg-check input[type="checkbox"]').check();
    await expect(createShell).toBeVisible();

    // 2. Fill the create-account form (name/email/DOB/sex) and submit.
    await createShell.locator('#chc-hil-firstName').fill('Jamie');
    await createShell.locator('#chc-hil-lastName').fill('Rivera');
    await createShell.locator('#chc-hil-email').fill('jamie@example.com');
    await createShell.locator('#chc-hil-birthDate').fill('1994-08-20');
    await createShell.locator('#chc-hil-sex').selectOption('F');
    await createShell.getByRole('button', { name: /create account/i }).click();

    // 3. Signup forwarded DOB + sex + the tournament provider for the mint.
    await expect.poll(() => signupMock.signupBody()?.birthDate).toBe('1994-08-20');
    expect(signupMock.signupBody()?.sex).toBe('F');
    expect(signupMock.signupBody()?.provider).toBe('BOBOCA');

    // 4. Consent recorded post-signup, then the registration form appears.
    await expect.poll(() => decl.savedConsent()?.consentVersion).toBe('v1');
    await shell.getByRole('checkbox').first().check();
    await shell.getByRole('button', { name: /^register$/i }).click();
    await expect(shell.locator(STATUS)).toHaveText(/registered/i);
    await expect.poll(() => reg.savedRegistration()?.payload?.eventIds).toContain(MENS);
  });

  test('stores the stable eventId (not the name) when the proposal carries one', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    const viewWithIds = {
      ...VIEW,
      events: [
        { eventId: 'evt-ms', eventName: MENS, eventType: 'SINGLES', gender: 'MALE' },
        { eventId: 'evt-ws', eventName: "Women's Singles", eventType: 'SINGLES', gender: 'FEMALE' },
      ],
    };
    const reg = await installProposalRegistrationMocks(page, viewWithIds);
    await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: PERSON, cached: {} });

    await page.goto(`/#/register/${TID}`);
    const shell = page.locator(REGISTER);
    await expect(shell).toContainText(MENS); // still displays the name
    await shell.getByRole('checkbox').first().check();
    await shell.getByRole('button', { name: /^register$/i }).click();
    await expect(shell.locator(STATUS)).toHaveText(/registered/i);

    // The submitted payload keys on the eventId, not the display name.
    await expect.poll(() => reg.savedRegistration()?.payload?.eventIds).toContain('evt-ms');
    expect(reg.savedRegistration()?.payload?.eventIds).not.toContain(MENS);
  });
});
