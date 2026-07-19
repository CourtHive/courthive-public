/**
 * Shared providers directory — the list of providers fetched from the
 * courthive-rankings list endpoint (`/api/rankings/providers`), served by CFS's
 * RankingsProxy. Used to populate provider pickers (e.g. the /me availability
 * entry) so a user selects a provider by name instead of having to know and type
 * its abbreviation. Best-effort: returns an empty list on any failure so callers
 * fall back to a plain text entry.
 *
 * NOTE the absolute CFS base — a relative `/api/...` resolves against the Vite
 * dev origin (:5174), which has no proxy, so it 404s in dev; the rankings proxy
 * lives on CFS (:8383 in dev).
 */
import { getCfsBaseUrl } from './hiveidApi';

const PROVIDERS_PATH = '/api/rankings/providers';

export interface ProviderSummary {
  name: string;
  abbreviation: string;
}

export async function fetchProviderDirectory(): Promise<ProviderSummary[]> {
  try {
    const res = await fetch(`${getCfsBaseUrl()}${PROVIDERS_PATH}`, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const providers = (await res.json()) as ProviderSummary[];
    if (!Array.isArray(providers)) return [];
    return providers.filter((p) => p?.abbreviation);
  } catch (e) {
    console.warn('[providers-directory] fetch failed:', e);
    return [];
  }
}
