import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect, type Page } from '@playwright/test';
import { sel, tabId } from '../helpers/selectors';

/**
 * Participants tab presentation, and the navbar alignment it sits under.
 *
 * Reported defect: for a tournament that publishes only participant names —
 * the live Battle of Boca roster, 131 individuals — `createPlayersTable`
 * rendered a Tabulator grid with a single column. Every `.tabulator-cell`
 * carries a `border-bottom` that stops at the ~350px column edge, so each name
 * appeared underlined beside ~950px of empty space.
 */

const ROSTER = '.chp-roster';
const ROSTER_NAME = '.chp-roster__name';
const ALIGNED_CUP = 'Aligned Cup';

/**
 * Reduce the fixture to a names-only roster, matching the live Battle of Boca
 * publish config. Country and events are suppressed by the publish config;
 * `mocksEngine` also gives every person an address, which would otherwise
 * surface a City / State column, so that is stripped too.
 */
function namesOnly(fixture: any) {
  const info = fixture.tournamentInfo.tournamentInfo;
  info.publishState = info.publishState ?? {};
  info.publishState.participants = {
    ...(info.publishState.participants ?? {}),
    columns: { country: false, events: false },
  };
  for (const participant of fixture.participants.participants ?? []) {
    if (participant.person) delete participant.person.addresses;
  }
  return fixture;
}

/** Give the roster a mixed field so gender grouping has something to split. */
function withSexes(fixture: any) {
  const participants = fixture.participants.participants ?? [];
  participants
    .filter((participant: any) => participant.participantType === 'INDIVIDUAL')
    .forEach((participant: any, index: number) => {
      participant.person = { ...(participant.person ?? {}), sex: index % 2 === 0 ? 'FEMALE' : 'MALE' };
    });
  return fixture;
}

async function gotoParticipants(page: Page, fixture: any) {
  await installApiMocks(page, fixture);
  await gotoTournament(page, fixture, '/participants');
  await expect(page.locator(tabId('Players'))).toBeVisible();
}

test.describe('participants — names-only roster', () => {
  test('renders a roster grid rather than a one-column data table', async ({ page }) => {
    await gotoParticipants(page, withSexes(namesOnly(buildPublishedTournament({ drawSize: 16 }))));

    await expect(page.locator(ROSTER)).toBeVisible();
    // The data grid must be gone entirely, not merely restyled.
    await expect(page.locator(`${sel.playersTable} .tabulator-header`)).toHaveCount(0);
    expect(await page.locator(ROSTER_NAME).count()).toBeGreaterThan(0);
  });

  test('names carry no underline and no cell border', async ({ page }) => {
    await gotoParticipants(page, withSexes(namesOnly(buildPublishedTournament({ drawSize: 16 }))));

    const first = page.locator(ROSTER_NAME).first();
    await expect(first).toBeVisible();
    const style = await first.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        decoration: computed.textDecorationLine,
        borderBottom: computed.borderBottomWidth,
        borderTop: computed.borderTopWidth,
      };
    });
    expect(style.decoration).toBe('none');
    expect(style.borderBottom).toBe('0px');
    expect(style.borderTop).toBe('0px');
  });

  test('flows into multiple columns instead of one tall list', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoParticipants(page, withSexes(namesOnly(buildPublishedTournament({ drawSize: 32 }))));

    await expect(page.locator(ROSTER_NAME).first()).toBeVisible();
    // Multi-column flow means entries share vertical positions across columns.
    const distinctLeftEdges = await page.locator(ROSTER_NAME).evaluateAll((elements) => {
      const lefts = elements.map((element) => Math.round(element.getBoundingClientRect().left));
      return new Set(lefts).size;
    });
    expect(distinctLeftEdges).toBeGreaterThan(1);
  });

  test('groups a mixed field by gender, women first, with counts', async ({ page }) => {
    await gotoParticipants(page, withSexes(namesOnly(buildPublishedTournament({ drawSize: 16 }))));

    const headings = page.locator('.chp-roster__heading');
    await expect(headings).toHaveCount(2);
    await expect(headings.first()).toContainText('Women');
    await expect(headings.nth(1)).toContainText('Men');
  });

  test('renders one unlabelled section when the field is single-gender', async ({ page }) => {
    const fixture = namesOnly(buildPublishedTournament({ drawSize: 16 }));
    fixture.participants.participants
      .filter((participant: any) => participant.participantType === 'INDIVIDUAL')
      .forEach((participant: any) => {
        participant.person = { ...(participant.person ?? {}), sex: 'FEMALE' };
      });
    await gotoParticipants(page, fixture);

    await expect(page.locator(ROSTER)).toBeVisible();
    // A lone "Women" heading over every name tells the reader nothing.
    await expect(page.locator('.chp-roster__heading')).toHaveCount(0);
    expect(await page.locator(ROSTER_NAME).count()).toBeGreaterThan(0);
  });
});

test.describe('participants — multi-column table', () => {
  test('keeps the data table when more than one column is published', async ({ page }) => {
    await gotoParticipants(page, withSexes(buildPublishedTournament({ drawSize: 16 })));

    const table = page.locator(sel.playersTable);
    await expect(table.locator('.tabulator-row').first()).toBeVisible();
    await expect(page.locator(ROSTER)).toHaveCount(0);
  });

  test('groups by gender instead of tinting names pink and blue', async ({ page }) => {
    await gotoParticipants(page, withSexes(buildPublishedTournament({ drawSize: 16 })));

    const groups = page.locator(`${sel.playersTable} .tabulator-group`);
    await expect(groups.first()).toBeVisible();
    // Tabulator orders groups by the sorted data, and the fixture's participant
    // names come from an unseeded mocksEngine — so assert both labels are
    // present rather than which one leads. (The roster path orders sections
    // itself, so `women first` is asserted there instead.)
    const labels = (await groups.allTextContents()).join(' | ');
    expect(labels).toContain('Women');
    expect(labels).toContain('Men');

    // This is the branch where `renderParticipant` runs, so `genderColor` takes
    // effect here. It tints an inner span of `.chc-participant-name` with an
    // inline `color: var(--chc-gender-*)` — assert against that span, not the
    // cell, whose own colour is inherited and neutral either way.
    await expect(page.locator(`${sel.playersTable} [style*="--chc-gender"]`)).toHaveCount(0);

    const nameColors = await page
      .locator(`${sel.playersTable} .chc-participant-name span`)
      .evaluateAll((elements) => Array.from(new Set(elements.map((element) => getComputedStyle(element).color))));
    expect(nameColors.length).toBeLessThanOrEqual(1);
  });

  test('columns fill the table width rather than leaving dead space', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoParticipants(page, withSexes(buildPublishedTournament({ drawSize: 16 })));

    await expect(page.locator(`${sel.playersTable} .tabulator-row`).first()).toBeVisible();
    const { rowWidth, tableWidth } = await page.evaluate(() => {
      const row = document.querySelector('#playersTable .tabulator-row') as HTMLElement;
      // #playersTable IS the tabulator element - Tabulator initialises in place.
      const table = document.querySelector('#playersTable') as HTMLElement;
      return { rowWidth: row.getBoundingClientRect().width, tableWidth: table.getBoundingClientRect().width };
    });
    // fitColumns: the row spans the table instead of stopping at intrinsic width.
    expect(rowWidth).toBeGreaterThan(tableWidth * 0.9);
  });
});

test.describe('app shell — navbar alignment', () => {
  test('navbar items share a left edge with the hero title', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const fixture = buildPublishedTournament({ tournamentName: ALIGNED_CUP });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture);

    await expect(page.locator('.chp-hero__title')).toBeVisible();
    const edges = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector) as HTMLElement;
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const computed = getComputedStyle(element);
        return {
          contentLeft: rect.left + parseFloat(computed.paddingLeft || '0'),
          contentRight: rect.right - parseFloat(computed.paddingRight || '0'),
          left: rect.left,
          width: rect.width,
        };
      };
      return {
        navBar: box('.navbar'),
        navInner: box('.navbar-inner'),
        hero: box('.chp-hero'),
        viewportWidth: window.innerWidth,
      };
    });

    // The bar surface still spans the window...
    expect(edges.navBar!.width).toBe(edges.viewportWidth);
    expect(edges.navBar!.left).toBe(0);
    // ...while its items line up with the hero's content edges.
    expect(Math.round(edges.navInner!.contentLeft)).toBe(Math.round(edges.hero!.contentLeft));
    expect(Math.round(edges.navInner!.contentRight)).toBe(Math.round(edges.hero!.contentRight));
  });

  test('alignment holds on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = buildPublishedTournament({ tournamentName: ALIGNED_CUP });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture);

    await expect(page.locator('.chp-hero__title')).toBeVisible();
    const edges = await page.evaluate(() => {
      const contentLeft = (selector: string) => {
        const element = document.querySelector(selector) as HTMLElement;
        const rect = element.getBoundingClientRect();
        return rect.left + parseFloat(getComputedStyle(element).paddingLeft || '0');
      };
      return { nav: contentLeft('.navbar-inner'), hero: contentLeft('.chp-hero') };
    });
    expect(Math.round(edges.nav)).toBe(Math.round(edges.hero));
  });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`the tab strip starts on the same left edge as the hero (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const fixture = buildPublishedTournament({ tournamentName: ALIGNED_CUP });
      await installApiMocks(page, fixture);
      await gotoTournament(page, fixture);

      const firstTab = page.locator('.tabs li:visible a').first();
      await expect(firstTab).toBeVisible();

      const edges = await page.evaluate(() => {
        const contentLeft = (element: HTMLElement) =>
          element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).paddingLeft || '0');
        const hero = document.querySelector('.chp-hero') as HTMLElement;
        const tab = [...document.querySelectorAll('.tabs li')].find(
          (li) => (li as HTMLElement).offsetParent !== null,
        ) as HTMLElement;
        return { hero: contentLeft(hero), firstTab: tab.getBoundingClientRect().left };
      });

      // The tab's own left edge, not the strip's — a centred strip put the
      // first tab at x=538 against a hero content edge of x=72.
      expect(Math.round(edges.firstTab)).toBe(Math.round(edges.hero));
    });
  }
});
