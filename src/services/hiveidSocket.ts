/**
 * HiveID socket — authenticated connection to CFS `/hiveid` namespace
 * (PR-H). Connects only when a HiveID session exists; the SocketGuard
 * on the server side rejects unauthenticated or wrong-audience tokens.
 *
 * Phase 1 establishes the connection so PR-J's acceptance hits.
 * Phase 4 MVP wires the `personUpdate` event channel — on a `merged`
 * event, callers can refetch their `/me` participations. Future kinds
 * (roster, schedule, result) plug into the same dispatcher.
 */
import { io, type Socket } from 'socket.io-client';

import { getCfsBaseUrl } from './hiveidApi';
import { readHiveIDSession } from './hiveidSession';

// ── Public types — discriminated by `kind` for downstream consumers ──

export interface PersonMergedEvent {
  kind: 'merged';
  prevPersonId: string;
  survivorPersonId: string;
  occurredAt: string;
}

export interface PersonRosterEvent {
  kind: 'roster';
  tournamentId: string;
  eventId?: string;
  action: 'added' | 'removed' | 'updated';
  occurredAt: string;
}

export interface PersonScheduleEvent {
  kind: 'schedule';
  tournamentId: string;
  matchUpId: string;
  scheduledDate?: string;
  scheduledTime?: string;
  courtId?: string;
  occurredAt: string;
}

export interface PersonResultEvent {
  kind: 'result';
  tournamentId: string;
  matchUpId: string;
  winningSide?: 1 | 2;
  matchUpStatus: string;
  occurredAt: string;
}

export type PersonUpdateEvent =
  | PersonMergedEvent
  | PersonRosterEvent
  | PersonScheduleEvent
  | PersonResultEvent;

type PersonUpdateListener = (event: PersonUpdateEvent) => void;

// ── State ──

let socket: Socket | undefined;
const personUpdateListeners = new Set<PersonUpdateListener>();

export function getHiveIDSocket(): Socket | undefined {
  return socket;
}

export function connectHiveIDSocket(): Socket | undefined {
  const session = readHiveIDSession();
  if (!session?.token) return undefined;
  if (socket?.connected) return socket;
  const url = `${getCfsBaseUrl()}/hiveid`;
  socket = io(url, {
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    // `auth` is re-evaluated on every connect attempt (initial + each
    // reconnect), so a JWT rotation elsewhere is picked up without
    // having to tear the socket down. extraHeaders, by contrast, is
    // baked at construction time — kept here as a transitional fallback
    // until older server builds (pre-2026-06-01 SocketGuard which only
    // reads the Authorization header) are out of rotation.
    auth: (cb: (data: { token: string }) => void) => {
      const fresh = readHiveIDSession()?.token ?? '';
      cb({ token: fresh });
    },
    extraHeaders: { Authorization: `Bearer ${session.token}` },
    transportOptions: {
      polling: { extraHeaders: { Authorization: `Bearer ${session.token}` } },
    },
  });
  socket.on('connect', () => {
    console.log('[hiveidSocket] connected — id:', socket?.id);
  });
  socket.on('connect_error', (err) => {
    // SocketGuard rejections surface here (and as 'exception' if the
    // server-side WsException makes it through). Log enough to triage
    // an auth failure without leaking the token.
    console.warn('[hiveidSocket] connect_error:', err?.message ?? err);
  });
  socket.on('exception', (msg) => {
    console.warn('[hiveidSocket] server exception:', msg);
  });
  socket.on('disconnect', (reason) => {
    console.log('[hiveidSocket] disconnected — reason:', reason);
  });
  socket.on('personUpdate', handlePersonUpdate);
  return socket;
}

export function disconnectHiveIDSocket(): void {
  if (socket) {
    socket.off('personUpdate', handlePersonUpdate);
    socket.disconnect();
    socket = undefined;
  }
  personUpdateListeners.clear();
}

/**
 * Register a personUpdate listener. Returns an unsubscribe function.
 *
 * The CFS-side gateway emits these for every state transition that
 * affects the signed-in HiveID identity — merges (Phase 4.0 MVP),
 * roster changes (Phase 4.1), schedule changes (Phase 4.2), result
 * commits (Phase 4.3). Consumers branch on `event.kind`.
 *
 * Listeners are called synchronously; throwing from a listener
 * doesn't cascade to other listeners.
 */
export function onPersonUpdate(listener: PersonUpdateListener): () => void {
  personUpdateListeners.add(listener);
  return () => {
    personUpdateListeners.delete(listener);
  };
}

/**
 * Internal — exposed for tests. Fans an incoming personUpdate event
 * out to every registered listener, isolating exceptions.
 */
export function handlePersonUpdate(event: PersonUpdateEvent): void {
  for (const listener of personUpdateListeners) {
    try {
      listener(event);
    } catch (err) {
      console.warn('[hiveidSocket] personUpdate listener threw', err);
    }
  }
}
