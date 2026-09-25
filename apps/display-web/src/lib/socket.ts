import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:3000';

export function getRealtimeSocket() {
  return io(`${SOCKET_URL}/realtime`, { reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000 });
}
