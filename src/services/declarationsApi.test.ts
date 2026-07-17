import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./hiveidSession', () => ({ readHiveIDSession: vi.fn() }));

import { fetchMyAvailability, getDeclarationsBaseUrl, recordMyConsent, saveMyAvailability } from './declarationsApi';
import { readHiveIDSession } from './hiveidSession';

const SESSION: any = { token: 'jwt-1', personId: 'p1', cached: {} };

function okJson(body: any): any {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  // vitest runs in node (no DOM); provide a localhost location so the base-URL
  // resolver takes the dev branch.
  vi.stubGlobal('location', { host: 'localhost:5173', hostname: 'localhost' });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('declarationsApi', () => {
  it('returns null when not signed in', async () => {
    (readHiveIDSession as any).mockReturnValue(null);
    expect(await fetchMyAvailability('BOBOCA')).toBeNull();
  });

  it('sends the HiveID bearer token and provider query on GET', async () => {
    (readHiveIDSession as any).mockReturnValue(SESSION);
    const fetchMock = vi.fn().mockResolvedValue(okJson({ personId: 'p1' }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchMyAvailability('BOBOCA');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/me/availability?provider=BOBOCA');
    expect(opts.headers.Authorization).toBe('Bearer jwt-1');
  });

  it('PUTs the availability payload', async () => {
    (readHiveIDSession as any).mockReturnValue(SESSION);
    const fetchMock = vi.fn().mockResolvedValue(okJson({ status: 'CURRENT' }));
    vi.stubGlobal('fetch', fetchMock);

    const payload = { span: { from: '2026-08-10', to: '2026-08-16' }, days: {} };
    await saveMyAvailability('BOBOCA', payload as any);

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual(payload);
  });

  it('surfaces the service error code on consent rejection', async () => {
    (readHiveIDSession as any).mockReturnValue(SESSION);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ code: 'PARENTAL_CONSENT_REQUIRED' }) }),
    );
    await expect(recordMyConsent('BOBOCA', { consentVersion: 'v1' })).rejects.toThrow('PARENTAL_CONSENT_REQUIRED');
  });

  it('resolves a localhost declarations base URL in dev', () => {
    expect(getDeclarationsBaseUrl()).toContain('3120');
  });
});
