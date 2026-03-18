/**
 * Live tournament updates via Socket.IO.
 *
 * Connects to the server's /tmx namespace, joins the active tournament room,
 * and re-fetches the current tab's data when a mutation is broadcast.
 * This is a read-only listener — the public viewer never sends mutations.
 */
import { refreshActiveTab } from 'src/pages/tournament/helpers/tabDisplay';
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
    console.log('[liveUpdates] connecting to', `${serverUrl}/tmx`);
    socket = io(`${serverUrl}/tmx`, {
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

    socket.on('tournamentMutation', (data) => {
      console.log('[liveUpdates] received tournamentMutation — methods:', data?.methods?.length);
      refreshActiveTab();
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
