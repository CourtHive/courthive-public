import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect, type Page } from '@playwright/test';
import { sel } from '../helpers/selectors';

/**
 * Regression cover for the tournament hero.
 *
 * The reported defect: `renderTournament` injected the tournament image with
 * `max-height: 20em` and no `max-width`, inside a `.column.is-one-quarter`
 * fixed at 25%. Wide banner artwork rendered at its intrinsic aspect width and
 * escaped the column — painting over the title at 1440px and pushing
 * `document.scrollWidth` to 610 against a 390px viewport on mobile.
 *
 * These specs pin the two invariants that failure violated (artwork never
 * exceeds its container; the page never scrolls horizontally) plus the
 * aspect-driven variant selection that replaced the fixed column.
 */

/**
 * Artwork as an SVG data URI with explicit intrinsic dimensions, so
 * `naturalWidth`/`naturalHeight` are exactly what the variant logic reads and
 * the suite stays hermetic — no network fetch for a real poster.
 */
const artwork = (width: number, height: number) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="100%" height="100%" fill="#102040"/></svg>`,
  );

/** The live Battle of Boca poster's real dimensions — ratio 1.83. */
const POSTER = { width: 1659, height: 906 };

function withArtwork(fixture: any, width: number, height: number) {
  fixture.tournamentInfo.tournamentInfo.onlineResources = [
    { name: 'tournamentImage', identifier: artwork(width, height), resourceType: 'URL', resourceSubType: 'IMAGE' },
  ];
  return fixture;
}

const HERO_IMAGE = '.chp-hero__image';

async function heroGeometry(page: Page) {
  return page.evaluate((imageSelector) => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    return {
      variant: document.querySelector('.chp-hero')?.className ?? '',
      image: rect(imageSelector),
      hero: rect('.chp-hero'),
      identity: rect('#tournament_title_block'),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  }, HERO_IMAGE);
}

test.describe('tournament hero — artwork containment', () => {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`wide banner artwork stays inside the hero and never scrolls the page (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const fixture = withArtwork(
        buildPublishedTournament({ tournamentName: 'Banner Cup' }),
        POSTER.width,
        POSTER.height,
      );
      await installApiMocks(page, fixture);
      await gotoTournament(page, fixture);

      await expect(page.locator(HERO_IMAGE)).toBeVisible();
      const geometry = await heroGeometry(page);

      // The defect's mobile signature was scrollWidth 610 vs innerWidth 390.
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);

      // The artwork must sit within the hero band, not spill past it. Allow a
      // sub-pixel tolerance for fractional layout rounding.
      expect(geometry.image!.right).toBeLessThanOrEqual(geometry.hero!.right + 1);
      expect(geometry.image!.x).toBeGreaterThanOrEqual(geometry.hero!.x - 1);

      // The artwork must not paint over the title, which is what made the
      // original report visible.
      const overlaps =
        geometry.image!.right > geometry.identity!.x &&
        geometry.image!.x < geometry.identity!.right &&
        geometry.image!.bottom > geometry.identity!.y &&
        geometry.image!.y < geometry.identity!.bottom;
      expect(overlaps).toBe(false);
    });
  }

  test('wide artwork lays out as a banner, square artwork as a logo mark', async ({ page }) => {
    const banner = withArtwork(buildPublishedTournament({ tournamentName: 'Banner Cup' }), POSTER.width, POSTER.height);
    await installApiMocks(page, banner);
    await gotoTournament(page, banner);
    await expect(page.locator(HERO_IMAGE)).toBeVisible();
    await expect(page.locator('.chp-hero')).toHaveClass(/chp-hero--banner/);

    const mark = withArtwork(buildPublishedTournament({ tournamentName: 'Mark Cup' }), 300, 300);
    await installApiMocks(page, mark);
    await gotoTournament(page, mark);
    await expect(page.locator(HERO_IMAGE)).toBeVisible();
    await expect(page.locator('.chp-hero')).toHaveClass(/chp-hero--mark/);
  });

  test('the banner box hugs the artwork rather than stretching past it', async ({ page }) => {
    const fixture = withArtwork(buildPublishedTournament(), POSTER.width, POSTER.height);
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture);
    await expect(page.locator(HERO_IMAGE)).toBeVisible();

    const { image } = await heroGeometry(page);
    // A stretched box would report the container width against a capped
    // height, leaving the border drawn around empty space.
    expect(image!.width / image!.height).toBeCloseTo(POSTER.width / POSTER.height, 1);
  });

  test('falls back to the court SVG when the artwork fails to load', async ({ page }) => {
    const fixture = buildPublishedTournament();
    fixture.tournamentInfo.tournamentInfo.onlineResources = [
      { name: 'tournamentImage', identifier: 'https://example.invalid/missing.png', resourceType: 'URL' },
    ];
    await installApiMocks(page, fixture);
    await page.route('https://example.invalid/**', (route) => route.abort());
    await gotoTournament(page, fixture);

    await expect(page.locator(`${sel.logo} svg`)).toHaveCount(1);
    await expect(page.locator('.chp-hero')).toHaveClass(/chp-hero--mark/);
  });

  test('surfaces dates, venue, events and entries in the hero meta', async ({ page }) => {
    const fixture = buildPublishedTournament({ tournamentName: 'Meta Cup', drawSize: 8 });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture);

    const meta = page.locator('.chp-hero__meta li');
    await expect(meta.first()).toBeVisible();
    const items = await meta.allTextContents();
    expect(items.some((item) => /2026/.test(item))).toBe(true);
    expect(items.some((item) => item.includes('Center Club'))).toBe(true);
    expect(items.some((item) => /\d+ events?$/.test(item))).toBe(true);
    // Entries, never "players" — per-event counts double-count a competitor
    // entered in both singles and doubles.
    expect(items.some((item) => /\d+ entries$/.test(item))).toBe(true);
    expect(items.some((item) => /player/.test(item))).toBe(false);
  });
});

test.describe('tournament notes — provider HTML', () => {
  test('strips provider inline colours so notes inherit the theme', async ({ page }) => {
    const fixture = buildPublishedTournament();
    // The shape of the live Battle of Boca notes: a pale blue authored against
    // a dark editor canvas, unreadable on the light theme.
    fixture.tournamentInfo.tournamentInfo.notes =
      '<p><span style="color: rgb(201, 218, 248); font-weight: bold">Player Appreciation Day</span></p>';
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture);

    const notes = page.locator('.tournament-notes');
    await expect(notes).toContainText('Player Appreciation Day');

    const span = notes.locator('span').first();
    // The colour is gone; the non-colour declaration it shipped alongside stays.
    await expect(span).toHaveAttribute('style', 'font-weight: bold');

    // And the rendered colour is the themed body colour, not the provider's.
    const color = await span.evaluate((element) => getComputedStyle(element).color);
    expect(color).not.toBe('rgb(201, 218, 248)');
  });

  test('removes scripts and inline event handlers from provider markup', async ({ page }) => {
    const fixture = buildPublishedTournament();
    fixture.tournamentInfo.tournamentInfo.notes =
      '<p onclick="window.__pwned = true">Schedule</p><script>window.__pwned = true;</script>';
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture);

    await expect(page.locator('.tournament-notes')).toContainText('Schedule');
    await expect(page.locator('.tournament-notes script')).toHaveCount(0);
    await expect(page.locator('.tournament-notes p')).not.toHaveAttribute('onclick', /.*/);
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
  });
});
