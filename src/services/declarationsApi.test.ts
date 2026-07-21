import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./hiveidSession', () => ({ readHiveIDSession: vi.fn() }));

import {
  fetchMyAvailability,
  fetchMyRegistration,
  getDeclarationsBaseUrl,
  recordMyConsent,
  saveMyAvailability,
  submitRegistration,
  withdrawRegistration,
  createPartnerInvite,
  fetchPartnerInvite,
  acceptPartnerInvite,
} from './declarationsApi';
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

  it('submitRegistration PUTs the payload to /me/registrations/:tournamentId', async () => {
    (readHiveIDSession as any).mockReturnValue(SESSION);
    const fetchMock = vi.fn().mockResolvedValue(okJson({ status: 'SUBMITTED' }));
    vi.stubGlobal('fetch', fetchMock);
    await submitRegistration('BOBOCA', 't1', { eventIds: ["Men's Singles"] });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/me/registrations/t1?provider=BOBOCA');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ eventIds: ["Men's Singles"] });
  });

  it('fetchMyRegistration returns null when not signed in', async () => {
    (readHiveIDSession as any).mockReturnValue(null);
    expect(await fetchMyRegistration('BOBOCA', 't1')).toBeNull();
  });

  it('withdrawRegistration issues a DELETE', async () => {
    (readHiveIDSession as any).mockReturnValue(SESSION);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await withdrawRegistration('BOBOCA', 't1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  describe('partner invites', () => {
    it('createPartnerInvite POSTs to /partner-invites with provider + body', async () => {
      (readHiveIDSession as any).mockReturnValue(SESSION);
      const fetchMock = vi.fn().mockResolvedValue(okJson({ declarationId: 'inv-1', status: 'INVITED' }));
      vi.stubGlobal('fetch', fetchMock);
      const res = await createPartnerInvite('BOBOCA', { tournamentId: 't1', event: "Men's Doubles", eventId: 'e-md', inviteeEmail: 'p@x.com' });
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/partner-invites?provider=BOBOCA');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ tournamentId: 't1', event: "Men's Doubles", eventId: 'e-md', inviteeEmail: 'p@x.com' });
      expect(res.declarationId).toBe('inv-1');
    });

    it('fetchPartnerInvite reads by token (public, no auth), null on 404', async () => {
      const okMock = vi.fn().mockResolvedValue(okJson({ declarationId: 'inv-1', status: 'INVITED' }));
      vi.stubGlobal('fetch', okMock);
      expect((await fetchPartnerInvite('tok'))?.declarationId).toBe('inv-1');
      expect(okMock.mock.calls[0][0]).toContain('/partner-invites/tok');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
      expect(await fetchPartnerInvite('missing')).toBeNull();
    });

    it('acceptPartnerInvite POSTs to :token/accept with the bearer token', async () => {
      (readHiveIDSession as any).mockReturnValue(SESSION);
      const fetchMock = vi.fn().mockResolvedValue(okJson({ declarationId: 'inv-1', status: 'ACCEPTED' }));
      vi.stubGlobal('fetch', fetchMock);
      const res = await acceptPartnerInvite('tok');
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/partner-invites/tok/accept');
      expect(opts.method).toBe('POST');
      expect(opts.headers.Authorization).toBe('Bearer jwt-1');
      expect(res.status).toBe('ACCEPTED');
    });
  });
});
