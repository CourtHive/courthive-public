import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// crowdRelay imports socket.io-client; the hub tests inject a fake controller
// through `connect`, so the real client is never reached.
vi.mock('socket.io-client', () => ({ io: vi.fn(), Socket: class {} }));

import {
  __test__,
  createCrowdShareHub,
  resolveCrowdRelayBaseUrl,
  resolveCrowdRelaySocketPath,
  resolveShareToken,
  toCrowdScoreSnapshot,
  trackToggleCopy,
} from './crowdShare';

const { CROWD_RELAY_LOCAL_DEFAULT, RELAY_SOCKET_PATH_DEFAULT, RELAY_SOCKET_PATH_PROXIED, SESSION_ID_KEY_PREFIX } =
  __test__;

interface LocalStorageStub {
  store: Record<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

function installLocalStorage(initial: Record<string, string> = {}): LocalStorageStub {
  const stub: LocalStorageStub = {
    store: { ...initial },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    },
    setItem(key: string, value: string) {
      this.store[key] = value;
    },
    removeItem(key: string) {
      delete this.store[key];
    },
    get length() {
      return Object.keys(this.store).length;
    },
    key(index: number) {
      return Object.keys(this.store)[index] ?? null;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: stub,
    configurable: true,
    writable: true,
  });
  return stub;
}

afterEach(() => {
  // Clean up the localStorage stub between tests
  Object.defineProperty(globalThis, 'localStorage', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

const HIVEID_JWT = 'hiveid-jwt';

describe('resolveShareToken', () => {
  it('returns the admin tmxToken when present (audience: admin, no scorer)', () => {
    installLocalStorage({ tmxToken: 'jwt-abc-123' });
    expect(resolveShareToken()).toEqual({ token: 'jwt-abc-123', audience: 'admin' });
  });

  it('falls back to a HiveID session when tmxToken is absent', () => {
    installLocalStorage({
      hiveidSession: JSON.stringify({
        token: HIVEID_JWT,
        refreshToken: 'rtok',
        personId: 'p-1',
        cached: {
          standardFamilyName: 'Doe',
          standardGivenName: 'Jane',
          birthDate: null,
          sex: null,
          nationalityCode: null,
        },
      }),
    });
    const resolved = resolveShareToken();
    expect(resolved).toMatchObject({
      token: HIVEID_JWT,
      audience: 'hiveid',
      scorer: { personId: 'p-1', displayName: 'Jane Doe', audience: 'hiveid' },
    });
  });

  it('prefers admin tmxToken over HiveID when both are present', () => {
    installLocalStorage({
      tmxToken: 'admin-jwt',
      hiveidSession: JSON.stringify({ token: HIVEID_JWT, refreshToken: 'r', personId: 'p', cached: {} }),
    });
    expect(resolveShareToken()).toEqual({ token: 'admin-jwt', audience: 'admin' });
  });

  it('returns undefined when neither tmxToken nor HiveID is present', () => {
    installLocalStorage({ someOtherKey: 'x' });
    expect(resolveShareToken()).toBeUndefined();
  });

  it('returns undefined when the stored tmxToken is empty AND no HiveID session', () => {
    installLocalStorage({ tmxToken: '' });
    expect(resolveShareToken()).toBeUndefined();
  });

  it('returns undefined when localStorage is unavailable', () => {
    expect(resolveShareToken()).toBeUndefined();
  });

  it('falls back to HiveID gracefully if localStorage.getItem throws on tmxToken', () => {
    let probedHiveID = false;
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => {
          if (key === 'tmxToken') throw new Error('SecurityError');
          if (key === 'hiveidSession') {
            probedHiveID = true;
            return JSON.stringify({
              token: HIVEID_JWT,
              refreshToken: 'rtok',
              personId: 'p-1',
              cached: {
                standardFamilyName: 'Doe',
                standardGivenName: 'Jane',
                birthDate: null,
                sex: null,
                nationalityCode: null,
              },
            });
          }
          return null;
        },
      },
      configurable: true,
      writable: true,
    });
    const resolved = resolveShareToken();
    expect(probedHiveID).toBe(true);
    expect(resolved?.audience).toBe('hiveid');
  });
});

const PROD_HOST = 'courthive.net';

function stubLocation(host: string, hostname: string): void {
  Object.defineProperty(globalThis, 'location', {
    value: { host, hostname, hash: '' },
    configurable: true,
    writable: true,
  });
}

describe('resolveCrowdRelayBaseUrl', () => {
  // import.meta.env is read-only via the proxy; backstop with a vi.stubGlobal
  // is unreliable, so verify the fallback paths instead. Vite injects
  // VITE_SCORE_RELAY_URL into import.meta.env at build time; in test env
  // it's typically undefined which exercises the host-based fallback.
  let originalLocation: any;
  beforeEach(() => {
    originalLocation = globalThis.location;
  });
  afterEach(() => {
    Object.defineProperty(globalThis, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
  });

  it('falls back to the local-default when on localhost and no env var is set', () => {
    stubLocation('localhost:5174', 'localhost');
    const url = resolveCrowdRelayBaseUrl();
    // When VITE_SCORE_RELAY_URL is unset in test env, expect the local default.
    // (If a future change wires the env var into vitest, this test may need
    // to assert against that value instead.)
    if (!import.meta.env?.VITE_SCORE_RELAY_URL) {
      expect(url).toBe(CROWD_RELAY_LOCAL_DEFAULT);
    } else {
      expect(url).toBe(import.meta.env.VITE_SCORE_RELAY_URL.replace(/\/$/, ''));
    }
  });

  it('falls back to https://courthive.net in non-local hosts without env var', () => {
    stubLocation(PROD_HOST, PROD_HOST);
    if (!import.meta.env?.VITE_SCORE_RELAY_URL) {
      expect(resolveCrowdRelayBaseUrl()).toBe('https://courthive.net');
    }
  });

  it('exposes CROWD_RELAY_LOCAL_DEFAULT on port 8384 (matches score-relay RELAY_PORT)', () => {
    expect(CROWD_RELAY_LOCAL_DEFAULT).toBe('http://localhost:8384');
  });
});

describe('resolveCrowdRelaySocketPath', () => {
  let originalLocation: any;
  beforeEach(() => {
    originalLocation = globalThis.location;
  });
  afterEach(() => {
    Object.defineProperty(globalThis, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
  });

  it('uses the default /socket.io/ path on localhost', () => {
    stubLocation('localhost:5174', 'localhost');
    if (!import.meta.env?.VITE_SCORE_RELAY_URL) {
      expect(resolveCrowdRelaySocketPath()).toBe(RELAY_SOCKET_PATH_DEFAULT);
    }
  });

  it('uses the nginx-proxied /relay/socket.io/ path on prod hosts without an env override', () => {
    // Regression: a default-path handshake to https://courthive.net lands on
    // CFS (no /crowd namespace) → "Invalid namespace"; the relay is reachable
    // only under /relay/.
    stubLocation(PROD_HOST, PROD_HOST);
    if (!import.meta.env?.VITE_SCORE_RELAY_URL) {
      expect(resolveCrowdRelaySocketPath()).toBe(RELAY_SOCKET_PATH_PROXIED);
      expect(RELAY_SOCKET_PATH_PROXIED).toBe('/relay/socket.io/');
    }
  });
});

describe('toCrowdScoreSnapshot', () => {
  it('maps a populated matchUp score into the relay snapshot shape', () => {
    const matchUp: any = {
      winningSide: 1,
      score: {
        scoreStringSide1: '6-4 6-2',
        sets: [
          { setNumber: 1, side1Score: 6, side2Score: 4, winningSide: 1 },
          { setNumber: 2, side1Score: 6, side2Score: 2, winningSide: 1 },
        ],
      },
    };
    const snap = toCrowdScoreSnapshot(matchUp);
    expect(snap.scoreboard).toBe('6-4 6-2');
    expect(snap.winningSide).toBe(1);
    expect(snap.sets).toHaveLength(2);
    expect(snap.sets?.[0]).toMatchObject({ setNumber: 1, side1Score: 6, side2Score: 4, winningSide: 1 });
  });

  it('omits sets when the matchUp has no score.sets array', () => {
    expect(toCrowdScoreSnapshot({}).sets).toBeUndefined();
    expect(toCrowdScoreSnapshot(null).sets).toBeUndefined();
  });

  it('extracts pointDisplay from the active set when side*PointScore is present', () => {
    const matchUp: any = {
      score: {
        sets: [{ setNumber: 1, side1Score: 2, side2Score: 1, side1PointScore: '40', side2PointScore: '30' }],
      },
    };
    expect(toCrowdScoreSnapshot(matchUp).pointDisplay).toEqual(['40', '30']);
  });

  it('omits pointDisplay when the active set does not carry point scores', () => {
    const matchUp: any = {
      score: { sets: [{ setNumber: 1, side1Score: 2, side2Score: 1 }] },
    };
    expect(toCrowdScoreSnapshot(matchUp).pointDisplay).toBeUndefined();
  });

  it('zero-fills missing side scores rather than emitting undefined', () => {
    const matchUp: any = { score: { sets: [{ setNumber: 1 }] } };
    expect(toCrowdScoreSnapshot(matchUp).sets?.[0]).toMatchObject({ side1Score: 0, side2Score: 0 });
  });
});

describe('trackToggleCopy', () => {
  it('invites a signed-out visitor to sign in and never claims to share', () => {
    const copy = trackToggleCopy({ active: true });
    expect(copy.label).toBe('Track');
    expect(copy.hint).toMatch(/Sign in with HiveID or TMX/);
  });

  it('names the HiveID scorer and marks the active toggle as sharing', () => {
    const sharingAs = resolvedHiveID();
    expect(trackToggleCopy({ active: true, sharingAs })).toEqual({
      label: 'Track · Sharing',
      hint: 'Scores you enter are shared with the tournament director as Jane Doe as an unofficial feed.',
    });
    expect(trackToggleCopy({ active: false, sharingAs }).label).toBe('Track');
  });
});

function resolvedHiveID(): any {
  return {
    token: HIVEID_JWT,
    audience: 'hiveid',
    scorer: { personId: 'p-1', displayName: 'Jane Doe', audience: 'hiveid' },
  };
}

const TOURNAMENT_ID = 't-1';
const MATCHUP_ID = 'm-1';
const FORMAT = 'SET3-S:6/TB7';

function fakeController() {
  const listeners: Record<string, (payload: any) => void> = {};
  return {
    submit: vi.fn(),
    end: vi.fn(),
    disconnect: vi.fn(),
    isConnected: () => true,
    on: vi.fn((event: string, listener: (payload: any) => void) => {
      listeners[event] = listener;
      return () => undefined;
    }),
    emit: (event: string, payload: any) => listeners[event]?.(payload),
  };
}

function games(side1Score: number, side2Score: number): any {
  return { matchUpFormat: FORMAT, score: { sets: [{ setNumber: 1, side1Score, side2Score }] } };
}

describe('createCrowdShareHub', () => {
  it('sends nothing and opens no connection for a signed-out visitor', () => {
    installLocalStorage();
    const connect = vi.fn();
    const hub = createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(1, 0) });
    expect(connect).not.toHaveBeenCalled();
    expect(hub.sharingAs()).toBeUndefined();
  });

  it('relays each scored change with the inferred winner, one session per matchUp', () => {
    installLocalStorage({ tmxToken: 'admin-jwt' });
    const controller = fakeController();
    const connect = vi.fn(() => controller as any);
    const hub = createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect });

    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(1, 0) });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(1, 1) });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith('admin-jwt');
    const [first, second] = controller.submit.mock.calls.map(([params]) => params);
    expect(first).toMatchObject({ matchUpId: MATCHUP_ID, tournamentId: TOURNAMENT_ID, formatHint: FORMAT });
    expect(first.point.winner).toBe(1);
    expect(second.point.winner).toBe(2);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.currentScore.sets[0]).toMatchObject({ side1Score: 1, side2Score: 1 });
  });

  it('skips a change with no detectable winner (an undo) instead of inventing a point', () => {
    installLocalStorage({ tmxToken: 'admin-jwt' });
    const controller = fakeController();
    const hub = createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect: () => controller as any });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(2, 0) });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(1, 0) });
    expect(controller.submit).toHaveBeenCalledTimes(1);
  });

  it('attributes a HiveID visitor as the scorer', () => {
    installLocalStorage({
      hiveidSession: JSON.stringify({ token: HIVEID_JWT, refreshToken: 'r', personId: 'p-1', cached: {} }),
    });
    const controller = fakeController();
    const hub = createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect: () => controller as any });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(1, 0) });
    expect(controller.submit.mock.calls[0][0].scorer).toMatchObject({ personId: 'p-1', audience: 'hiveid' });
  });

  it('resumes the same relay session after a reload', () => {
    const storage = installLocalStorage({ tmxToken: 'admin-jwt' });
    const first = fakeController();
    createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect: () => first as any }).relayScore({
      matchUpId: MATCHUP_ID,
      matchUp: games(1, 0),
    });
    const sessionId = first.submit.mock.calls[0][0].sessionId;
    expect(storage.store[`${SESSION_ID_KEY_PREFIX}${TOURNAMENT_ID}:${MATCHUP_ID}`]).toBe(sessionId);

    const second = fakeController();
    createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect: () => second as any }).relayScore({
      matchUpId: MATCHUP_ID,
      matchUp: games(2, 0),
    });
    expect(second.submit.mock.calls[0][0].sessionId).toBe(sessionId);
  });

  it('opens a fresh session after the TD finalizes the old one', () => {
    installLocalStorage({ tmxToken: 'admin-jwt' });
    const controller = fakeController();
    const hub = createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect: () => controller as any });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(1, 0) });
    const finalized = controller.submit.mock.calls[0][0].sessionId;

    controller.emit('rejected', { sessionId: finalized, reason: 'session-cancelled-by-td-finalize' });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(2, 0) });
    expect(controller.submit.mock.calls[1][0].sessionId).not.toBe(finalized);
  });

  it('keeps the session through a version conflict (the relay resumes at its own version)', () => {
    installLocalStorage({ tmxToken: 'admin-jwt' });
    const controller = fakeController();
    const hub = createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect: () => controller as any });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(1, 0) });
    const sessionId = controller.submit.mock.calls[0][0].sessionId;

    controller.emit('rejected', { sessionId, reason: 'version-conflict' });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(2, 0) });
    expect(controller.submit.mock.calls[1][0].sessionId).toBe(sessionId);
  });

  it('disconnects on demand and reconnects on the next scored change', () => {
    installLocalStorage({ tmxToken: 'admin-jwt' });
    const controllers = [fakeController(), fakeController()];
    const connect = vi.fn(() => controllers[connect.mock.calls.length - 1] as any);
    const hub = createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect });
    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(1, 0) });
    hub.disconnect();
    expect(controllers[0].disconnect).toHaveBeenCalled();

    hub.relayScore({ matchUpId: MATCHUP_ID, matchUp: games(2, 0) });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(controllers[1].submit).toHaveBeenCalledTimes(1);
  });

  it('a new hub closes the previous hub so no socket outlives its render', () => {
    installLocalStorage({ tmxToken: 'admin-jwt' });
    const previous = fakeController();
    createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect: () => previous as any }).relayScore({
      matchUpId: MATCHUP_ID,
      matchUp: games(1, 0),
    });
    createCrowdShareHub({ tournamentId: TOURNAMENT_ID, connect: vi.fn() });
    expect(previous.disconnect).toHaveBeenCalled();
  });
});
