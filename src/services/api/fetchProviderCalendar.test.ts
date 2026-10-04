import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('./baseApi', () => ({ baseApi: { post } }));

const { fetchProviderCalendar } = await import('./tournamentsApi');

/**
 * `/provider/calendar` became paged in competition-factory-server #974. This call site
 * previously issued ONE request and rendered whatever came back, so the day the server began
 * capping at 500 two real providers lost tournaments from the public listing without any
 * visible sign: ALTA served 500 of 967, HTS 500 of 533.
 */

function page({ tournaments, paging, provider = { organisationAbbreviation: 'ALTA' } }: any) {
  return { data: { calendar: { provider, tournaments }, paging } };
}

const rows = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ tournamentId: `${prefix}-${i}` }));

describe('fetchProviderCalendar', () => {
  beforeEach(() => post.mockReset());

  it('walks every page — the ALTA case, 967 across two requests', () => {
    post
      .mockResolvedValueOnce(page({ tournaments: rows(500, 'a'), paging: { total: 967, returned: 500, hasMore: true } }))
      .mockResolvedValueOnce(page({ tournaments: rows(467, 'b'), paging: { total: 967, returned: 467, hasMore: false } }));

    return fetchProviderCalendar({ providerAbbr: 'ALTA' }).then((result) => {
      expect(result.tournaments).toHaveLength(967);
      expect(result.truncated).toBe(false);
      expect(post).toHaveBeenCalledTimes(2);
      expect(post).toHaveBeenLastCalledWith('/provider/calendar', {
        providerAbbr: 'ALTA',
        limit: 500,
        offset: 500,
      });
    });
  });

  it('stops after one request when the server says there is no more', async () => {
    post.mockResolvedValueOnce(page({ tournaments: rows(12, 'a'), paging: { total: 12, returned: 12, hasMore: false } }));

    const result = await fetchProviderCalendar({ providerAbbr: 'FTK' });

    expect(result.tournaments).toHaveLength(12);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('takes an UNPAGED response from an older server as the whole list', async () => {
    // Either side may deploy first; a server without paging must not send this into a loop.
    post.mockResolvedValueOnce(page({ tournaments: rows(700, 'a'), paging: undefined }));

    const result = await fetchProviderCalendar({ providerAbbr: 'ALTA' });

    expect(result.tournaments).toHaveLength(700);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('reports truncation rather than presenting a partial list as complete', async () => {
    post.mockResolvedValue(page({ tournaments: rows(500, 'a'), paging: { total: 99999, returned: 500, hasMore: true } }));

    const result = await fetchProviderCalendar({ providerAbbr: 'BIG' });

    expect(post).toHaveBeenCalledTimes(20);
    expect(result.truncated).toBe(true);
    expect(result.tournaments).toHaveLength(10000);
  });

  it('terminates when a server claims more but returns nothing', async () => {
    post.mockResolvedValue(page({ tournaments: [], paging: { total: 10, returned: 0, hasMore: true } }));

    const result = await fetchProviderCalendar({ providerAbbr: 'ODD' });

    expect(post).toHaveBeenCalledTimes(1);
    expect(result.tournaments).toEqual([]);
  });

  it('carries the provider block through from the first page', async () => {
    post.mockResolvedValueOnce(page({ tournaments: rows(1, 'a'), paging: { total: 1, returned: 1, hasMore: false } }));

    const result = await fetchProviderCalendar({ providerAbbr: 'ALTA' });

    expect(result.provider).toEqual({ organisationAbbreviation: 'ALTA' });
  });

  it('survives a calendar-less response without throwing', async () => {
    post.mockResolvedValueOnce({ data: {} });

    const result = await fetchProviderCalendar({ providerAbbr: 'GONE' });

    expect(result.tournaments).toEqual([]);
  });
});
