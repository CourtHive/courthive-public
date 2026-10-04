import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoringLaunchConfig } from '@courthive/provider-config';

// Mock the identity surface: launchScoring mints a scoped scorer token via
// hiveidApi and reads session presence via hiveidSession.
const mintScorerToken = vi.fn();
const readHiveIDSession = vi.fn();
vi.mock('src/services/hiveidApi', () => ({ mintScorerToken: (...a: any[]) => mintScorerToken(...a) }));
vi.mock('src/services/hiveidSession', () => ({ readHiveIDSession: () => readHiveIDSession() }));
// launchScoring doesn't use tournamentsApi, but importing scoringLaunch pulls it
// in and its module top-level reads globalThis.location.host (unset at import).
vi.mock('src/services/api/tournamentsApi', () => ({ getScoringLaunchByTournament: vi.fn() }));

import { launchScoring } from 'src/services/scoringLaunch';

const ctx = { tournamentId: 't-1', matchUpId: 'm-1' };
const EPIXODIC_CONFIG = { app: 'EPIXODIC' } as ScoringLaunchConfig;
const SESSION_JWT = 'session-jwt';
const SCOPED_TOKEN = 'scoped-score-token';

interface FakeWin {
  opener: unknown;
  location: { href: string };
}
let openedWindows: FakeWin[];
let openArgs: Array<{ url: string; name?: string; features?: string }>;
let locationHash: string;

beforeEach(() => {
  mintScorerToken.mockReset();
  readHiveIDSession.mockReset();
  openedWindows = [];
  openArgs = [];
  locationHash = '';
  (globalThis as any).open = vi.fn((url: string, name?: string, features?: string) => {
    openArgs.push({ url, name, features });
    const win: FakeWin = { opener: {}, location: { href: '' } };
    openedWindows.push(win);
    return win;
  });
  (globalThis as any).location = {
    get hash() {
      return locationHash;
    },
    set hash(v: string) {
      locationHash = v;
    },
  };
});

afterEach(() => vi.restoreAllMocks());

describe('launchScoring', () => {
  it('EMBEDDED stays in-app and never mints a token or opens a tab', async () => {
    readHiveIDSession.mockReturnValue({ token: SESSION_JWT });
    await launchScoring({ app: 'EMBEDDED' } as ScoringLaunchConfig, ctx);
    expect(locationHash).toBe('#/track/t-1/m-1');
    expect(mintScorerToken).not.toHaveBeenCalled();
    expect((globalThis as any).open).not.toHaveBeenCalled();
  });

  it('EPIXODIC + signed-in mints a scoped token and hands THAT off in the URL', async () => {
    readHiveIDSession.mockReturnValue({ token: SESSION_JWT });
    mintScorerToken.mockResolvedValue({ token: SCOPED_TOKEN, expiresAt: 'x' });

    await launchScoring(EPIXODIC_CONFIG, ctx);

    expect(mintScorerToken).toHaveBeenCalledWith({ tournamentId: 't-1', matchUpId: 'm-1' });
    expect(openedWindows).toHaveLength(1);
    const href = openedWindows[0].location.href;
    expect(href).toContain('scorerToken=scoped-score-token');
    // The full session JWT must never appear in the URL.
    expect(href).not.toContain(SESSION_JWT);
    // Reverse-tabnabbing guard.
    expect(openedWindows[0].opener).toBeNull();
  });

  it('EPIXODIC + logged-out launches an anonymous crowd session (no mint, no token)', async () => {
    readHiveIDSession.mockReturnValue(null);
    await launchScoring(EPIXODIC_CONFIG, ctx);
    expect(mintScorerToken).not.toHaveBeenCalled();
    expect(openedWindows[0].location.href).not.toContain('scorerToken');
  });

  it('EPIXODIC + mint failure falls back to an anonymous crowd session', async () => {
    readHiveIDSession.mockReturnValue({ token: SESSION_JWT });
    mintScorerToken.mockRejectedValue(new Error('CFS 500'));
    await launchScoring(EPIXODIC_CONFIG, ctx);
    const href = openedWindows[0].location.href;
    expect(href).not.toContain('scorerToken');
    expect(href).not.toContain(SESSION_JWT);
  });

  it('EPIXODIC + mint returning null (401) falls back to anonymous', async () => {
    readHiveIDSession.mockReturnValue({ token: SESSION_JWT });
    mintScorerToken.mockResolvedValue(null);
    await launchScoring(EPIXODIC_CONFIG, ctx);
    expect(openedWindows[0].location.href).not.toContain('scorerToken');
  });

  it('EXTERNAL with a urlTemplate never mints a token (provider owns identity)', async () => {
    readHiveIDSession.mockReturnValue({ token: SESSION_JWT });
    await launchScoring(
      { app: 'EXTERNAL', urlTemplate: 'https://ion.example/score/{matchUpId}' } as ScoringLaunchConfig,
      ctx,
    );
    expect(mintScorerToken).not.toHaveBeenCalled();
    expect(openedWindows[0].location.href).toContain('ion.example');
  });

  it('falls back to a direct window.open when the synchronous open is blocked', async () => {
    readHiveIDSession.mockReturnValue({ token: SESSION_JWT });
    mintScorerToken.mockResolvedValue({ token: SCOPED_TOKEN, expiresAt: 'x' });
    (globalThis as any).open = vi.fn((url: string, name?: string, features?: string) => {
      openArgs.push({ url, name, features });
      return null; // popup blocked
    });
    await launchScoring(EPIXODIC_CONFIG, ctx);
    // First call is about:blank; the retry carries the resolved href + token.
    const retry = openArgs[openArgs.length - 1];
    expect(retry.url).toContain('scorerToken=scoped-score-token');
  });
});
