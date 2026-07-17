import { installApiMocks, installProposalRegistrationMocks, seedHiveIDSessionInitScript } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';

/**
 * Proposal registration page (`/#/register/:tournamentId`). Renders from a
 * sanctioning proposal (AMS public read) — before the tournamentRecord exists —
 * and lets a signed-in person submit a REGISTRATION declaration. An unauthenticated
 * visitor is prompted to sign in.
 */
const REGISTER = '#register';
const TID = 'tid-1';
const MENS = "Men's Singles";
const NAME = 'Spring Open';
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
    await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: 'person-e2e', cached: {} });

    await page.goto(`/#/register/${TID}`);
    const shell = page.locator(REGISTER);
    await expect(shell).toContainText(NAME);
    await expect(shell).toContainText(MENS);

    await shell.getByRole('checkbox').first().check();
    await shell.getByRole('button', { name: /^register$/i }).click();

    await expect(shell.locator('.chp-reg-status')).toHaveText(/registered/i);
    await expect.poll(() => reg.savedRegistration()?.payload?.eventIds).toContain(MENS);
  });

  test('an unauthenticated visitor is prompted to sign in', async ({ page }) => {
    await bootstrap(page);
    await page.goto(`/#/register/${TID}`);
    const shell = page.locator(REGISTER);
    await expect(shell).toContainText(NAME);
    await expect(shell).toContainText(/sign in .* to register/i);
  });
});
