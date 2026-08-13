import { installApiMocks } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect, type Page } from '@playwright/test';

/**
 * Program view (`/#/program/:teamId`) — a college program's published season of dual matches,
 * read from courthive-query's public by-team endpoint. The endpoint is mocked here (the suite is
 * hermetic — no real query service); the assertions cover the header, per-year season grouping,
 * the tournament-scorecard links, calendar-date formatting (no UTC off-by-one), and the empty state.
 */

const TEAM_ID = 'team-e2e-1';
const PROGRAM = '#program';

interface Dual {
  tournamentId: string;
  tournamentName: string;
  startDate: string;
  endDate: string;
  providerId: string;
  teamName: string;
}

function seasonDuals(): Dual[] {
  return [
    { tournamentId: 'ita-dual-A', tournamentName: 'Wake Forest University vs Virginia Tech', startDate: '2026-03-20', endDate: '2026-03-20', providerId: 'prov-1', teamName: 'Wake Forest University' },
    { tournamentId: 'ita-dual-B', tournamentName: 'Wake Forest University vs Baylor University', startDate: '2026-02-22', endDate: '2026-02-22', providerId: 'prov-1', teamName: 'Wake Forest University' },
    { tournamentId: 'ita-dual-C', tournamentName: 'Wake Forest University vs Duke University', startDate: '2025-04-10', endDate: '2025-04-10', providerId: 'prov-1', teamName: 'Wake Forest University' },
  ];
}

// Registered AFTER installApiMocks so this handler wins for /programs/* (Playwright matches
// most-recently-added routes first).
async function mockPrograms(page: Page, teamId: string, duals: Dual[]): Promise<void> {
  await page.route('**/programs/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ teamId, duals }) }),
  );
}

test.describe('Program view — by-team season', () => {
  test('renders header, per-year season groups, and links each dual to its scorecard', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await mockPrograms(page, TEAM_ID, seasonDuals());

    await page.goto(`/#/program/${TEAM_ID}`);

    const program = page.locator(PROGRAM);
    await expect(program).toBeVisible();
    await expect(program.locator('.chp-program-title')).toHaveText('Wake Forest University');
    await expect(program.locator('.chp-program-subtitle')).toContainText('3 dual matches');

    // Two season groups, newest year first (service orders duals start_date DESC).
    await expect(program.locator('.chp-program-season-title')).toHaveText(['2026 season', '2025 season']);

    // First dual: name, scorecard link, and calendar-correct date (no UTC day shift).
    const firstLink = program.locator('.chp-program-name').first();
    await expect(firstLink).toHaveText('Wake Forest University vs Virginia Tech');
    await expect(firstLink).toHaveAttribute('href', '#/tournament/ita-dual-A');
    await expect(program.locator('.chp-program-date').first()).toHaveText('Mar 20, 2026');

    // 2025 group has the single Duke dual.
    await expect(program.locator('.chp-program-name')).toHaveText([
      'Wake Forest University vs Virginia Tech',
      'Wake Forest University vs Baylor University',
      'Wake Forest University vs Duke University',
    ]);
  });

  test('a program with no published duals shows a friendly empty state', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await mockPrograms(page, TEAM_ID, []);

    await page.goto(`/#/program/${TEAM_ID}`);
    await expect(page.locator(`${PROGRAM} .chp-program-message`)).toContainText('No published dual matches');
  });
});
