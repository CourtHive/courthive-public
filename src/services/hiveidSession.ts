/**
 * HiveID session — localStorage-backed authentication state for the
 * public-side identity flows. Distinct from the admin `tmxToken` key
 * (see config/localStorage.ts) so a logged-in admin doing TMX work in
 * one tab can still have a separate HiveID public-side session in
 * another without collision.
 *
 * Pure-logic + testable. The session object is the same shape emitted
 * by `buildHiveIDLogin`'s `hiveid:authenticated` event.
 */
import type { CachedPersonFields, HiveIDAuthenticatedDetail } from 'courthive-components';

const HIVEID_SESSION_KEY = 'hiveidSession';

export type HiveIDSession = HiveIDAuthenticatedDetail;

export interface HiveIDSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): HiveIDSessionStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readHiveIDSession(storage: HiveIDSessionStorage | null = defaultStorage()): HiveIDSession | null {
  if (!storage) return null;
  const raw = storage.getItem(HIVEID_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    return parsed as HiveIDSession;
  } catch {
    return null;
  }
}

export function writeHiveIDSession(
  session: HiveIDSession,
  storage: HiveIDSessionStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  storage.setItem(HIVEID_SESSION_KEY, JSON.stringify(session));
}

export function clearHiveIDSession(storage: HiveIDSessionStorage | null = defaultStorage()): void {
  if (!storage) return;
  storage.removeItem(HIVEID_SESSION_KEY);
}

export function isAuthenticated(storage?: HiveIDSessionStorage | null): boolean {
  return !!readHiveIDSession(storage)?.token;
}

export function getDisplayName(session: HiveIDSession | null): string {
  const cached = session?.cached;
  if (!cached) return '';
  const given = (cached.standardGivenName ?? '').trim();
  const family = (cached.standardFamilyName ?? '').trim();
  return [given, family].filter(Boolean).join(' ');
}

export function emptyCached(): CachedPersonFields {
  return {
    standardFamilyName: null,
    standardGivenName: null,
    birthDate: null,
    sex: null,
    nationalityCode: null,
  };
}

export const HIVEID_SESSION_STORAGE_KEY = HIVEID_SESSION_KEY;
