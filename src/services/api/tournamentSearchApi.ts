import { getQueryBaseUrl } from './queryBaseUrl';

/**
 * PUBLIC tournament SEARCH, from the read model (courthive-query).
 *
 * WHY. `TournamentList.svelte` filters client-side over the array `fetchProviderCalendar` loaded.
 * For a provider whose calendar fits in the page walk that is right; past it, the box searches the
 * rows that happened to arrive and says nothing about the rest. That is how this site served 500
 * of ALTA's 967 tournaments on 2026-09-17.
 *
 * `GET /tournaments/search` searches every PUBLISHED tournament instead and reports its own total.
 * No auth: the published gate is a SQL predicate on the endpoint, so it cannot serve an
 * unpublished tournament. The contract is `courthive-query/src/modules/query/searchQuery.ts`.
 *
 * Mirrors TMX's `searchTournaments.ts` — same page size, same caps, same "no `paging` block means
 * the whole list" rule so either client can deploy ahead of the service. Keep the two in step.
 */

/** The endpoint's own ceiling (`SEARCH_MAX_LIMIT`); it clamps silently rather than erroring. */
const SEARCH_PAGE_SIZE = 100;

/** Stop here. 20 x 100 = 2,000 hits, well past what anyone reads out of a search box. */
const MAX_SEARCH_PAGES = 20;

export interface TournamentSearchHit {
  tournamentId: string;
  tournamentName: string;
  providerId: string | null;
  startDate: string | null;
  endDate: string | null;
  venueName: string | null;
  city: string | null;
  state: string | null;
  countryCode: string | null;
  entriesOpen: string | null;
  entriesClose: string | null;
  eventCount: number;
  cancelledAt: string | null;
}

export interface TournamentSearchResult {
  tournaments: TournamentSearchHit[];
  /** What the server says it COULD serve — the honest denominator, not `tournaments.length`. */
  total: number;
  /** True when the page cap stopped the walk before the server ran out. */
  truncated: boolean;
}

/**
 * The query string, pure so its encoding can be tested without a network.
 *
 * A blank or whitespace-only value is NO filter rather than a filter matching nothing.
 */
export function buildSearchQueryString({
  q,
  providerId,
  limit,
  offset,
}: {
  q?: string;
  providerId?: string;
  limit: number;
  offset: number;
}): string {
  const query = new URLSearchParams();
  const trimmedQuery = q?.trim();
  const trimmedProvider = providerId?.trim();
  if (trimmedQuery) query.set('q', trimmedQuery);
  if (trimmedProvider) query.set('providerId', trimmedProvider);
  query.set('limit', String(limit));
  query.set('offset', String(offset));
  return `?${query.toString()}`;
}

export async function searchTournaments({
  q,
  providerId,
}: {
  q?: string;
  providerId?: string;
}): Promise<TournamentSearchResult> {
  const tournaments: TournamentSearchHit[] = [];
  let total = 0;
  let offset = 0;
  let truncated = false;

  for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
    const search = buildSearchQueryString({ q, providerId, limit: SEARCH_PAGE_SIZE, offset });
    const response = await fetch(`${getQueryBaseUrl()}/tournaments/search${search}`, {
      headers: { accept: 'application/json' },
    });
    // A failed request must not read as an empty result set: the caller falls back to the loaded
    // rows and would otherwise render "no matches" over a list that is merely unreachable.
    if (!response.ok) throw new Error(`searchTournaments failed: HTTP ${response.status}`);

    const data = (await response.json()) as { tournaments?: TournamentSearchHit[]; paging?: any };
    if (!Array.isArray(data?.tournaments)) break;
    tournaments.push(...data.tournaments);

    const paging = data.paging;
    // A query service predating paging answers in full and reports none.
    if (!paging) {
      total = tournaments.length;
      break;
    }

    total = paging.total ?? tournaments.length;
    // `returned: 0` with `hasMore: true` would be a server bug; treat no progress as the end.
    if (!paging.hasMore || !paging.returned) break;

    offset += paging.returned;
    if (page === MAX_SEARCH_PAGES - 1) truncated = true;
  }

  return { tournaments, total, truncated };
}

/**
 * A hit as the list's own entry shape.
 *
 * The card renders name, dates and an image. A hit has no image — the projection does not carry
 * one — so the card falls back to its placeholder, which is an absence rather than a wrong value.
 * `searchText` is filled so the entry behaves like a calendar entry if anything filters it later.
 */
export function searchHitToEntry(hit: TournamentSearchHit) {
  const location = [hit.city, hit.state, hit.countryCode].filter(Boolean).join(', ');
  return {
    tournamentId: hit.tournamentId,
    searchText: [hit.tournamentName, location].filter(Boolean).join(' ').toLowerCase(),
    tournament: {
      tournamentName: hit.tournamentName,
      startDate: hit.startDate ?? undefined,
      endDate: hit.endDate ?? undefined,
    },
  };
}
