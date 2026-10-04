import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSearchQueryString, searchHitToEntry, searchTournaments } from './tournamentSearchApi';

/**
 * The listing filters client-side over the rows the calendar walk loaded. Past one page that is a
 * lie — this site served 500 of ALTA's 967 tournaments on 2026-09-17. These tests pin the two
 * properties that make searching the SERVER honest: every page is walked, and the total reported is
 * the server's rather than whatever happened to arrive.
 */

const hits = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({ tournamentId: `${prefix}-${i}`, tournamentName: `${prefix} ${i}` }));

function response(body: any, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) } as any;
}

describe('searchTournaments', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    // `getQueryBaseUrl` reads location; localhost resolves to the dev port, which is all this needs.
    vi.stubGlobal('location', { host: 'localhost:5273', hostname: 'localhost' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('walks every page — the ALTA case, 967 hits across ten requests', async () => {
    for (let i = 0; i < 9; i++) {
      fetchMock.mockResolvedValueOnce(
        response({ tournaments: hits(100, `p${i}`), paging: { total: 967, returned: 100, hasMore: true } }),
      );
    }
    fetchMock.mockResolvedValueOnce(
      response({ tournaments: hits(67, 'last'), paging: { total: 967, returned: 67, hasMore: false } }),
    );

    const result = await searchTournaments({ providerId: 'alta-id' });

    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(result.tournaments).toHaveLength(967);
    expect(result.total).toBe(967);
    expect(result.truncated).toBe(false);
  });

  it('reports the SERVER total, not the number of rows it loaded', async () => {
    fetchMock.mockResolvedValueOnce(
      response({ tournaments: hits(100, 'a'), paging: { total: 4_212, returned: 100, hasMore: false } }),
    );

    const result = await searchTournaments({ q: 'spring' });

    expect(result.tournaments).toHaveLength(100);
    expect(result.total).toBe(4_212);
  });

  it('advances the offset by what the server actually returned', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ tournaments: hits(100, 'a'), paging: { total: 150, returned: 100, hasMore: true } }))
      .mockResolvedValueOnce(response({ tournaments: hits(50, 'b'), paging: { total: 150, returned: 50, hasMore: false } }));

    await searchTournaments({ q: 'open' });

    expect(fetchMock.mock.calls[0][0]).toContain('offset=0');
    expect(fetchMock.mock.calls[1][0]).toContain('offset=100');
  });

  it('treats a response with NO paging block as the whole list, so the client can deploy first', async () => {
    fetchMock.mockResolvedValue(response({ tournaments: hits(3, 'only') }));

    const result = await searchTournaments({ q: 'open' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(3);
  });

  it('stops when a page reports hasMore with no progress, rather than looping to the cap', async () => {
    fetchMock.mockResolvedValue(response({ tournaments: [], paging: { total: 99, returned: 0, hasMore: true } }));

    await searchTournaments({ q: 'open' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says so when the page cap stops the walk early', async () => {
    fetchMock.mockResolvedValue(
      response({ tournaments: hits(100, 'x'), paging: { total: 10_000, returned: 100, hasMore: true } }),
    );

    const result = await searchTournaments({ q: 'a' });

    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(result.truncated).toBe(true);
  });

  it('THROWS on an HTTP error instead of reporting zero matches', async () => {
    fetchMock.mockResolvedValueOnce(response({}, false, 503));
    // "no matches" and "the service is down" must not look the same: the caller falls back to the
    // rows it already has, and would otherwise render an empty list as an answer.
    await expect(searchTournaments({ q: 'open' })).rejects.toThrow('HTTP 503');
  });
});

describe('buildSearchQueryString', () => {
  it('always bounds the request', () => {
    const search = buildSearchQueryString({ limit: 100, offset: 0 });
    expect(search).toContain('limit=100');
    expect(search).toContain('offset=0');
  });

  it('treats a blank or whitespace-only value as NO filter', () => {
    const search = buildSearchQueryString({ q: '  ', providerId: '', limit: 100, offset: 0 });
    expect(search).not.toContain('q=');
    expect(search).not.toContain('providerId');
  });

  it('trims and encodes what it sends', () => {
    const search = buildSearchQueryString({ q: '  A&B Open  ', limit: 100, offset: 0 });
    expect(search).not.toContain('A&B');
    expect(new URLSearchParams(search).get('q')).toBe('A&B Open');
  });
});

describe('searchHitToEntry', () => {
  const hit = (over: any = {}) =>
    ({
      tournamentId: 't-1',
      tournamentName: 'Riverside Open',
      providerId: 'p-1',
      startDate: '2027-05-01',
      endDate: '2027-05-03',
      venueName: null,
      city: null,
      state: null,
      countryCode: null,
      entriesOpen: null,
      entriesClose: null,
      eventCount: 0,
      cancelledAt: null,
      ...over,
    }) as any;

  it('keeps the calendar days as days, never as instants', () => {
    const entry = searchHitToEntry(hit());
    expect(entry.tournament.startDate).toBe('2027-05-01');
    expect(entry.tournament.endDate).toBe('2027-05-03');
  });

  it('builds a lowercased haystack of name and location', () => {
    const entry = searchHitToEntry(hit({ city: 'Brno', countryCode: 'CZE' }));
    expect(entry.searchText).toBe('riverside open brno, cze');
  });

  it('omits an absent location rather than leaving its separators behind', () => {
    expect(searchHitToEntry(hit()).searchText).toBe('riverside open');
  });
});
