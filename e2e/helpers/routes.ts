// constants and types
import { PublicTournamentFixture } from './fixtures';
import { Page, Route } from '@playwright/test';

/**
 * Installs hermetic API mocks for a courthive-public page.
 *
 * The public viewer talks to the competition-factory-server cross-origin
 * (dev server on :5174, API base resolves to :8383), so every fulfilled
 * response must carry CORS headers and OPTIONS preflights must be answered —
 * otherwise the browser blocks the XHR before the app ever sees it.
 *
 * Pass a fixture from `buildPublishedTournament()`. Endpoints with no
 * fixture-specific data return benign empty payloads so the app renders its
 * read-only views without hitting a real backend. The live Socket.IO channel
 * is aborted and the i18n manifest reports no extra locales, so the app stays
 * on its bundled English strings (live scores are optional).
 */

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Answer a CORS preflight; return true if the request was the preflight. */
function handledPreflight(route: Route): boolean {
  if (route.request().method() === 'OPTIONS') {
    void route.fulfill({ status: 204, headers: CORS_HEADERS });
    return true;
  }
  return false;
}

export interface MockOptions {
  /** Override the schedule payload (ScheduleData). Defaults to an empty schedule. */
  scheduleData?: unknown;
  /** Override the participants payload. Defaults to `eventData.participants`. */
  participants?: unknown[];
}

/**
 * API origin the public app targets in dev. `baseApi.ts` hardcodes
 * `http://localhost:8383` whenever the page host is localhost (regardless of
 * VITE_SERVER), so all REST + Socket.IO traffic lands here. Scoping every mock
 * to this origin is essential: a host-agnostic glob for the i18n locale path
 * also matches Vite-served modules on :5174 (e.g. `/src/i18n/locales/en.json`),
 * and returning JSON for a module request crashes app boot.
 */
const API = 'http://localhost:8383';

export async function installApiMocks(page: Page, fixture: PublicTournamentFixture, opts: MockOptions = {}) {
  // Kill the live Socket.IO channel — no server in hermetic mode.
  await page.route(`${API}/socket.io/**`, (route) => route.abort());

  // i18n: report no extra locales so the app stays on the bundled English
  // strings and never fires a locale fetch.
  await page.route(`${API}/i18n/manifest`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, { locales: [] });
  });
  await page.route(`${API}/i18n/locales/**`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, {});
  });

  await page.route(`${API}/factory/tournamentinfo`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, fixture.tournamentInfo);
  });

  await page.route(`${API}/factory/eventdata`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, fixture.eventData);
  });

  await page.route(`${API}/factory/scheduledmatchUps`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, opts.scheduleData ?? {});
  });

  await page.route(`${API}/factory/participants`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, { participants: opts.participants ?? fixture.eventData?.participants ?? [] });
  });

  await page.route(`${API}/factory/version`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, { version: 'e2e-hermetic' });
  });

  // Provider branding is fire-and-forget; defaults apply when it returns empty.
  await page.route(`${API}/provider/by-tournament/**`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, { branding: null });
  });

  await page.route(`${API}/provider/calendar`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, { calendar: [] });
  });
}

/** Navigate to a tournament's default view and wait for the title to hydrate. */
export async function gotoTournament(page: Page, fixture: PublicTournamentFixture, subPath = '') {
  await page.goto(`/#/tournament/${fixture.tournamentId}${subPath}`);
}
