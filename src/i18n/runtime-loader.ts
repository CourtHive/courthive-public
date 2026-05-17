/**
 * Runtime i18n loader — fetches locale files from CFS on demand and caches
 * them in localStorage keyed by SHA version. Mirrors TMX's runtime-loader
 * so the same Phase 5 i18n delivery architecture applies in courthive-public.
 *
 * Public API:
 *   - fetchManifest()          → manifest from CFS (cached locally for 5 min)
 *   - getCachedLocale(code)    → locally-cached JSON, if any
 *   - ensureLocaleCurrent(code) → ensures i18next has the current bundle
 *                                  for `code` loaded (from cache or fresh
 *                                  fetch); writes to cache on fetch.
 *
 * Storage key prefix is `chp.i18n.*` so multiple CourtHive apps sharing
 * a localStorage origin (e.g. dev) don't collide.
 */
import { baseApi } from 'src/services/api/baseApi';
import i18next from 'i18next';

export interface LocaleManifestEntry {
  code: string;
  label: string;
  nativeLabel: string;
  version: string; // SHA-256 of the file content
  size: number;
  keyCount: number;
  completeness: number; // 0..1
  rtl: boolean;
}

export interface Manifest {
  version: string; // courthive-i18n package version
  generatedAt: string;
  locales: LocaleManifestEntry[];
}

interface CachedLocale {
  version: string;
  content: Record<string, unknown>;
}

const LOCALE_KEY = (code: string) => `chp.i18n.locale.${code}`;
const VERSION_KEY = (code: string) => `chp.i18n.version.${code}`;
const MANIFEST_CACHE_KEY = 'chp.i18n.manifest';
const MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedManifest(): { manifest: Manifest; cachedAt: number } | null {
  try {
    const raw = localStorage.getItem(MANIFEST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.cachedAt !== 'number' || !parsed?.manifest) return null;
    return { manifest: parsed.manifest, cachedAt: parsed.cachedAt };
  } catch {
    return null;
  }
}

function writeCachedManifest(manifest: Manifest): void {
  try {
    localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify({ manifest, cachedAt: Date.now() }));
  } catch {
    // Storage quota or disabled — ignore.
  }
}

/** Fetch the manifest from CFS. Caches in localStorage for MANIFEST_CACHE_TTL_MS.
 *  Pass `{ force: true }` to bypass the freshness check (e.g. user opens the
 *  language picker — show whatever's currently live, not 5-min stale). */
export async function fetchManifest(opts: { force?: boolean } = {}): Promise<Manifest | null> {
  if (!opts.force) {
    const cached = getCachedManifest();
    if (cached && Date.now() - cached.cachedAt < MANIFEST_CACHE_TTL_MS) {
      return cached.manifest;
    }
  }

  try {
    const response = await baseApi.get('/i18n/manifest', { silenceErrors: true } as any);
    const manifest = response?.data as Manifest;
    if (!manifest?.locales) return null;
    writeCachedManifest(manifest);
    return manifest;
  } catch {
    return getCachedManifest()?.manifest ?? null;
  }
}

/** Read a locally-cached locale file by code. */
export function getCachedLocale(code: string): CachedLocale | null {
  try {
    const version = localStorage.getItem(VERSION_KEY(code));
    const raw = localStorage.getItem(LOCALE_KEY(code));
    if (!version || !raw) return null;
    return { version, content: JSON.parse(raw) };
  } catch {
    return null;
  }
}

function writeCachedLocale(code: string, version: string, content: Record<string, unknown>): void {
  try {
    localStorage.setItem(LOCALE_KEY(code), JSON.stringify(content));
    localStorage.setItem(VERSION_KEY(code), version);
  } catch {
    // Storage quota — drop silently. Next call will re-fetch.
  }
}

/** Fetch a locale's JSON from CFS, honoring ETag/304 against the local cache.
 *  Requires CFS to send `Access-Control-Expose-Headers: ETag` so the browser
 *  exposes the header to JavaScript. */
export async function fetchLocale(code: string): Promise<CachedLocale | null> {
  const cached = getCachedLocale(code);
  const headers: Record<string, string> = {};
  if (cached?.version) headers['If-None-Match'] = cached.version;

  try {
    const response = await baseApi.get(`/i18n/locales/${code}`, {
      headers,
      silenceErrors: true,
      validateStatus: (status: number) => status === 200 || status === 304,
    } as any);

    if (response?.status === 304 && cached) return cached;

    const etag = response?.headers?.etag ?? response?.headers?.ETag;
    if (!etag || !response?.data) return cached;

    const content = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    writeCachedLocale(code, etag, content);
    return { version: etag, content };
  } catch {
    return cached;
  }
}

/** Ensure i18next has the right bundle for `code` loaded — from cache if
 *  fresh, otherwise from CFS. Safe to call multiple times. */
export async function ensureLocaleCurrent(code: string): Promise<void> {
  const ensureBundle = (content: Record<string, unknown>) => {
    if (i18next.hasResourceBundle(code, 'translation')) return;
    i18next.addResourceBundle(code, 'translation', content, true, true);
  };

  const manifest = await fetchManifest();
  const cached = getCachedLocale(code);

  if (!manifest) {
    if (cached) ensureBundle(cached.content);
    return;
  }

  const entry = manifest.locales.find((l) => l.code === code);
  if (!entry) {
    if (cached) ensureBundle(cached.content);
    return;
  }

  if (cached && cached.version === entry.version) {
    ensureBundle(cached.content);
    return;
  }

  const fetched = await fetchLocale(code);
  if (!fetched) {
    if (cached) ensureBundle(cached.content);
    return;
  }
  ensureBundle(fetched.content);
}

/** Available locale codes per the latest manifest. */
export async function getAvailableLocales(): Promise<LocaleManifestEntry[]> {
  const manifest = await fetchManifest();
  return manifest?.locales ?? [];
}
