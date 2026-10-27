import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect, type Page } from '@playwright/test';
import { sel, tabContentId } from '../helpers/selectors';

/**
 * A bracket with more rounds than the page container fits gets the room it needs.
 *
 * The tournament page is held to the container width, so on a wide screen a 128-draw was squeezed — truncated
 * schedule headers, a last round that scrolled — with the sides of the screen empty. The events section now widens
 * past the container, centred, by what the visible rounds need (services/bracketWidth.ts + layout.css). A draw that
 * fits must not move, and the widening must never scroll the page sideways.
 */
const SELECTOR_CHIP = '.chp-round-nav__chip--selector';

async function openDraw(page: Page, drawSize: number, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  const fixture = buildPublishedTournament({ drawSize, completeAllMatchUps: false });
  await installApiMocks(page, fixture);
  await gotoTournament(page, fixture, '/events');
  await page.locator(`${sel.flightDisplay} .chc-round-container`).first().waitFor();
}

const measure = (page: Page) =>
  page.evaluate((sectionSelector) => {
    const box = (el: Element | null) => el!.getBoundingClientRect();
    const section = box(document.querySelector(sectionSelector));
    const tabs = box(document.querySelector('.tabs'));
    const bracket = document.querySelector('.chc-container') as HTMLElement;
    const doc = document.documentElement;
    return {
      section: { left: Math.round(section.left), right: Math.round(section.right) },
      tabs: { left: Math.round(tabs.left), right: Math.round(tabs.right) },
      bracketOverflow: bracket.scrollWidth - bracket.clientWidth,
      pageOverflow: doc.scrollWidth - doc.clientWidth,
      viewport: doc.clientWidth,
    };
  }, tabContentId('Events'));

test.describe('wide bracket section', () => {
  test('a draw that fits stays at the container width', async ({ page }) => {
    await openDraw(page, 8, 1920);
    const m = await measure(page);
    expect(m.section).toEqual(m.tabs);
  });

  test('a 128-draw widens past the container, centred, and fits', async ({ page }) => {
    await openDraw(page, 128, 1920);
    const m = await measure(page);
    expect(m.section.left).toBeLessThan(m.tabs.left);
    expect(m.section.right).toBeGreaterThan(m.tabs.right);
    expect(Math.abs(m.section.left + m.section.right - (m.tabs.left + m.tabs.right))).toBeLessThanOrEqual(2);
    // fits, unless the section has reached its limit — the viewport less its 1rem gutters (CI's fonts set wider
    // columns than a Mac's, so a 128-draw can still need more than 1920px there)
    const atLimit = m.section.right - m.section.left >= m.viewport - 33;
    expect(atLimit || m.bracketOverflow <= 0).toBe(true);
    expect(m.pageOverflow).toBe(0);
  });

  test('a column wider than the estimate is measured and given its room', async ({ page }) => {
    await openDraw(page, 64, 1920);
    // halve the per-round estimate so the measured overflow has to make up the difference
    await page.addStyleTag({ content: '.section.is-fluid { --chp-round-pitch: 8rem; }' });
    await page.locator(SELECTOR_CHIP).filter({ hasText: 'R64' }).click();
    const m = await measure(page);
    expect(m.section.left).toBeLessThan(m.tabs.left);
    expect(m.bracketOverflow).toBeLessThanOrEqual(0);
    expect(m.pageOverflow).toBe(0);
  });

  test('choosing a later starting round gives the width back', async ({ page }) => {
    await openDraw(page, 128, 1920);
    await page.locator(SELECTOR_CHIP).filter({ hasText: 'QF' }).click();
    await expect(page.locator(`${sel.flightDisplay} .chc-round-container`)).toHaveCount(3);
    const m = await measure(page);
    expect(m.section).toEqual(m.tabs);
  });

  test('a narrower desktop widens without scrolling the page', async ({ page }) => {
    await openDraw(page, 128, 1280);
    const m = await measure(page);
    expect(m.section.left).toBeLessThan(m.tabs.left);
    expect(m.pageOverflow).toBe(0);
  });

  test('a phone keeps the mobile bracket layout at the page width', async ({ page }) => {
    await openDraw(page, 128, 390);
    const m = await measure(page);
    expect(m.section).toEqual(m.tabs);
    expect(m.pageOverflow).toBe(0);
  });
});
