import { installApiMocks, installPartnerInviteMocks, seedHiveIDSessionInitScript } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';

/**
 * Partner-invite confirm landing (`/#/register/partner/:token`). A signed-in invitee
 * accepts a doubles pairing → the invite is accepted and their registration is submitted
 * referencing the invite (`partnerInviteId`), completing the pair for TD acceptance.
 */
const TOKEN = 'invite-token-abc';
const INVITE = {
  declarationId: 'inv-1',
  status: 'INVITED',
  tournamentId: 'tid-1',
  event: "Men's Doubles",
  eventId: 'e-md',
  providerId: 'BOBOCA',
  inviteeEmail: 'ivan@example.com',
  nominatorPersonId: 'nom-1',
  createdAt: '2027-01-01T00:00:00.000Z',
  expiresAt: '2027-01-15T00:00:00.000Z',
  expired: false,
};

test.describe('Partner-invite confirm', () => {
  test('signed-in invitee accepts → invite accepted + registration references it', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    const mock = await installPartnerInviteMocks(page, INVITE);
    await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: 'person-e2e', cached: {} });

    await page.goto(`/#/register/partner/${TOKEN}`);
    const shell = page.locator('.chp-reg-shell');
    await expect(shell).toContainText("Men's Doubles");

    await shell.getByRole('button', { name: /accept & register/i }).click();
    await expect(shell.locator('.chp-reg-status')).toHaveText(/confirmed/i);

    // The invite was accepted and the invitee's registration carries the invite id.
    expect(mock.accepted()).toBe(true);
    await expect.poll(() => mock.savedRegistration()?.partnerInviteId).toBe('inv-1');
    await expect.poll(() => mock.savedRegistration()?.eventIds).toContain('e-md');
  });

  test('a terminal invite (declined) shows a status message, no accept button', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await installPartnerInviteMocks(page, { ...INVITE, status: 'DECLINED' });
    await seedHiveIDSessionInitScript(page, { token: 'e2e.token', personId: 'person-e2e', cached: {} });

    await page.goto(`/#/register/partner/${TOKEN}`);
    const shell = page.locator('.chp-reg-shell');
    await expect(shell).toContainText(/declined/i);
    await expect(shell.getByRole('button', { name: /accept & register/i })).toHaveCount(0);
  });
});
