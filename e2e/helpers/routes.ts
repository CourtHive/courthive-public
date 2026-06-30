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
    // Resolve the requested event from the POST body so multi-event fixtures
    // return the right draw; fall back to the first event.
    const requestedEventId = route.request().postDataJSON()?.eventId;
    const payload = fixture.eventData[requestedEventId] ?? fixture.eventData[fixture.eventId];
    void json(route, payload);
  });

  await page.route(`${API}/factory/scheduledmatchUps`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, opts.scheduleData ?? fixture.scheduleData ?? {});
  });

  await page.route(`${API}/factory/participants`, (route) => {
    if (handledPreflight(route)) return;
    const body = opts.participants ? { success: true, participants: opts.participants } : (fixture.participants ?? { participants: [] });
    void json(route, body);
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

/**
 * Mock the per-tournament scoring-launch config endpoint
 * (`GET /provider/by-tournament/:id/scoring-launch`). Register this AFTER
 * `installApiMocks` so it wins over the broad `/provider/by-tournament/**`
 * branding glob (Playwright matches the most-recently-registered route first).
 * Pass `config: null` to exercise the EPIXODIC default-fallback path.
 */
export async function installScoringLaunchMock(page: Page, tournamentId: string, config: unknown) {
  await page.route(`${API}/provider/by-tournament/${tournamentId}/scoring-launch`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, { success: true, scoringLaunch: config });
  });
}

export interface HiveIDMeMockOptions {
  /** Body for GET /auth/hiveid/me. */
  me: Record<string, unknown>;
  /** Status returned by POST /auth/hiveid/resend-verification (default 'sent'). */
  resendStatus?: 'sent' | 'already_verified';
  /** Body for GET /auth/hiveid/me/participations (defaults to an empty linked list). */
  participations?: { personId: string | null; participations: unknown[] };
  /** Body for GET /me/registrations (defaults to []). */
  registrations?: unknown[];
}

/**
 * Mock the HiveID `/me` REST surface so the My CourtHive page renders against a
 * signed-in identity without a backend. Seed the matching `hiveidSession`
 * localStorage entry via `seedHiveIDSessionInitScript` before navigating.
 */
export async function installHiveIDMeMocks(page: Page, opts: HiveIDMeMockOptions) {
  await page.route(`${API}/auth/hiveid/me`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, opts.me);
  });
  await page.route(`${API}/auth/hiveid/me/participations`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, opts.participations ?? { personId: 'person-e2e', participations: [] });
  });
  await page.route(`${API}/me/registrations`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, opts.registrations ?? []);
  });
  await page.route(`${API}/auth/hiveid/resend-verification`, (route) => {
    if (handledPreflight(route)) return;
    void json(route, { success: true, status: opts.resendStatus ?? 'sent' });
  });
}

export interface VerifyEmailMockOptions {
  /** When false, fail the POST with `status` + `message` to drive the error landing. */
  ok?: boolean;
  contactEmail?: string;
  status?: number;
  message?: string;
}

/** Mock POST /auth/verify-email for the verify-email landing page. */
export async function installVerifyEmailMock(page: Page, opts: VerifyEmailMockOptions = {}) {
  await page.route(`${API}/auth/verify-email`, (route) => {
    if (handledPreflight(route)) return;
    if (opts.ok === false) {
      void json(route, { message: opts.message ?? 'invalid token' }, opts.status ?? 400);
      return;
    }
    void json(route, { success: true, contactEmail: opts.contactEmail ?? 'pat@example.com' });
  });
}

/** localStorage key the public-side HiveID session is stored under. */
const HIVEID_SESSION_KEY = 'hiveidSession';

/**
 * Seed a signed-in HiveID session before the app boots so `/#/me` renders the
 * authenticated shell. Playwright re-runs init scripts on every navigation, so
 * the session survives `page.goto` within a test.
 */
export async function seedHiveIDSessionInitScript(
  page: Page,
  session: Record<string, unknown> = {
    token: 'e2e.hiveid.token',
    refreshToken: 'e2e.refresh',
    personId: 'person-e2e',
    cached: {
      standardGivenName: 'Pat',
      standardFamilyName: 'Player',
      birthDate: '1990-01-01',
      sex: 'MALE',
      nationalityCode: 'USA',
    },
  },
) {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key as string, JSON.stringify(value));
    },
    [HIVEID_SESSION_KEY, session] as const,
  );
}
