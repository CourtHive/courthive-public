/**
 * Client for the courthive-declarations service (persons-tier). Player writes
 * terminate here, NOT at CFS. Auth is the HiveID access token (same token the
 * rest of /me uses) sent as a Bearer; the service derives personId from it.
 *
 * Base URL resolves like hiveidApi/liveUpdates (localhost-aware) with a
 * `window.dev.declarationsURL` override for local runs against the service on
 * its default port (3110).
 */
import { readHiveIDSession } from './hiveidSession';

const NOT_SIGNED_IN = 'Not signed in';

export type DayState = 'AVAILABLE' | 'IF_NEEDED' | 'UNAVAILABLE'; // absent from `days` = NOT_SET

export interface AvailabilityPayload {
  span: { from: string; to: string };
  days: { [date: string]: DayState };
  timeAway?: { from: string; to: string; reason?: string }[];
  currentThroughWeek?: string;
}

export interface AvailabilitySnapshot {
  personId: string;
  providerId: string;
  status: string;
  payload: AvailabilityPayload;
  updatedAt: string;
}

export interface ConsentRecord {
  consentVersion: string;
  isMinor: boolean;
  guardian?: { name?: string; email?: string; relationship?: string } | null;
  revokedAt?: string | null;
}

export interface RecordConsentInput {
  consentVersion: string;
  birthDate?: string;
  isMinor?: boolean;
  guardian?: { name?: string; email?: string; relationship?: string };
}

export function getDeclarationsBaseUrl(): string {
  const win = globalThis as any;
  const loc = win.location;
  const host = loc?.host ?? '';
  const local = host.includes('localhost') || loc?.hostname === '127.0.0.1';
  return win.dev?.declarationsURL || (local ? 'http://localhost:3120' : 'https://courthive.net/declarations');
}

function authHeaders(): Record<string, string> | null {
  const session = readHiveIDSession();
  if (!session?.token) return null;
  return { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' };
}

function providerQuery(provider: string): string {
  return `provider=${encodeURIComponent(provider)}`;
}

function registrationUrl(tournamentId: string, provider: string): string {
  return `${getDeclarationsBaseUrl()}/me/registrations/${encodeURIComponent(tournamentId)}?${providerQuery(provider)}`;
}

/**
 * The providers this person is involved with (has any registration / availability /
 * consent for), from the declarations service — NOT CFS. Powers the availability
 * provider picker so a user selects rather than types. Best-effort: [] on any failure.
 */
export async function fetchMyProviders(): Promise<string[]> {
  const headers = authHeaders();
  if (!headers) return [];
  try {
    const res = await fetch(`${getDeclarationsBaseUrl()}/me/providers`, { headers });
    if (!res.ok) return [];
    const body = await res.json().catch(() => null);
    const providers = body?.providers;
    return Array.isArray(providers) ? providers.filter((p: unknown): p is string => typeof p === 'string' && !!p) : [];
  } catch {
    return [];
  }
}

export async function fetchMyAvailability(provider: string): Promise<AvailabilitySnapshot | null> {
  const headers = authHeaders();
  if (!headers) return null;
  const res = await fetch(`${getDeclarationsBaseUrl()}/me/availability?${providerQuery(provider)}`, { headers });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`fetchMyAvailability failed: HTTP ${res.status}`);
  return (await res.json()) as AvailabilitySnapshot | null;
}

export async function saveMyAvailability(
  provider: string,
  payload: AvailabilityPayload,
): Promise<AvailabilitySnapshot> {
  const headers = authHeaders();
  if (!headers) throw new Error(NOT_SIGNED_IN);
  const res = await fetch(`${getDeclarationsBaseUrl()}/me/availability?${providerQuery(provider)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await describeError(res));
  return (await res.json()) as AvailabilitySnapshot;
}

export async function fetchMyConsent(provider: string): Promise<ConsentRecord | null> {
  const headers = authHeaders();
  if (!headers) return null;
  const res = await fetch(`${getDeclarationsBaseUrl()}/me/consent?${providerQuery(provider)}`, { headers });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`fetchMyConsent failed: HTTP ${res.status}`);
  return (await res.json()) as ConsentRecord | null;
}

export async function recordMyConsent(provider: string, input: RecordConsentInput): Promise<ConsentRecord> {
  const headers = authHeaders();
  if (!headers) throw new Error(NOT_SIGNED_IN);
  const res = await fetch(`${getDeclarationsBaseUrl()}/me/consent?${providerQuery(provider)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await describeError(res));
  return (await res.json()) as ConsentRecord;
}

// ---------------------------------------------------------------------------
//  REGISTRATION declaration type (pending application against a tournament)
// ---------------------------------------------------------------------------

export interface RegistrationPayload {
  // Pre-activation the proposal's events have no stable ids, so `eventIds` holds
  // the event names; acceptance maps them to the activated eventIds. partner /
  // notes / answers are free-form.
  eventIds: string[];
  partner?: { userId?: string; personId?: string; email?: string } | null;
  notes?: string;
  answers?: Record<string, unknown>;
}

export interface RegistrationSnapshot {
  personId: string;
  providerId: string;
  tournamentId: string | null;
  status: string;
  payload: RegistrationPayload;
  updatedAt: string;
}

/** All of the signed-in person's registrations for one provider (across tournaments). */
export async function fetchMyRegistrations(provider: string): Promise<RegistrationSnapshot[]> {
  const headers = authHeaders();
  if (!headers) return [];
  const res = await fetch(`${getDeclarationsBaseUrl()}/me/registrations?${providerQuery(provider)}`, { headers });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`fetchMyRegistrations failed: HTTP ${res.status}`);
  const body = await res.json().catch(() => null);
  return Array.isArray(body) ? (body as RegistrationSnapshot[]) : [];
}

export async function fetchMyRegistration(provider: string, tournamentId: string): Promise<RegistrationSnapshot | null> {
  const headers = authHeaders();
  if (!headers) return null;
  const res = await fetch(
    registrationUrl(tournamentId, provider),
    { headers },
  );
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`fetchMyRegistration failed: HTTP ${res.status}`);
  const body = await res.json().catch(() => null);
  return body && typeof body === 'object' ? (body as RegistrationSnapshot) : null;
}

export async function submitRegistration(
  provider: string,
  tournamentId: string,
  payload: RegistrationPayload,
): Promise<RegistrationSnapshot> {
  const headers = authHeaders();
  if (!headers) throw new Error(NOT_SIGNED_IN);
  const res = await fetch(
    registrationUrl(tournamentId, provider),
    { method: 'PUT', headers, body: JSON.stringify(payload) },
  );
  if (!res.ok) throw new Error(await describeError(res));
  return (await res.json()) as RegistrationSnapshot;
}

export async function withdrawRegistration(provider: string, tournamentId: string): Promise<void> {
  const headers = authHeaders();
  if (!headers) return;
  const res = await fetch(
    registrationUrl(tournamentId, provider),
    { method: 'DELETE', headers },
  );
  if (!res.ok && res.status !== 401) throw new Error(await describeError(res));
}

// Surface the service's typed error code (CONSENT_REQUIRED / PARENTAL_CONSENT_REQUIRED / …)
// so the UI can react, falling back to the HTTP status.
async function describeError(res: Response): Promise<string> {
  try {
    const body: any = await res.json();
    return body?.code || body?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
