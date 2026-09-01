import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

/**
 * Round chips on the published structure (TMX parity).
 *
 * TMX's draw control bar carries round tabs that set the round the bracket
 * STARTS at. The public viewer had chips already, but they were mobile-only and
 * merely scrolled. These assert the selector behaviour: chips at desktop width,
 * clicking one collapses the earlier rounds, and the earlier chip is still there
 * to go back with.
 */
const SELECTOR_CHIP = '.chp-round-nav__chip--selector';

test.describe('structure round chips', () => {
  test('selecting a round collapses the rounds before it', async ({ page }) => {
    const fixture = buildPublishedTournament({ drawSize: 16, completeAllMatchUps: false });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/events');

    const flight = page.locator(sel.flightDisplay);
    const rounds = flight.locator('.chc-round-container');
    await expect(rounds).toHaveCount(4);

    // Desktop viewport (the default Playwright device is Desktop Chrome):
    // selector chips are visible here, unlike the scroll chips they replace.
    const chips = page.locator(SELECTOR_CHIP);
    await expect(chips).toHaveCount(4);
    await expect(chips.first()).toBeVisible();
    await expect(chips.nth(0)).toHaveText('R16');
    await expect(chips.nth(3)).toHaveText('F');

    await chips.nth(2).click(); // SF
    await expect(rounds).toHaveCount(2);
    await expect(page.locator(SELECTOR_CHIP).nth(2)).toHaveAttribute('aria-current', 'true');

    // The whole point of a chip row over a one-way collapse: R16 is still
    // reachable from the semifinals.
    await page.locator(SELECTOR_CHIP).nth(0).click();
    await expect(rounds).toHaveCount(4);
  });

  test('a two-round draw gets no selector chips', async ({ page }) => {
    // Nothing to collapse: a selector over two rounds is a control that only
    // ever hides the first half of a small bracket.
    const fixture = buildPublishedTournament({ drawSize: 4, completeAllMatchUps: false });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/events');

    await expect(page.locator(`${sel.flightDisplay} .chc-round-container`)).toHaveCount(2);
    await expect(page.locator(SELECTOR_CHIP)).toHaveCount(0);
  });
});
