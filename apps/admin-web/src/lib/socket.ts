import { io, Socket } from 'socket.io-client';
import { runtimeConfig } from './runtime-config';

const SOCKET_URL = runtimeConfig.socketUrl || window.location.origin;

let socket: Socket | null = null;

/** Lazily creates a single shared connection to the /realtime namespace (admin/display broadcast channel). */
export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}/realtime`, { reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000 });
  }
  return socket;
}
