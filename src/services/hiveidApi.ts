/**
 * HiveID-side API surface for courthive-public.
 *
 * Resolves the CFS base URL using the same logic as `liveUpdates` and
 * `baseApi` (localhost-aware), so dev and prod both work out of the box.
 * The `GET /auth/hiveid/me` call refreshes the cached canonical fields
 * after the page reloads — picking up any `personMerged`-driven
 * rewrites that have happened since the session was minted.
 */
import { readHiveIDSession } from './hiveidSession';

export function getCfsBaseUrl(): string {
  const local =
    globalThis.location.host.includes('localhost') || globalThis.location.hostname === '127.0.0.1';
  // Reuse the dev-toolbox override that the rest of the public-side
  // services honor (window.dev.baseURL). Falls back to the production
  // CFS at courthive.net.
  const win = globalThis as any;
  return win.dev?.baseURL || (local ? 'http://localhost:8383' : 'https://courthive.net');
}

export interface HiveIDMeResponse {
  userId: string;
  email: string;
  emailVerifiedAt: string | null;
  personId: string | null;
  personRevision: number | null;
  cached: {
    standardFamilyName: string | null;
    standardGivenName: string | null;
    birthDate: string | null;
    sex: string | null;
    nationalityCode: string | null;
  };
  consentPreferences: Record<string, unknown>;
}

export async function fetchHiveIDMe(): Promise<HiveIDMeResponse | null> {
  const session = readHiveIDSession();
  if (!session?.token) return null;
  const url = `${getCfsBaseUrl()}/auth/hiveid/me`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${session.token}` } });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`fetchHiveIDMe failed: HTTP ${res.status}`);
  return (await res.json()) as HiveIDMeResponse;
}
