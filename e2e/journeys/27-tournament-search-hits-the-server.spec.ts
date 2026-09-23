import { test, expect } from '@playwright/test';

/**
 * Journey 27 — the provider listing's search box searches the CORPUS, not the page it loaded.
 *
 * `TournamentList.svelte` filtered the array `fetchProviderCalendar` had loaded. For a provider
 * whose calendar fits in the walk that is right; past it, the box searches the rows that happened
 * to arrive and says nothing about the rest — which is how this site served 500 of ALTA's 967
 * tournaments on 2026-09-17.
 *
 * The box now asks courthive-query's `GET /tournaments/search`, scoped to the provider's
 * `organisationId`, and the list reports the SERVER's total rather than the rows on screen.
 *
 * WHY IT IS DETERMINISTIC. Both endpoints are stubbed here, and the two sources use disjoint names
 * — so "which rows are on screen" answers "which source rendered them" with no timing assumption.
 */

const API = 'http://localhost:8383';
/** `getQueryBaseUrl()` resolves the read model to :3150 on localhost / 127.0.0.1. */
const QUERY = 'http://localhost:3150';

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,accept',
};

const PROVIDER_ABBR = 'E2ES';
const PROVIDER_ID = 'e2e-search-provider';
const CALENDAR_PREFIX = 'E2E Calendar Only Tournament';
const SEARCH_PREFIX = 'E2E Search Result Tournament';
const CARD = '.tournament-card__name';
const NOTICE = '.tournament-list__notice';
const SEARCH_INPUT = '.tournament-search__input';
const SERVER_TOTAL = 967;

function json(route: any, body: unknown) {
  return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

const calendarBody = {
  success: true,
  calendar: {
    provider: {
      organisationId: PROVIDER_ID,
      organisationName: 'E2E Search Provider',
      organisationAbbreviation: PROVIDER_ABBR,
    },
    tournaments: Array.from({ length: 2 }, (_, i) => ({
      tournamentId: `cal-${i}`,
      tournament: { tournamentName: `${CALENDAR_PREFIX} ${i}`, startDate: '2026-09-01', endDate: '2026-09-03' },
    })),
  },
  paging: { limit: 500, offset: 0, total: 2, returned: 2, hasMore: false },
};

/** The discovery projection's flat row — NOT a tournament record. */
const searchBody = {
  tournaments: Array.from({ length: 3 }, (_, i) => ({
    tournamentId: `hit-${i}`,
    tournamentName: `${SEARCH_PREFIX} ${i}`,
    providerId: PROVIDER_ID,
    startDate: '2027-05-01',
    endDate: '2027-05-03',
    venueName: null,
    city: 'Brno',
    state: null,
    countryCode: 'CZE',
    entriesOpen: null,
    entriesClose: null,
    eventCount: 2,
    cancelledAt: null,
  })),
  paging: { total: SERVER_TOTAL, returned: 3, limit: 100, offset: 0, hasMore: false },
};

test.describe('Journey 27 — provider listing search asks the server', () => {
  test('a query renders server hits and reports the server total; clearing it restores the list', async ({ page }) => {
    const searchUrls: string[] = [];

    await page.route(`${API}/socket.io/**`, (route) => route.abort());
    await page.route(`${API}/provider/calendar`, (route) =>
      route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: CORS }) : json(route, calendarBody),
    );
    await page.route(`${QUERY}/tournaments/search*`, (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      searchUrls.push(route.request().url());
      return json(route, searchBody);
    });

    await page.goto(`/#/tournaments/${PROVIDER_ABBR}`);

    // Baseline: the two calendar rows, and no notice about a server total.
    await expect(page.locator(CARD).filter({ hasText: CALENDAR_PREFIX })).toHaveCount(2);

    await page.locator(SEARCH_INPUT).click();
    await page.locator(SEARCH_INPUT).pressSequentially('search result', { delay: 20 });

    // The server's rows replace the loaded ones …
    await expect(page.locator(CARD).filter({ hasText: SEARCH_PREFIX })).toHaveCount(3);
    // … entirely, so this is a replacement and not a merge.
    await expect(page.locator(CARD).filter({ hasText: CALENDAR_PREFIX })).toHaveCount(0);
    // … and the count shown is the SERVER's, not the three rows rendered.
    await expect(page.locator(NOTICE)).toContainText(String(SERVER_TOTAL));

    // Scoped to this provider, by organisationId rather than the abbreviation in the URL.
    expect(searchUrls.length, 'no search request was issued').toBeGreaterThan(0);
    const issued = new URL(searchUrls[searchUrls.length - 1]);
    expect(issued.searchParams.get('q')).toBe('search result');
    expect(issued.searchParams.get('providerId')).toBe(PROVIDER_ID);

    // Debounced: one request for the phrase, not one per character.
    expect(searchUrls.length, 'the search box is not debounced').toBe(1);

    // Clearing goes back to the loaded rows.
    await page.locator(SEARCH_INPUT).press('ControlOrMeta+a');
    await page.locator(SEARCH_INPUT).press('Backspace');
    await expect(page.locator(CARD).filter({ hasText: CALENDAR_PREFIX })).toHaveCount(2);
    await expect(page.locator(CARD).filter({ hasText: SEARCH_PREFIX })).toHaveCount(0);
  });

  test('renders a hit the CLIENT could not have matched, proving nothing re-filters the answer', async ({ page }) => {
    // The server decides what matches, and it knows things the rendered row does not: the name
    // predicate is a trigram ILIKE over the whole published corpus, so "muller" legitimately
    // matches "Müller Open". If the client re-applied the query to the server's answer — the
    // obvious-looking thing to do, since the box still holds the text — this row would vanish and
    // the user would see "no results" for a search that HAD results.
    await page.route(`${API}/socket.io/**`, (route) => route.abort());
    await page.route(`${API}/provider/calendar`, (route) =>
      route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: CORS }) : json(route, calendarBody),
    );
    await page.route(`${QUERY}/tournaments/search*`, (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: CORS })
        : json(route, {
            tournaments: [{ ...searchBody.tournaments[0], tournamentId: 'hit-umlaut', tournamentName: 'Müller Open' }],
            paging: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false },
          }),
    );

    await page.goto(`/#/tournaments/${PROVIDER_ABBR}`);
    await expect(page.locator(CARD).filter({ hasText: CALENDAR_PREFIX })).toHaveCount(2);

    await page.locator(SEARCH_INPUT).click();
    await page.locator(SEARCH_INPUT).pressSequentially('muller', { delay: 20 });

    await expect(page.locator(CARD).filter({ hasText: 'Müller Open' })).toHaveCount(1);
  });

  test('a failed search says so instead of rendering an empty list as the answer', async ({ page }) => {
    await page.route(`${API}/socket.io/**`, (route) => route.abort());
    await page.route(`${API}/provider/calendar`, (route) =>
      route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: CORS }) : json(route, calendarBody),
    );
    await page.route(`${QUERY}/tournaments/search*`, (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: CORS })
        : route.fulfill({ status: 503, headers: { ...CORS, 'content-type': 'application/json' }, body: '{}' }),
    );

    await page.goto(`/#/tournaments/${PROVIDER_ABBR}`);
    await expect(page.locator(CARD).filter({ hasText: CALENDAR_PREFIX })).toHaveCount(2);

    // A term the LOADED rows match, so the local fallback is observable rather than coincidentally
    // empty: when the service is unreachable the box keeps filtering what the calendar walk
    // returned, which is exactly what the notice promises.
    await page.locator(SEARCH_INPUT).click();
    await page.locator(SEARCH_INPUT).pressSequentially('calendar only', { delay: 20 });

    // The user is told the search failed — an empty list would read as "no such tournament".
    await expect(page.locator(NOTICE)).toContainText('unavailable');
    // And the loaded rows are still searchable, locally.
    await expect(page.locator(CARD).filter({ hasText: CALENDAR_PREFIX })).toHaveCount(2);
  });
});
