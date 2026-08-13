/**
 * Conference competitive-fingerprint data.
 *
 * Unlike `programsApi`, this does NOT talk to courthive-query. The fingerprints are a precomputed
 * analytical snapshot over a fixed corpus (signed play-up/play-down exposure derived from published
 * dual results), not live tournament state — so they ship as static assets under `/data/conferences/`
 * and are cached in-module. The index is ~40KB; each conference document is ≤18KB and is fetched
 * lazily on navigation.
 *
 * SCOPE: dual (spring) play only. Fall individual events contribute nothing — they are individual
 * entry, so there is no team differential from which to derive a signed delta.
 */

export type BandKey = 'STRETCH' | 'UP' | 'EVEN' | 'DOWN' | 'ANCHOR';

export interface Fingerprint {
  matches: number;
  bands: Record<BandKey, number>;
  bandPct: Record<BandKey, number>;
  stretchRate: number;
  anchorRate: number;
  breadth: number;
  competitiveRatio: number | null;
  winRate: number | null;
}

export interface ConferenceMember extends Fingerprint {
  teamId: string;
  name: string;
  gender?: string;
  division?: string;
  lineupWTN?: number;
}

export interface ConferenceDoc {
  conference: string;
  slug: string;
  divisions: string[];
  seasons: string[];
  programCount: number;
  fingerprint: { overall: Fingerprint; inConference: Fingerprint; nonConference: Fingerprint };
  baseline: Fingerprint;
  stretchGap: { inConference: number; nonConference: number; delta: number; nonConferenceShare: number };
  members: ConferenceMember[];
}

export interface ConferenceIndexEntry {
  conference: string;
  slug: string;
  divisions: string[];
  programCount: number;
  matches: number;
  stretchRate: number;
  anchorRate: number;
  breadth: number;
  competitiveRatio: number | null;
  nonConferenceShare: number;
}

export interface ConferenceIndex {
  threshold: number;
  baseline: Fingerprint;
  conferences: ConferenceIndexEntry[];
}

const BASE = '/data/conferences';
let indexCache: Promise<ConferenceIndex> | undefined;
const docCache = new Map<string, Promise<ConferenceDoc>>();

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} failed: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function fetchConferenceIndex(): Promise<ConferenceIndex> {
  indexCache ??= getJson<ConferenceIndex>(`${BASE}/index.json`);
  return indexCache;
}

export function fetchConference(slug: string): Promise<ConferenceDoc> {
  if (!docCache.has(slug)) docCache.set(slug, getJson<ConferenceDoc>(`${BASE}/${encodeURIComponent(slug)}.json`));
  return docCache.get(slug) as Promise<ConferenceDoc>;
}
