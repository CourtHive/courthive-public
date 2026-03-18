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
    socket = io(`${serverUrl}/tmx`, {
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    socket.on('connect', () => {
      // Re-join room after reconnect
      if (currentRoom) {
        socket.emit('joinTournament', { tournamentId: currentRoom });
      }
    });

    socket.on('tournamentMutation', () => {
      refreshActiveTab();
    });
  }

  currentRoom = tournamentId;
  if (socket.connected) {
    socket.emit('joinTournament', { tournamentId });
  }
  // If not yet connected, the 'connect' handler above will join once connected
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
