import { PlaybackLimit } from './playback-limit';
import 'dotenv/config';
import { io, Socket } from 'socket.io-client';
import { createAudioEngine } from './engine/engine-factory';
import { AudioEngineStatus } from './engine/audio-engine';

const url = process.env.PLAYER_SOCKET_URL || 'http://localhost:3000/player';
const deviceId = process.env.PLAYER_DEVICE_ID || 'player-main';
const name = process.env.PLAYER_NAME || 'Main Amplifier Player';

const engine = createAudioEngine();
let currentHistoryId: string | null = null;
const playbackLimit = new PlaybackLimit(() => {
  log('Batas durasi tercapai; menghentikan audio');
  void engine.stop().catch(err => log('duration stop error:', err.message));
});
let playQueue = Promise.resolve();

const socket: Socket = io(url, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 8000,
});

function log(...args: unknown[]) {
  console.log(`[PLAYER ${deviceId}]`, ...args);
}

function reportStatus(status: AudioEngineStatus) {
  playbackLimit.update(status.state);
  const map: Record<AudioEngineStatus['state'], string | null> = {
    IDLE: null, LOADING: 'LOADING', PLAYING: 'PLAYING', PAUSED: null,
    STOPPED: 'STOPPED', FINISHED: 'FINISHED', ERROR: 'ERROR',
  };
  const backendStatus = map[status.state];
  if (!backendStatus) return; // PAUSED/IDLE have no PlaybackStatus equivalent server-side
  socket.emit('player:status', {
    deviceId,
    historyId: currentHistoryId ?? undefined,
    status: backendStatus,
    errorMessage: status.errorMessage,
    positionSeconds: status.positionSeconds,
  });
  if (backendStatus === 'FINISHED' || backendStatus === 'STOPPED' || backendStatus === 'ERROR') {
    currentHistoryId = null;
  }
}

engine.onStatusChange(reportStatus);

socket.on('connect', () => {
  log('connected to backend, registering...');
  socket.emit('player:register', { deviceId, name });
});

socket.on('player:registered', (ack: { ok: boolean; error?: string }) => {
  if (ack?.ok) log('registered successfully');
  else log('registration failed:', ack?.error);
});

socket.on('disconnect', (reason) => {
  log('disconnected from backend:', reason, '- will auto-reconnect');
});

socket.on('connect_error', (err) => {
  log('connection error (will retry):', err.message);
});

socket.on('audio:play', (payload: { historyId: string; audioId: string; audioUrl: string; volume: number; maxDurationMinutes?: number | null; startPositionSeconds?: number }) => {
  playQueue = playQueue.then(async () => {
  playbackLimit.clear();
  if (currentHistoryId) await engine.stop();
  log('PLAY received:', payload.audioUrl, 'volume', payload.volume);
  currentHistoryId = payload.historyId;
  playbackLimit.configure(payload.maxDurationMinutes);
  try {
    await engine.play(payload.audioUrl, payload.volume ?? 80, Math.max(0, payload.startPositionSeconds || 0));
  } catch (err) {
    // Defense in depth: even if an engine implementation misbehaves and
    // throws, the process must keep running.
    log('unexpected error starting playback:', (err as Error).message);
    socket.emit('player:status', { deviceId, historyId: currentHistoryId, status: 'ERROR', errorMessage: (err as Error).message });
    playbackLimit.clear();
    currentHistoryId = null;
  }
  }).catch(err => { playbackLimit.clear(); log('play command error:', err.message); });
});

socket.on('audio:stop', async () => {
  log('STOP received');
  await engine.stop().catch((err) => log('stop() error:', err.message));
});

socket.on('audio:pause', async () => {
  log('PAUSE received');
  await engine.pause().catch((err) => log('pause() error:', err.message));
});

socket.on('audio:resume', async () => {
  log('RESUME received');
  await engine.resume().catch((err) => log('resume() error:', err.message));
});

socket.on('audio:set-volume', async (payload: { volume: number }) => {
  log('SET_VOLUME received:', payload.volume);
  await engine.setVolume(payload.volume).catch((err) => log('setVolume() error:', err.message));
});

setInterval(() => {
  if (socket.connected) {
    socket.emit('player:heartbeat', { deviceId });
    if (currentHistoryId) socket.emit('player:progress', { deviceId, historyId: currentHistoryId, positionSeconds: engine.getStatus().positionSeconds });
  }
}, 10_000);

// Last line of defense: this service runs unattended on a mini-PC next to
// an amplifier, so an unhandled error must be logged and survived, never
// allowed to crash the process (which would leave the mosque silent until
// someone manually restarts it).
process.on('uncaughtException', (err) => log('uncaughtException (continuing):', err.message));
process.on('unhandledRejection', (reason) => log('unhandledRejection (continuing):', reason));

log(`starting, connecting to ${url} as "${name}" (${deviceId})`);
