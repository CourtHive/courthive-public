/**
 * Local-only IndexedDB persistence for courthive-public Phase 2
 * interactive scoring sessions.
 *
 * Phase 2 is pure-local (Decision 3 — no server packets from
 * anonymous trackers). Every scoring session lives in a single
 * IndexedDB object store keyed by `(tournamentId, matchUpId)`.
 * Nothing leaves the device.
 *
 * Phase 3 will add a parallel server sync path for logged-in users
 * via score-relay. The local store remains the source of truth for
 * the current session even when sync is enabled; the server push is
 * fire-and-forget on top.
 */

const DB_NAME = 'courthive-public-crowd-tracker';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export interface CrowdTrackerSession {
  /** Composite key `${tournamentId}:${matchUpId}`. */
  key: string;
  tournamentId: string;
  matchUpId: string;
  matchUpFormat: string;
  side1Name: string;
  side2Name: string;
  /**
   * Opaque MatchUp snapshot from the scoring shell. Typed as `unknown`
   * because the crowdTracker doesn't introspect it — the shell's
   * `setState` rehydrates the engine from whatever shape was
   * originally serialized. This avoids cross-package type coupling
   * between `courthive-components` and `tods-competition-factory`,
   * which have slightly different `MatchUp` shapes at the type level.
   */
  matchUp: unknown;
  startedAt: string;
  updatedAt: string;
}

function buildKey(tournamentId: string, matchUpId: string): string {
  return `${tournamentId}:${matchUpId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function saveSession(
  params: Omit<CrowdTrackerSession, 'key' | 'startedAt' | 'updatedAt'> & {
    startedAt?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const key = buildKey(params.tournamentId, params.matchUpId);

  // Preserve startedAt across saves if an existing row is present
  let startedAt = params.startedAt ?? now;
  try {
    const existing = await loadSession(params.tournamentId, params.matchUpId);
    if (existing?.startedAt) startedAt = existing.startedAt;
  } catch {
    // fall through — first save
  }

  const session: CrowdTrackerSession = {
    key,
    tournamentId: params.tournamentId,
    matchUpId: params.matchUpId,
    matchUpFormat: params.matchUpFormat,
    side1Name: params.side1Name,
    side2Name: params.side2Name,
    matchUp: params.matchUp,
    startedAt,
    updatedAt: now,
  };

  await runTransaction<IDBValidKey>('readwrite', (store) => store.put(session));
}

export async function loadSession(
  tournamentId: string,
  matchUpId: string,
): Promise<CrowdTrackerSession | undefined> {
  const key = buildKey(tournamentId, matchUpId);
  try {
    const result = await runTransaction<CrowdTrackerSession | undefined>(
      'readonly',
      (store) => store.get(key) as IDBRequest<CrowdTrackerSession | undefined>,
    );
    return result ?? undefined;
  } catch {
    return undefined;
  }
}

export async function deleteSession(
  tournamentId: string,
  matchUpId: string,
): Promise<void> {
  const key = buildKey(tournamentId, matchUpId);
  try {
    await runTransaction<undefined>(
      'readwrite',
      (store) => store.delete(key) as IDBRequest<undefined>,
    );
  } catch {
    // no-op — deletion failure is non-fatal
  }
}

export async function listActiveSessions(): Promise<CrowdTrackerSession[]> {
  try {
    const result = await runTransaction<CrowdTrackerSession[]>(
      'readonly',
      (store) => store.getAll() as IDBRequest<CrowdTrackerSession[]>,
    );
    return result ?? [];
  } catch {
    return [];
  }
}

export async function clearAllSessions(): Promise<void> {
  try {
    await runTransaction<undefined>(
      'readwrite',
      (store) => store.clear() as IDBRequest<undefined>,
    );
  } catch {
    // no-op
  }
}
