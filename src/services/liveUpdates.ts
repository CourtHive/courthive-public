/**
 * Live tournament updates via Socket.IO.
 *
 * Connects to the server's /public namespace, joins the active tournament room,
 * and re-fetches the current tab's data when a publicUpdate is broadcast.
 * Also handles `liveScore` events (compact PublicLivePayload broadcasts
 * derived from the bolt-history pipeline) by routing them into the
 * in-memory live bolt scores store.
 *
 * This is a read-only listener — the public viewer never sends mutations.
 */
import { refreshActiveTab, patchMatchUps } from 'src/pages/tournament/helpers/tabDisplay';
import { applyLiveScorePayload } from 'src/services/liveBoltScores';
import type { PublicLivePayload } from 'src/services/publicLiveTypes';
import { io, Socket } from 'socket.io-client';

let socket: Socket | undefined;
let currentRoom: string | undefined;

function getServerUrl(): string {
  const local = globalThis.location.host.includes('localhost') || globalThis.location.hostname === '127.0.0.1';
  return window['dev']?.baseURL || (local ? 'http://localhost:8383' : 'https://courthive.net');
}

export function connectAndJoinRoom(tournamentId: string): void {
  if (!tournamentId) return;

  // Already in this room
  if (currentRoom === tournamentId && socket?.connected) return;

  // Leave previous room if any
  if (currentRoom && socket?.connected) {
    socket.emit('leaveTournament', { tournamentId: currentRoom });
  }

  if (!socket) {
    const serverUrl = getServerUrl();
    console.log('[liveUpdates] connecting to', `${serverUrl}/public`);
    socket = io(`${serverUrl}/public`, {
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('[liveUpdates] connected — id:', socket?.id);
      // Re-join room after reconnect
      if (currentRoom) {
        console.log('[liveUpdates] joining room:', currentRoom);
        socket.emit('joinTournament', { tournamentId: currentRoom });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[liveUpdates] disconnected — reason:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[liveUpdates] connect_error:', err.message);
    });

    socket.on('exception', (data) => {
      console.warn('[liveUpdates] server exception:', data);
    });

    socket.on('publicUpdate', (data) => {
      console.log('[liveUpdates] received publicUpdate:', JSON.stringify(data, null, 2));
      if (data?.type === 'matchUpUpdate' && data.matchUps?.length) {
        patchMatchUps(data.matchUps, data.positionAssignments);
      } else {
        // publishChange or unknown — full re-fetch
        refreshActiveTab();
      }
    });

    // liveScore: compact PublicLivePayload from competition-factory-server's
    // public-live projector, dispatched on every bolt-history upsert. Phase 1
    // routes the payload into the in-memory store; future visualizations
    // subscribe via the `liveBoltScoreUpdated` window event.
    socket.on('liveScore', (data: PublicLivePayload) => {
      if (!data?.matchUpId) {
        console.warn('[liveUpdates] liveScore missing matchUpId — skipping');
        return;
      }
      applyLiveScorePayload(data);
    });
  }

  currentRoom = tournamentId;
  if (socket.connected) {
    console.log('[liveUpdates] already connected, joining room:', tournamentId);
    socket.emit('joinTournament', { tournamentId });
  } else {
    console.log('[liveUpdates] not yet connected, will join room on connect');
  }
}

export function leaveRoom(): void {
  if (currentRoom && socket?.connected) {
    socket.emit('leaveTournament', { tournamentId: currentRoom });
  }
  currentRoom = undefined;
}

export function disconnectSocket(): void {
  leaveRoom();
  socket?.disconnect();
  socket = undefined;
}
