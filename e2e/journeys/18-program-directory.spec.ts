import { installApiMocks } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect, type Page } from '@playwright/test';

/**
 * Program directory (`/#/program s`) — searchable browse of every college program with published
 * duals, from courthive-query's public GET /programs. Mocked here (hermetic suite). Covers the list
 * render, the count subtitle, client-side search filtering, the link into each program's season, and
 * reaching the page via the navbar "Programs" link (the global discoverability entry point).
 */

const DIR = '#programs';

interface Program {
  teamId: string;
  teamName: string;
  dualCount: number;
}

function programs(): Program[] {
  return [
    { teamId: 'team-wf', teamName: 'Wake Forest University', dualCount: 18 },
    { teamId: 'team-uva', teamName: 'University of Virginia', dualCount: 15 },
    { teamId: 'team-duke', teamName: 'Duke University', dualCount: 12 },
  ];
}

// Scope to the query ORIGIN (:3150) and the exact list path, so the mock never intercepts a Vite
// module URL under src/pages/programs/ (which would return JSON and crash the app boot).
async function mockProgramsList(page: Page, list: Program[]): Promise<void> {
  await page.route('http://localhost:3150/programs', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ programs: list }) }),
  );
}

test.describe('Program directory', () => {
  test('renders the list, filters on search, and links into each program', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await mockProgramsList(page, programs());

    await page.goto('/#/programs');

    const dir = page.locator(DIR);
    await expect(dir).toBeVisible();
    await expect(dir.locator('.chp-programs-title')).toHaveText('Programs');
    await expect(dir.locator('.chp-programs-subtitle')).toContainText('3 programs');
    await expect(dir.locator('.chp-programs-item:visible')).toHaveCount(3);

    // First row links to its season; count is shown.
    await expect(dir.locator('.chp-programs-name').first()).toHaveAttribute('href', '#/program/team-wf');
    await expect(dir.locator('.chp-programs-item').first()).toContainText('18 duals');

    // Search filters client-side.
    await dir.locator('.chp-programs-search').fill('duke');
    await expect(dir.locator('.chp-programs-item:visible')).toHaveCount(1);
    await expect(dir.locator('.chp-programs-item:visible .chp-programs-name')).toHaveText('Duke University');
    await expect(dir.locator('.chp-programs-subtitle')).toContainText('1 of 3 programs');
  });

  test('is reachable from the navbar "Programs" link', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 4, scheduleFirstRound: false });
    await installApiMocks(page, fixture);
    await mockProgramsList(page, programs());

    await page.goto('/#/');
    await page.locator('.navbar-item.programs-link').click();

    await expect(page.locator(DIR)).toBeVisible();
    await expect(page.locator(`${DIR} .chp-programs-item`)).toHaveCount(3);
  });
});
