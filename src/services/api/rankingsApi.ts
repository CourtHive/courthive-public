// Reads against the stored ranking artifacts, through the CFS rankings proxy.
//
// TWO SOURCES, AND THE DIFFERENCE MATTERS. `/api/rankings/bundle` — which
// renderRankingsPage uses for the standings themselves — is a LIVE aggregation
// over point_awards: it is computed at request time, stamps its own `asOfDate`
// from the wall clock, and is never persisted. It is the right thing for "who
// leads right now" and it cannot answer "where was I in August", because no
// version of it is kept.
//
// The endpoints here read the stored artifacts instead: `ranking_snapshots` +
// `ranking_entries`, one dated instance per list per publication. That is what
// makes a history exist at all, and `snapshotId` is the link from a history row
// back to the full list the rank appears on.
//
// Both are reachable only because they are mounted under `rankings` upstream:
// the proxy rewrites /api/rankings/<tail> to /rankings/<tail>, so a service
// route mounted anywhere else is invisible from here.

const RANKINGS_BASE = '/api/rankings';

/** The list itself — what distinguishes it from every other list a body publishes. */
export interface RankingSnapshot {
  snapshotId: string;
  policyName: string;
  policyVersion: string;
  asOfDate: string;
  bodyId?: string;
  discipline?: string | null;
  levelCode?: string | null;
  ageCategoryCode?: string | null;
  gender?: string | null;
  generatedAt: string;
  entryCount: number;
  rollingPeriodDays: number;
}

/** One person's row within one list. */
export interface RankingEntry {
  snapshotId: string;
  rank: number;
  personId: string;
  totalPoints: number;
  countingResults: number;
  bucketTotals?: Record<string, number> | null;
  meetsMinimum: boolean;
}

/** One point in a person's history: the rank, and the list it was held on. */
export interface PersonRankingRow {
  entry: RankingEntry;
  snapshot: RankingSnapshot;
}

export interface Paged<T> {
  data: T[];
  pagination: { limit: number; offset: number; total: number };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * `?limit=&offset=` for the values that were actually supplied.
 *
 * An omitted page is not the same as `limit=0`: the service applies its own
 * default when the parameter is absent, and sending an empty or zero value
 * would override that with something meaningless.
 */
function pageQuery(opts: { limit?: number; offset?: number }): string {
  const params = new URLSearchParams();
  if (typeof opts.limit === 'number') params.set('limit', String(opts.limit));
  if (typeof opts.offset === 'number') params.set('offset', String(opts.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * A person's positional ranking history, newest first.
 *
 * Paged upstream with a server-enforced ceiling, so `limit` is a request and
 * not a guarantee — read `pagination.total` to know whether more exists.
 */
export async function fetchPersonRankingHistory(
  personId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Paged<PersonRankingRow>> {
  const path = `${RANKINGS_BASE}/person/${encodeURIComponent(personId)}/history`;
  return getJson<Paged<PersonRankingRow>>(path + pageQuery(opts));
}

/** Where a person stands now — one row per list, newest instance of each. */
export async function fetchPersonCurrentRankings(personId: string): Promise<PersonRankingRow[]> {
  return getJson<PersonRankingRow[]>(`${RANKINGS_BASE}/person/${encodeURIComponent(personId)}/current`);
}

/** One stored list: the header, and a page of its body in rank order. */
export async function fetchSnapshot(
  snapshotId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ snapshot: RankingSnapshot; entries: RankingEntry[]; pagination: Paged<never>['pagination'] }> {
  const path = `${RANKINGS_BASE}/snapshots/${encodeURIComponent(snapshotId)}`;
  return getJson(path + pageQuery(opts));
}

/**
 * A human label for a list, from the axes it is actually split on.
 *
 * NULL means "not split on this axis" rather than "unknown" — that is the
 * reading migration 0010 gave those columns — so an absent value contributes
 * nothing to the name instead of an "Unknown" fragment. A list split on nothing
 * is legitimately just its body's name.
 */
export function describeRankingList(snapshot: RankingSnapshot): string {
  const parts = [
    snapshot.bodyId ?? snapshot.policyName,
    snapshot.ageCategoryCode ?? undefined,
    snapshot.gender ? snapshot.gender.charAt(0) + snapshot.gender.slice(1).toLowerCase() : undefined,
    snapshot.levelCode ?? undefined,
    snapshot.discipline ? snapshot.discipline.charAt(0) + snapshot.discipline.slice(1).toLowerCase() : undefined,
  ].filter(Boolean);
  return parts.join(' · ');
}

/** The in-app route that renders a stored list in full. */
export function rankingListPath(snapshotId: string): string {
  return `/rankings/list/${encodeURIComponent(snapshotId)}`;
}
