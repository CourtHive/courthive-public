/**
 * Read-model access for a college program's published season of dual matches.
 *
 * Talks to courthive-query (the CQRS read side), NOT CFS. In prod the call is same-origin
 * `/query/programs/:teamId/duals` — nginx strips the `/query/` prefix and proxies to
 * courthive-query (:3150), so the request rides Cloudflare TLS instead of the loopback port.
 * In local dev the query service runs on :3150 alongside CFS (:8383); hit it directly.
 * Override with `window.dev.queryBaseURL` (dev toolbox, same shape as `window.dev.baseURL`).
 *
 * The endpoint is PUBLIC (no auth): it is gated to publicly-visible matchUps inside the service,
 * and returns every dual a team competed in regardless of which provider OWNS the record — so an
 * away dual (owned by the host) appears on the visiting program's page with no duplicate.
 */

export interface ProgramDual {
  tournamentId: string;
  tournamentName: string;
  startDate: string | null;
  endDate: string | null;
  providerId: string | null;
  teamName: string;
}

function getQueryBaseUrl(): string {
  const local = globalThis.location.host.includes('localhost') || globalThis.location.hostname === '127.0.0.1';
  const win = globalThis as any;
  return win.dev?.queryBaseURL || (local ? 'http://localhost:3150' : '/query');
}

/** A program's published season, newest-dated first (ordering set by the service). */
export async function fetchProgramDuals(teamId: string): Promise<ProgramDual[]> {
  const url = `${getQueryBaseUrl()}/programs/${encodeURIComponent(teamId)}/duals`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`fetchProgramDuals failed: HTTP ${res.status}`);
  const data = (await res.json()) as { teamId: string; duals: ProgramDual[] };
  return Array.isArray(data?.duals) ? data.duals : [];
}
