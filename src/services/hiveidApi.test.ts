/**
 * Which origin the HiveID account calls go to. Production serves both CFS and the identity provider from
 * courthive.net (nginx routes `/auth/*` to hiveid); locally they are different ports, so the account calls
 * must not share CFS's base.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuthBaseUrl, getCfsBaseUrl } from './hiveidApi';

const at = (host: string) => vi.stubGlobal('location', { host, hostname: host.split(':')[0] });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getAuthBaseUrl', () => {
  it('is courthive.net in production, the same origin as CFS', () => {
    vi.stubEnv('VITE_AUTH_SERVER', '');
    at('courthive.net');
    expect(getAuthBaseUrl()).toBe('https://courthive.net');
    expect(getCfsBaseUrl()).toBe('https://courthive.net');
  });

  it("is hiveid's own port locally, not CFS's", () => {
    vi.stubEnv('VITE_AUTH_SERVER', '');
    at('localhost:5174');
    expect(getAuthBaseUrl()).toBe('http://localhost:3140');
    expect(getCfsBaseUrl()).toBe('http://localhost:8383');
  });

  it('honours VITE_AUTH_SERVER, and window.dev.authURL above it', () => {
    vi.stubEnv('VITE_AUTH_SERVER', 'http://localhost:13140');
    at('localhost:5174');
    expect(getAuthBaseUrl()).toBe('http://localhost:13140');
    vi.stubGlobal('dev', { authURL: 'http://override.test' });
    expect(getAuthBaseUrl()).toBe('http://override.test');
  });
});
