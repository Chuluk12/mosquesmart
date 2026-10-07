import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MosqueService } from '../mosque/mosque.service';
import { AudioService } from '../audio/audio.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PlaybackStatus, PlayerStatus, TriggerType } from '@prisma/client';
import { Server } from 'socket.io';

interface ConnectedPlayer {
  deviceId: string;
  socketId: string;
  ipAddress?: string;
}

/**
 * Owns the in-memory table of currently-connected player sockets and is the
 * single place that talks to the `/player` Socket.IO namespace. Both the
 * REST PlayerController (manual Play Now / Stop) and the SchedulerService
 * (automatic prayer/murottal playback) go through here so playback history
 * bookkeeping never gets duplicated.
 */
@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);
  private connected = new Map<string, ConnectedPlayer>();
  private server?: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mosqueService: MosqueService,
    private readonly audioService: AudioService,
    private readonly realtime: RealtimeGateway,
  ) {}

  bindServer(server: Server) {
    this.server = server;
  }

  isOnline(deviceId: string) {
    return this.connected.has(deviceId);
  }

  async registerConnection(deviceId: string, name: string, socketId: string, ipAddress?: string) {
    this.connected.set(deviceId, { deviceId, socketId, ipAddress });
    const mosque = await this.mosqueService.getOrCreate();

    const player = await this.prisma.audioPlayer.upsert({
      where: { deviceId },
      create: { mosqueId: mosque.id, deviceId, name, status: PlayerStatus.ONLINE, lastSeenAt: new Date(), ipAddress },
      update: { name, status: PlayerStatus.ONLINE, lastSeenAt: new Date(), ipAddress },
    });

    this.realtime.emit('player:status', { deviceId, status: 'ONLINE' });
    return player;
  }

  async handleDisconnect(socketId: string) {
    const entry = [...this.connected.values()].find((p) => p.socketId === socketId);
    if (!entry) return;
    this.connected.delete(entry.deviceId);
    await this.prisma.audioPlayer.updateMany({ where: { deviceId: entry.deviceId }, data: { status: PlayerStatus.OFFLINE } });
    this.realtime.emit('player:status', { deviceId: entry.deviceId, status: 'OFFLINE' });
  }

  async heartbeat(deviceId: string) {
    await this.prisma.audioPlayer.updateMany({ where: { deviceId }, data: { lastSeenAt: new Date() } });
  }

  async list() {
    const players = await this.prisma.audioPlayer.findMany({ orderBy: { name: 'asc' } });
    return players.map((p) => ({ ...p, online: this.isOnline(p.deviceId) }));
  }

  private socketIdFor(deviceId: string): string | null {
    return this.connected.get(deviceId)?.socketId ?? null;
  }

  /**
   * Dispatches PLAY to a device and opens a PlaybackHistory row up front
   * (status LOADING) so progress can be tracked even if the player never
   * reports back (e.g. it crashes) -- the row simply stays LOADING/ERROR
   * instead of vanishing.
   */
  async play(deviceId: string, audioId: string, volume: number | undefined, trigger: TriggerType, scheduleId?: string, triggeredByUserId?: string, maxDurationMinutes?: number | null, historyId?: string, repeatCount = 1) {
    const socketId = this.socketIdFor(deviceId);
    if (!socketId) throw new NotFoundException(`Player ${deviceId} is not connected`);

    const audio = await this.audioService.findOne(audioId);
    const apiBaseUrl = process.env.API_PUBLIC_URL || `http://localhost:${process.env.API_PORT || 3000}`;
    const audioUrl = this.audioService.publicUrl(audio.id, apiBaseUrl);

    const schedule = scheduleId ? await this.prisma.audioSchedule.findUnique({ where: { id: scheduleId } }) : null;
    const resume = !!schedule?.resumePlayback && schedule.audioId === audioId;
    const startPositionSeconds = resume ? schedule!.resumePositionSeconds : 0;
    const history = await this.prisma.playbackHistory.create({
      data: {
        id: historyId,
        playerDeviceId: deviceId,
        audioId: audio.id,
        audioName: audio.name,
        scheduleId,
        triggerType: trigger,
        status: PlaybackStatus.LOADING,
        plannedAt: new Date(),
        triggeredByUserId,
      },
    });

    if (resume) await this.prisma.audioSchedule.updateMany({
      where: { id: scheduleId, audioId, resumePlayback: true },
      data: { resumeHistoryId: history.id },
    });
    this.server?.to(`player:${deviceId}`).emit('audio:play', {
      historyId: history.id,
      startPositionSeconds,
      audioId: audio.id,
      audioUrl,
      volume: volume ?? 80,
      maxDurationMinutes: maxDurationMinutes ?? null,
      repeatCount,
    });

    this.realtime.emit('player:command', { deviceId, command: 'PLAY', audioName: audio.name });
    return { accepted: true, deviceId, command: 'PLAY', historyId: history.id };
  }


  async playSequenceOnAllOnline(audioIds: string[], volume: number, trigger: TriggerType, scheduleId?: string, maxDurationMinutes?: number | null, repeatCount = 1) {
    const sequence = [...new Set(audioIds)];
    if (sequence.length <= 1) return this.playOnAllOnline(sequence[0], volume, trigger, scheduleId, maxDurationMinutes, repeatCount);

    const schedule = scheduleId ? await this.prisma.audioSchedule.findUnique({ where: { id: scheduleId } }) : null;
    const deviceIds = schedule?.resumePlayback ? [...this.connected.keys()].slice(0, 1) : [...this.connected.keys()];
    const audios = await Promise.all(sequence.map(id => this.audioService.findOne(id)));
    const apiBaseUrl = process.env.API_PUBLIC_URL || 'http://localhost:' + (process.env.API_PORT || 3000);
    const results = await Promise.allSettled(deviceIds.map(async deviceId => {
      const tracks: { historyId: string; audioId: string; audioUrl: string }[] = [];
      for (const audio of audios) {
        const history = await this.prisma.playbackHistory.create({ data: {
          playerDeviceId: deviceId, audioId: audio.id, audioName: audio.name, scheduleId,
          triggerType: trigger, status: PlaybackStatus.LOADING, plannedAt: new Date(),
        } });
        tracks.push({ historyId: history.id, audioId: audio.id, audioUrl: this.audioService.publicUrl(audio.id, apiBaseUrl) });
      }
      this.server?.to('player:' + deviceId).emit('audio:play-sequence', {
        tracks, volume: volume ?? 80, maxDurationMinutes: maxDurationMinutes ?? null, repeatCount,
      });
      this.realtime.emit('player:command', { deviceId, command: 'PLAY', audioName: audios.map(a => a.name).join(' → ') });
      return { accepted: true, deviceId, trackCount: tracks.length };
    }));
    results.forEach((result, i) => { if (result.status === 'rejected') this.logger.warn('playSequenceOnAllOnline: ' + deviceIds[i] + ' failed: ' + (result.reason as Error).message); });
    return { targeted: deviceIds.length, results };
  }

  async stop(deviceId: string) {
    const socketId = this.socketIdFor(deviceId);
    if (!socketId) throw new NotFoundException(`Player ${deviceId} is not connected`);

    this.server?.to(`player:${deviceId}`).emit('audio:stop');
    await this.closeOpenHistoryForDevice(deviceId, PlaybackStatus.STOPPED);
    this.realtime.emit('player:command', { deviceId, command: 'STOP' });
    return { accepted: true, deviceId, command: 'STOP' };
  }

  async pause(deviceId: string) {
    if (!this.socketIdFor(deviceId)) throw new NotFoundException(`Player ${deviceId} is not connected`);
    this.server?.to(`player:${deviceId}`).emit('audio:pause');
    return { accepted: true, deviceId, command: 'PAUSE' };
  }

  async resume(deviceId: string) {
    if (!this.socketIdFor(deviceId)) throw new NotFoundException(`Player ${deviceId} is not connected`);
    this.server?.to(`player:${deviceId}`).emit('audio:resume');
    return { accepted: true, deviceId, command: 'RESUME' };
  }

  async setVolume(deviceId: string, volume: number) {
    if (!this.socketIdFor(deviceId)) throw new NotFoundException(`Player ${deviceId} is not connected`);
    this.server?.to(`player:${deviceId}`).emit('audio:set-volume', { volume });
    await this.prisma.audioPlayer.updateMany({ where: { deviceId }, data: { volume } });
    return { accepted: true, deviceId, command: 'SET_VOLUME', volume };
  }

  /**
   * Scheduled (FIXED_TIME / PRAYER_RELATIVE) audio has no single target
   * device in the current data model, so it is broadcast to every player
   * that is online right now. A player that is offline or errors out is
   * logged and skipped so one bad device never blocks the others.
   */
  async playOnAllOnline(audioId: string, volume: number | undefined, trigger: TriggerType, scheduleId?: string, maxDurationMinutes?: number | null, repeatCount = 1) {
    const schedule = scheduleId ? await this.prisma.audioSchedule.findUnique({ where: { id: scheduleId } }) : null;
    // Continuation has one checkpoint owner: only one speaker receives this schedule.
    const deviceIds = schedule?.resumePlayback ? [...this.connected.keys()].slice(0, 1) : [...this.connected.keys()];
    const results = await Promise.allSettled(deviceIds.map((id) => this.play(id, audioId, volume, trigger, scheduleId, undefined, maxDurationMinutes, undefined, repeatCount)));
    results.forEach((r, i) => {
      if (r.status === 'rejected') this.logger.warn(`playOnAllOnline: ${deviceIds[i]} failed: ${(r.reason as Error).message}`);
    });
    return { targeted: deviceIds.length, results };
  }

  private async closeOpenHistoryForDevice(deviceId: string, status: PlaybackStatus) {
    const open = await this.prisma.playbackHistory.findFirst({
      where: { playerDeviceId: deviceId, status: { in: [PlaybackStatus.LOADING, PlaybackStatus.PLAYING] } },
      orderBy: { startedAt: 'desc' },
    });
    if (open) {
      await this.prisma.quoteRun.updateMany({ where: { id: open.id }, data: { status } });
      await this.prisma.playbackHistory.update({ where: { id: open.id }, data: { status, finishedAt: new Date() } });
    }
  }

  async saveSchedulePosition(deviceId: string, historyId: string, positionSeconds?: number, finished = false) {
    if (!finished && (typeof positionSeconds !== 'number' || !Number.isFinite(positionSeconds) || positionSeconds < 0 || positionSeconds > 31536000)) return;
    const history = await this.prisma.playbackHistory.findFirst({ where: { id: historyId, playerDeviceId: deviceId } });
    if (!history?.scheduleId) return;
    await this.prisma.audioSchedule.updateMany({
      where: { id: history.scheduleId, audioId: history.audioId ?? '', resumePlayback: true, resumeHistoryId: historyId,
        ...(!finished ? { resumePositionSeconds: { lte: positionSeconds } } : {}) },
      data: { resumePositionSeconds: finished ? 0 : positionSeconds, ...(finished ? { resumeHistoryId: null } : {}) },
    });
  }
  /** Called from the gateway when a player reports its own status. */
  async reportStatus(deviceId: string, historyId: string | undefined, status: PlaybackStatus, errorMessage?: string, positionSeconds?: number) {
    if (historyId) {
      const existing = await this.prisma.playbackHistory.findFirst({ where: { id: historyId, playerDeviceId: deviceId } });
      if (!existing) return;
      await this.saveSchedulePosition(deviceId, historyId, positionSeconds, status === PlaybackStatus.FINISHED);
      // A quote is reserved before sending the command. Errors before playback
      // release the audio; anything already heard stays locked for this cycle.
      await this.prisma.quoteRun.updateMany({
        where: { id: historyId, deviceId, status: { in: ['LOADING', 'PLAYING'] } },
        data: { status, ...(status === PlaybackStatus.PLAYING ? { playedAt: new Date() } : {}) },
      });
      if (status === PlaybackStatus.ERROR) {
        await this.prisma.quoteRun.updateMany({
          where: { id: historyId, deviceId, playedAt: null, status: 'ERROR' },
          data: { audioId: null },
        });
      }
      await this.prisma.playbackHistory.update({
        where: { id: historyId },
        data: {
          status,
          errorMessage,
          ...(status === PlaybackStatus.FINISHED || status === PlaybackStatus.STOPPED || status === PlaybackStatus.ERROR
            ? { finishedAt: new Date() }
            : {}),
        },
      }).catch(() => this.logger.warn(`reportStatus: history ${historyId} not found`));
    }

    const playerStatus = status === PlaybackStatus.PLAYING ? PlayerStatus.PLAYING
      : status === PlaybackStatus.ERROR ? PlayerStatus.ERROR
      : PlayerStatus.ONLINE;
    await this.prisma.audioPlayer.updateMany({ where: { deviceId }, data: { status: playerStatus } });

    this.realtime.emit('player:status', { deviceId, status: playerStatus, playbackStatus: status });
    this.realtime.emit('playback:update', { deviceId, historyId, status, errorMessage });
  }
}
