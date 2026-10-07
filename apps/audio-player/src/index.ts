import { PlaybackLimit } from './playback-limit';
import 'dotenv/config';
import { io, Socket } from 'socket.io-client';
import { createAudioEngine } from './engine/engine-factory';
import { AudioEngineStatus } from './engine/audio-engine';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const url = process.env.PLAYER_SOCKET_URL || 'http://localhost:3000/player';
const deviceId = process.env.PLAYER_DEVICE_ID || 'player-main';
const name = process.env.PLAYER_NAME || 'Main Amplifier Player';

const engine = createAudioEngine();
let currentHistoryId: string | null = null;
let repeatsRemaining = 1;
let sequenceTracks: { historyId: string; audioUrl: string }[] = [];
let sequenceIndex = 0;
let sequenceVolume = 80;
let repeatTotal = 1;
let repeatSource: { url: string; volume: number } | null = null;
const playbackLimit = new PlaybackLimit(() => {
  log('Batas durasi tercapai; menghentikan audio');
  void engine.stop().catch(err => log('duration stop error:', err.message));
});
let playQueue = Promise.resolve();
const stateFile = resolve(process.env.PLAYER_STATE_FILE || '.player-state.json');
type PendingStatus = { deviceId: string; historyId?: string; status: string; errorMessage?: string; positionSeconds?: number };
let pendingStatuses: PendingStatus[] = [];
let registered = false;
try { if (existsSync(stateFile)) pendingStatuses = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { pendingStatuses = []; }
function persistStatuses() { try { mkdirSync(dirname(stateFile), { recursive: true }); writeFileSync(stateFile, JSON.stringify(pendingStatuses.slice(-200))); } catch (err) { log('state save failed:', (err as Error).message); } }
function sendStatus(payload: PendingStatus) {
  if (!socket.connected || !registered) { pendingStatuses.push(payload); persistStatuses(); return; }
  socket.emit('player:status', payload);
}
function flushStatuses() {
  if (!socket.connected || !pendingStatuses.length) return;
  const queued = pendingStatuses; pendingStatuses = []; persistStatuses();
  queued.forEach(payload => socket.emit('player:status', payload));
}

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
  if (status.state === 'FINISHED' && sequenceTracks.length) {
    const next = sequenceTracks[sequenceIndex + 1];
    if (next) {
      if (next.historyId !== currentHistoryId && currentHistoryId) sendStatus({ deviceId, historyId: currentHistoryId, status: 'FINISHED', positionSeconds: status.positionSeconds });
      sequenceIndex++;
      currentHistoryId = next.historyId;
      void engine.play(next.audioUrl, sequenceVolume, 0);
      return;
    }
    sequenceTracks = [];
    sequenceIndex = 0;
  }

  if (status.state === 'FINISHED' && repeatsRemaining > 1 && currentHistoryId && repeatSource) {
    repeatsRemaining--;
    log('Audio finished; repeating', repeatTotal - repeatsRemaining + 1, '/', repeatTotal);
    void engine.play(repeatSource.url, repeatSource.volume, 0);
    return;
  }
  playbackLimit.update(status.state);
  const map: Record<AudioEngineStatus['state'], string | null> = {
    IDLE: null, LOADING: 'LOADING', PLAYING: 'PLAYING', PAUSED: null,
    STOPPED: 'STOPPED', FINISHED: 'FINISHED', ERROR: 'ERROR',
  };
  const backendStatus = map[status.state];
  if (!backendStatus) return; // PAUSED/IDLE have no PlaybackStatus equivalent server-side
  sendStatus({
    deviceId,
    historyId: currentHistoryId ?? undefined,
    status: backendStatus,
    errorMessage: status.errorMessage,
    positionSeconds: status.positionSeconds,
  });
  if (backendStatus === 'FINISHED' || backendStatus === 'STOPPED' || backendStatus === 'ERROR') {
    if (sequenceTracks.length) {
      const terminalStatus = backendStatus === 'ERROR' ? 'ERROR' : 'STOPPED';
      const pendingHistoryIds = [...new Set(sequenceTracks.slice(sequenceIndex + 1).map(track => track.historyId))];
      pendingHistoryIds.filter(id => id !== currentHistoryId).forEach(historyId => sendStatus({ deviceId, historyId, status: terminalStatus }));
      sequenceTracks = [];
      sequenceIndex = 0;
    }
    currentHistoryId = null;
    repeatsRemaining = 1;
    repeatSource = null;
  }
}

engine.onStatusChange(reportStatus);

socket.on('connect', () => {
  log('connected to backend, registering...');
  socket.emit('player:register', { deviceId, name });
});

socket.on('player:registered', (ack: { ok: boolean; error?: string }) => {
  if (ack?.ok) { registered = true; log('registered successfully'); flushStatuses(); }
  else log('registration failed:', ack?.error);
});

socket.on('disconnect', (reason) => {
  registered = false;
  log('disconnected from backend:', reason, '- will auto-reconnect');
});

socket.on('connect_error', (err) => {
  log('connection error (will retry):', err.message);
});

socket.on('audio:play', (payload: { historyId: string; audioId: string; audioUrl: string; volume: number; maxDurationMinutes?: number | null; startPositionSeconds?: number; repeatCount?: number }) => {
  playQueue = playQueue.then(async () => {
  playbackLimit.clear();
  sequenceTracks = []; sequenceIndex = 0;
  if (currentHistoryId) await engine.stop();
  log('PLAY received:', payload.audioUrl, 'volume', payload.volume, 'repeatCount', payload.repeatCount ?? 1);
  currentHistoryId = payload.historyId;
  repeatsRemaining = Math.max(1, Math.floor(payload.repeatCount || 1));
  repeatTotal = repeatsRemaining;
  repeatSource = { url: payload.audioUrl, volume: payload.volume ?? 80 };
  playbackLimit.configure(payload.maxDurationMinutes);
  try {
    await engine.play(payload.audioUrl, payload.volume ?? 80, Math.max(0, payload.startPositionSeconds || 0));
  } catch (err) {
    // Defense in depth: even if an engine implementation misbehaves and
    // throws, the process must keep running.
    log('unexpected error starting playback:', (err as Error).message);
    sendStatus({ deviceId, historyId: currentHistoryId, status: 'ERROR', errorMessage: (err as Error).message });
    playbackLimit.clear();
    currentHistoryId = null;
    repeatsRemaining = 1;
    repeatSource = null;
  }
  }).catch(err => { playbackLimit.clear(); log('play command error:', err.message); });
});

socket.on('audio:play-sequence', (payload: { tracks: { historyId: string; audioId: string; audioUrl: string }[]; volume: number; maxDurationMinutes?: number | null; repeatCount?: number }) => {
  playQueue = playQueue.then(async () => {
    playbackLimit.clear();
    if (currentHistoryId) await engine.stop();
    sequenceTracks = [];
    if (!payload.tracks.length) return;
    const repeats = Math.max(1, Math.floor(payload.repeatCount || 1));
    sequenceTracks = Array.from({ length: repeats }, () => payload.tracks.map(track => ({ historyId: track.historyId, audioUrl: track.audioUrl }))).flat();
    sequenceIndex = 0;
    sequenceVolume = payload.volume ?? 80;
    repeatsRemaining = 1;
    repeatSource = null;
    currentHistoryId = sequenceTracks[0].historyId;
    playbackLimit.configure(payload.maxDurationMinutes);
    log('SEQUENCE received:', payload.tracks.length, 'files,', repeats, 'round(s)');
    await engine.play(sequenceTracks[0].audioUrl, payload.volume ?? 80, 0);
  }).catch(err => { playbackLimit.clear(); sequenceTracks = []; log('sequence play error:', err.message); });
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
