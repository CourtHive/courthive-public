import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { sel, tabId } from '../helpers/selectors';
import { test, expect } from '@playwright/test';

test.describe('tournament — info view', () => {
  test('hydrates the title block, logo, and tabs from /factory/tournamentinfo', async ({ page }) => {
    const fixture = buildPublishedTournament({ tournamentName: 'Hermetic Cup' });
    await installApiMocks(page, fixture);

    await gotoTournament(page, fixture);

    // Tournament view container becomes visible and the title hydrates.
    await expect(page.locator(sel.tournament)).toBeVisible();
    await expect(page.locator(sel.titleBlock)).toContainText('Hermetic Cup');

    // Logo column always renders something — a published image or the
    // fallback court SVG (this fixture has no image → SVG).
    await expect(page.locator(`${sel.logo} svg, ${sel.logo} img`)).toHaveCount(1);

    // A published tournament with venues + events surfaces the Info and
    // Events tabs; Info is the default landing tab.
    await expect(page.locator(tabId('Info'))).toBeVisible();
    await expect(page.locator(tabId('Events'))).toBeVisible();
  });
});
