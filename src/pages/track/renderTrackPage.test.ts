import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// courthive-components touches `document` at module-import time. Mock it so
// this test can run in courthive-public's no-DOM vitest environment. The
// helpers under test (resolveShareToken, resolveCrowdRelayBaseUrl, toCrowdScoreSnapshot)
// are pure and don't reach into the shell, so a hollow mock is sufficient.
vi.mock('courthive-components', () => ({
  buildInteractiveScoringShell: vi.fn(),
}));

// crowdTracker calls indexedDB at module load — mock it out.
vi.mock('src/services/crowdTracker', () => ({
  saveSession: vi.fn(),
  loadSession: vi.fn(),
}));

// crowdRelay imports socket.io-client which is fine at import time, but the
// test file isn't exercising it here — connectCrowdRelay isn't invoked.
vi.mock('socket.io-client', () => ({ io: vi.fn(), Socket: class {} }));

// tournament info API mocked — not exercised here.
vi.mock('src/services/api/tournamentsApi', () => ({
  getTournamentInfo: vi.fn(),
}));

import { __test__ } from './renderTrackPage';

const { resolveShareToken, resolveCrowdRelayBaseUrl, toCrowdScoreSnapshot, CROWD_RELAY_LOCAL_DEFAULT } = __test__;

interface LocalStorageStub {
  store: Record<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
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

  function stubLocation(host: string, hostname: string): void {
    Object.defineProperty(globalThis, 'location', {
      value: { host, hostname, hash: '' },
      configurable: true,
      writable: true,
    });
  }

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
    stubLocation('courthive.net', 'courthive.net');
    if (!import.meta.env?.VITE_SCORE_RELAY_URL) {
      expect(resolveCrowdRelayBaseUrl()).toBe('https://courthive.net');
    }
  });

  it('exposes CROWD_RELAY_LOCAL_DEFAULT on port 8384 (matches score-relay RELAY_PORT)', () => {
    expect(CROWD_RELAY_LOCAL_DEFAULT).toBe('http://localhost:8384');
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
