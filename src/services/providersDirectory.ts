/**
 * Shared providers directory — the list of providers fetched from the
 * courthive-rankings list endpoint (`/api/rankings/providers`) via the CFS
 * RankingsProxy. Used to populate provider pickers (e.g. the /me availability
 * entry) so a user selects a provider by name instead of having to know and type
 * its abbreviation. Best-effort: returns an empty list on any failure so callers
 * can fall back to a plain text entry.
 */
const PROVIDERS_URL = '/api/rankings/providers';

export interface ProviderSummary {
  name: string;
  abbreviation: string;
}

export async function fetchProviderDirectory(): Promise<ProviderSummary[]> {
  try {
    const res = await fetch(PROVIDERS_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const providers = (await res.json()) as ProviderSummary[];
    if (!Array.isArray(providers)) return [];
    return providers.filter((p) => p?.abbreviation);
  } catch (e) {
    console.warn('[providers-directory] fetch failed:', e);
    return [];
  }
}
