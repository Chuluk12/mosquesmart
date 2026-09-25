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
  async play(deviceId: string, audioId: string, volume: number | undefined, trigger: TriggerType, scheduleId?: string, triggeredByUserId?: string, maxDurationMinutes?: number | null) {
    const socketId = this.socketIdFor(deviceId);
    if (!socketId) throw new NotFoundException(`Player ${deviceId} is not connected`);

    const audio = await this.audioService.findOne(audioId);
    const apiBaseUrl = process.env.API_PUBLIC_URL || `http://localhost:${process.env.API_PORT || 3000}`;
    const audioUrl = this.audioService.publicUrl(audio.id, apiBaseUrl);

    const history = await this.prisma.playbackHistory.create({
      data: {
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

    this.server?.to(`player:${deviceId}`).emit('audio:play', {
      historyId: history.id,
      audioId: audio.id,
      audioUrl,
      volume: volume ?? 80,
      maxDurationMinutes: maxDurationMinutes ?? null,
    });

    this.realtime.emit('player:command', { deviceId, command: 'PLAY', audioName: audio.name });
    return { accepted: true, deviceId, command: 'PLAY', historyId: history.id };
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
  async playOnAllOnline(audioId: string, volume: number | undefined, trigger: TriggerType, scheduleId?: string, maxDurationMinutes?: number | null) {
    const deviceIds = [...this.connected.keys()];
    const results = await Promise.allSettled(deviceIds.map((id) => this.play(id, audioId, volume, trigger, scheduleId, undefined, maxDurationMinutes)));
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
      await this.prisma.playbackHistory.update({ where: { id: open.id }, data: { status, finishedAt: new Date() } });
    }
  }

  /** Called from the gateway when a player reports its own status. */
  async reportStatus(deviceId: string, historyId: string | undefined, status: PlaybackStatus, errorMessage?: string) {
    if (historyId) {
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
