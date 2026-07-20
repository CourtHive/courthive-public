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
  /** The verification (contact) email — what /me displays + edits while unverified. */
  contactEmail: string | null;
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

/**
 * Distinct outcomes of checking whether the stored HiveID token is still accepted:
 *  - `no-session`  — nothing stored; the user is simply logged out.
 *  - `valid`       — CFS accepted the token; `me` carries the fresh identity.
 *  - `expired`     — CFS returned 401; the stored token is stale/invalid and must be cleared.
 *  - `unreachable` — CFS could not be reached or returned a transient (5xx) error; keep the
 *                    session and degrade gracefully rather than logging the user out on a blip.
 *
 * The presence of a token in localStorage is NOT proof of being logged in — the server is the
 * authority. Callers use this so a rejected token is treated as logged-out instead of rendering a
 * "logged in" shell whose every authenticated panel then falls back to "Sign in…".
 */
export type SessionCheckStatus = 'no-session' | 'valid' | 'expired' | 'unreachable';

export async function checkHiveIDSession(): Promise<{ status: SessionCheckStatus; me?: HiveIDMeResponse }> {
  const session = readHiveIDSession();
  if (!session?.token) return { status: 'no-session' };
  try {
    const res = await fetch(`${getCfsBaseUrl()}/auth/hiveid/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (res.status === 401) return { status: 'expired' };
    if (!res.ok) return { status: 'unreachable' };
    return { status: 'valid', me: (await res.json()) as HiveIDMeResponse };
  } catch {
    return { status: 'unreachable' };
  }
}

export interface ParticipationRow {
  tournamentId: string;
  tournamentName: string;
  startDate: string | null;
  endDate: string | null;
  participantId: string;
  participantName: string;
  eventCount: number;
}

export interface ClaimableCandidate {
  participantId: string;
  participantName: string;
  sex: string | null;
  nationalityCode: string | null;
  birthDate: string | null;
  alreadyLinkedTo: string | null;
}

async function authenticatedJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const session = readHiveIDSession();
  if (!session?.token) return null;
  const res = await fetch(`${getCfsBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON body */
    }
    const message = body?.message ?? `HTTP ${res.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return (await res.json()) as T;
}

export type ResendVerificationStatus = 'pending_verification' | 'already_verified' | 'no_contact_email';

/** Authenticated — re-send the HiveID email-verification mail to the logged-in user. */
export function resendHiveIDVerification(): Promise<{ success: boolean; status?: ResendVerificationStatus } | null> {
  return authenticatedJson('/auth/hiveid/resend-verification', { method: 'POST' });
}

/**
 * Authenticated — set/change the caller's verification (contact) email. Clears
 * verified status server-side and sends a fresh verification mail. Returns the
 * service result (`{ success, status, contactEmail }` or `{ error }`), or null on 401.
 */
export function setMyContactEmail(
  contactEmail: string,
): Promise<{ success?: boolean; status?: string; contactEmail?: string; error?: string } | null> {
  return authenticatedJson('/auth/hiveid/me/contact-email', {
    method: 'POST',
    body: JSON.stringify({ contactEmail }),
  });
}

/**
 * Public — exchange a single-use email-verification token (from the link in
 * the verification email) for a verified stamp. Shared @Public CFS endpoint;
 * no session required, so the link works on any device/browser.
 */
export async function consumeEmailVerification(token: string): Promise<{ success: true; contactEmail: string }> {
  const res = await fetch(`${getCfsBaseUrl()}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON body */
    }
    const message = body?.message ?? `HTTP ${res.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return (await res.json()) as { success: true; contactEmail: string };
}

export function fetchMyParticipations(): Promise<{ personId: string | null; participations: ParticipationRow[] } | null> {
  return authenticatedJson('/auth/hiveid/me/participations');
}

export function fetchClaimable(tournamentId: string): Promise<{ tournamentId: string; candidates: ClaimableCandidate[] } | null> {
  if (!tournamentId) return Promise.resolve({ tournamentId: '', candidates: [] });
  return authenticatedJson(`/auth/hiveid/me/claimable/${encodeURIComponent(tournamentId)}`);
}

export function claimParticipant(tournamentId: string, participantId: string): Promise<{ success: true; tournamentId: string; participantId: string; personId: string } | null> {
  return authenticatedJson('/auth/hiveid/me/claim', {
    method: 'POST',
    body: JSON.stringify({ tournamentId, participantId }),
  });
}

export interface ScorerTokenRequest {
  tournamentId: string;
  matchUpId?: string;
  displayName?: string;
}

/**
 * Authenticated — mint a short-lived, scope-narrowed `aud: 'score'` relay token
 * for the signed-in HiveID user. This is what a launched external scorer
 * (epixodic) carries so its crowd scores relay AS this person, instead of the
 * full session JWT. Returns null when logged out (no session) or on failure —
 * callers fall back to launching an anonymous crowd session.
 */
export function mintScorerToken(body: ScorerTokenRequest): Promise<{ token: string; expiresAt: string } | null> {
  return authenticatedJson('/auth/scorer-token', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
