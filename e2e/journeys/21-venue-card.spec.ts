import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect, type Page } from '@playwright/test';

/**
 * Venue cards on the Info tab.
 *
 * `buildVenueCard` fills its image zone in order: a `venueImage` resource, then
 * an OpenStreetMap preview when the address carries coordinates, then a court
 * SVG, then a striped placeholder. courthive-public was calling
 * `mapVenueToCardData(venue)` with no options, so the court-SVG step could
 * never fire and venues with neither an image nor coordinates dropped to the
 * placeholder — 137px of diagonal stripes above 61px of content.
 *
 * A production sweep of the provider calendars found that is the common case:
 * of seven distinct measurable venues, none carried a `venueImage` and three
 * carried no coordinates.
 */

const VENUE_IMAGE = '.tournament-venues .chc-vc-image';
const GRID = '.tournament-venues__grid';

/** Rick Macci Tennis Academy's real coordinates, from the live BOBOCA record. */
const COORDS = { latitude: 26.3816192, longitude: -80.2219808, city: 'Boca Raton', state: 'FL' };

function withVenueCoords(fixture: any) {
  for (const venue of fixture.tournamentInfo.tournamentInfo.venues ?? []) {
    venue.addresses = [COORDS];
  }
  return fixture;
}

async function gotoInfo(page: Page, fixture: any) {
  await installApiMocks(page, fixture);
  await gotoTournament(page, fixture);
  await expect(page.locator(VENUE_IMAGE).first()).toBeVisible();
}

test.describe('venue card — image zone', () => {
  test('falls back to a court SVG, not a striped placeholder, when a venue has no image or coordinates', async ({
    page,
  }) => {
    // mocksEngine venues carry neither, which is the production shape.
    await gotoInfo(page, buildPublishedTournament());

    const image = page.locator(VENUE_IMAGE).first();
    await expect(image.locator('svg')).toHaveCount(1);
    await expect(image.locator('[class*="placeholder"]')).toHaveCount(0);
  });

  test('renders an OpenStreetMap preview when the venue has coordinates', async ({ page }) => {
    await gotoInfo(page, withVenueCoords(buildPublishedTournament()));

    const image = page.locator(VENUE_IMAGE).first();
    await expect(image.locator('iframe')).toHaveCount(1);
    // The map supersedes the SVG fallback rather than stacking with it.
    await expect(image.locator('svg')).toHaveCount(0);
    await expect(image.locator('[class*="placeholder"]')).toHaveCount(0);
  });
});

test.describe('venue card — sport derivation', () => {
  /**
   * `eventInfo.matchUpFormats` is the survey added by factory #4615: distinct
   * codes from the event, its drawDefinitions, and their structures. Injected
   * here in the shape the factory emits, so the consumer path is exercised
   * before the factory publishes and the dep bumps.
   */
  function withMatchUpFormats(fixture: any, matchUpFormats: string[]) {
    for (const event of fixture.tournamentInfo.tournamentInfo.eventInfo ?? []) {
      event.matchUpFormat = undefined;
      event.matchUpFormats = matchUpFormats;
    }
    return fixture;
  }

  test('a rally-scored code renders a pickleball court, not the tennis default', async ({ page }) => {
    await gotoInfo(page, withMatchUpFormats(buildPublishedTournament(), ['SET3-S:11@RALLY']));

    const svg = page.locator(`${VENUE_IMAGE} svg`);
    await expect(svg).toHaveCount(1);
    // createCourtSvg stamps `court--<sport>` on the rendered SVG.
    await expect(svg).toHaveClass(/court--pickleball/);
  });

  test('a set-scored code renders a tennis court', async ({ page }) => {
    await gotoInfo(page, withMatchUpFormats(buildPublishedTournament(), ['SET3-S:6/TB7']));

    await expect(page.locator(`${VENUE_IMAGE} svg`)).toHaveClass(/court--tennis/);
  });

  test('falls back to tennis when no event publishes any format', async ({ page }) => {
    // Pre-#4615 payload shape — the behaviour until the factory publishes.
    await gotoInfo(page, withMatchUpFormats(buildPublishedTournament(), []));

    await expect(page.locator(`${VENUE_IMAGE} svg`)).toHaveClass(/court--tennis/);
  });
});

test.describe('venue card — grid', () => {
  test('a single venue renders as a card, not one narrow cell beside empty slots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoInfo(page, buildPublishedTournament());

    const grid = page.locator(GRID);
    await expect(grid).toHaveAttribute('data-count', '1');

    const { columnCount, cardWidth, gridWidth } = await page.evaluate(() => {
      const element = document.querySelector('.tournament-venues__grid') as HTMLElement;
      const card = document.querySelector('.tournament-venues .chc-vc-card') as HTMLElement;
      return {
        columnCount: getComputedStyle(element).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
        cardWidth: card.getBoundingClientRect().width,
        gridWidth: element.getBoundingClientRect().width,
      };
    });

    // One track, not the five that auto-fill produced across a 1296px row...
    expect(columnCount).toBe(1);
    // ...and capped, so it reads as a card rather than a full-width banner.
    expect(cardWidth).toBeLessThan(gridWidth * 0.6);
    expect(cardWidth).toBeGreaterThan(240);
  });
});
