/**
 * HiveID socket — authenticated connection to CFS `/hiveid` namespace
 * (PR-H). Connects only when a HiveID session exists; the SocketGuard
 * on the server side rejects unauthenticated or wrong-audience tokens.
 *
 * Phase 1 just establishes the connection so PR-J's acceptance hits.
 * Phase 4 will register event handlers (`personUpdate` etc.) on the
 * returned socket.
 */
import { io, type Socket } from 'socket.io-client';

import { getCfsBaseUrl } from './hiveidApi';
import { readHiveIDSession } from './hiveidSession';

let socket: Socket | undefined;

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
    extraHeaders: { Authorization: `Bearer ${session.token}` },
    transportOptions: {
      polling: { extraHeaders: { Authorization: `Bearer ${session.token}` } },
    },
  });
  socket.on('connect', () => {
    console.log('[hiveidSocket] connected — id:', socket?.id);
  });
  socket.on('exception', (msg) => {
    console.warn('[hiveidSocket] server exception:', msg);
  });
  socket.on('disconnect', (reason) => {
    console.log('[hiveidSocket] disconnected — reason:', reason);
  });
  return socket;
}

export function disconnectHiveIDSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}
