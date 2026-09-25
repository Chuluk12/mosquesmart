import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:3000';

let socket: Socket | null = null;

/** Lazily creates a single shared connection to the /realtime namespace (admin/display broadcast channel). */
export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}/realtime`, { reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000 });
  }
  return socket;
}
