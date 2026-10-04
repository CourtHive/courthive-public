import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchProposalRegistration, getAmsBaseUrl } from './amsApi';

function okJson(body: any): any {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  vi.stubGlobal('location', { host: 'localhost:5173', hostname: 'localhost' });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('amsApi', () => {
  it('resolves a localhost AMS base URL (:3130) in dev', () => {
    expect(getAmsBaseUrl()).toContain('3130');
  });

  it('fetches the proposal registration view by tournamentId', async () => {
    const view = { tournamentId: 't1', tournamentName: 'X', registration: { entriesOpen: '2027-01-01' }, events: [] };
    const fetchMock = vi.fn().mockResolvedValue(okJson(view));
    vi.stubGlobal('fetch', fetchMock);
    const res = await fetchProposalRegistration('t1');
    expect(fetchMock.mock.calls[0][0]).toContain('/sanctioning/registration/t1');
    expect(res).toEqual(view);
  });

  it('returns null when the proposal is not found / not open (null body)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => null }));
    expect(await fetchProposalRegistration('t1')).toBeNull();
  });

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await fetchProposalRegistration('t1')).toBeNull();
  });
});
