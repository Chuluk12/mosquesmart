import { io } from 'socket.io-client';
import { runtimeConfig } from './runtime-config';

const SOCKET_URL = runtimeConfig.socketUrl || window.location.origin;

export function getRealtimeSocket() {
  return io(`${SOCKET_URL}/realtime`, { reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000 });
}
