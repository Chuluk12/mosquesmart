import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomInt, randomUUID } from 'node:crypto';
import { Prisma, TriggerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MosqueService } from '../mosque/mosque.service';
import { PlayerService } from '../player/player.service';
import { nowInTimezone } from '../prayer/utils/time.util';
import { CreatePlaylistDto, PlaylistSettingsDto, UpdatePlaylistAudiosDto } from './playlist.dto';

const isolationLevel = Prisma.TransactionIsolationLevel.Serializable;
@Injectable()
export class QuotePlaylistService {
  private running = false;
  private logger = new Logger(QuotePlaylistService.name);
  constructor(private prisma: PrismaService, private mosque: MosqueService, private players: PlayerService) {}

  async list() {
    const mosque = await this.mosque.getOrCreate();
    const playlists = await this.prisma.quotePlaylist.findMany({
      orderBy: { createdAt: 'desc' },
      include: { approvals: { orderBy: { approvedAt: 'desc' }, take: 10 } },
    });
    return Promise.all(playlists.map(async p => {
      const [audios, used, recentRuns] = await Promise.all([
        this.prisma.audio.findMany({ where: { id: { in: p.audioIds }, mosqueId: mosque.id }, select: { id: true, name: true, description: true, isActive: true } }),
        this.prisma.quoteRun.findMany({ where: { playlistId: p.id, cycle: p.cycle, audioId: { not: null } }, select: { audioId: true, status: true } }),
        this.prisma.quoteRun.findMany({ where: { playlistId: p.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
      ]);
      const usedIds = new Set(used.map(r => r.audioId));
      return { ...p, timezone: mosque.timezone, audios, usedCount: used.length,
        remaining: audios.filter(a => a.isActive && !usedIds.has(a.id)).length,
        pending: used.filter(r => ['LOADING', 'PLAYING'].includes(r.status)).length, recentRuns };
    }));
  }

  async create(dto: CreatePlaylistDto) {
    const mosque = await this.mosque.getOrCreate();
    const count = await this.prisma.audio.count({ where: { id: { in: dto.audioIds }, isActive: true, mosqueId: mosque.id } });
    if (count !== dto.audioIds.length) throw new BadRequestException('Pilih audio aktif yang tersedia di Audio Library.');
    return this.prisma.quotePlaylist.create({ data: { ...dto, name: dto.name.trim(), times: [...dto.times].sort() } });
  }

  async update(id: string, dto: PlaylistSettingsDto) {
    if (!await this.prisma.quotePlaylist.findUnique({ where: { id } })) throw new NotFoundException('Playlist tidak ditemukan.');
    return this.prisma.quotePlaylist.update({ where: { id }, data: { ...dto, name: dto.name.trim(), times: [...dto.times].sort() } });
  }

  async updateAudios(id: string, dto: UpdatePlaylistAudiosDto) {
    const mosque = await this.mosque.getOrCreate();
    return this.prisma.$transaction(async tx => {
      const playlist = await tx.quotePlaylist.findUnique({ where: { id } });
      if (!playlist) throw new NotFoundException('Playlist tidak ditemukan.');
      const added = dto.audioIds.filter(audioId => !playlist.audioIds.includes(audioId));
      const count = await tx.audio.count({ where: { id: { in: added }, isActive: true, mosqueId: mosque.id } });
      if (count !== added.length) throw new BadRequestException('Pilih audio aktif yang tersedia di Audio Library.');
      const removed = playlist.audioIds.filter(audioId => !dto.audioIds.includes(audioId));
      if (removed.length && await tx.quoteRun.count({ where: { playlistId: id, audioId: { in: removed }, status: { in: ['LOADING', 'PLAYING'] } } })) {
        throw new BadRequestException('Voice sedang diputar. Tunggu sampai selesai sebelum menghapusnya dari playlist.');
      }
      return tx.quotePlaylist.update({ where: { id }, data: { audioIds: dto.audioIds } });
    }, { isolationLevel });
  }

  async remove(id: string) {
    return this.prisma.$transaction(async tx => {
      const playlist = await tx.quotePlaylist.findUnique({ where: { id } });
      if (!playlist) throw new NotFoundException('Playlist tidak ditemukan.');
      if (await tx.quoteRun.count({ where: { playlistId: id, status: { in: ['LOADING', 'PLAYING'] } } })) {
        throw new BadRequestException('Playlist masih memiliki pemutaran berjalan. Tunggu sampai selesai sebelum menghapus.');
      }
      await tx.quotePlaylist.delete({ where: { id } });
      return { ok: true };
    }, { isolationLevel });
  }
  async resolveInterrupted(id: string, runId: string, userId: string) {
    const run = await this.prisma.quoteRun.findFirst({ where: { id: runId, playlistId: id } });
    if (!run) throw new NotFoundException('Riwayat tidak ditemukan.');
    if (this.players.isOnline(run.deviceId)) throw new BadRequestException('Player masih online. Hentikan pemutaran melalui menu Player terlebih dahulu.');
    // Unknown delivery is never automatically returned to the pool.
    return this.prisma.$transaction(async tx => {
      const result = await tx.quoteRun.updateMany({
        where: { id: runId, status: { in: ['LOADING', 'PLAYING'] } }, data: { status: 'REVIEWED' },
      });
      if (!result.count) throw new BadRequestException('Riwayat sudah selesai. Muat ulang daftar.');
      await tx.playbackHistory.updateMany({
        where: { id: runId }, data: { status: 'STOPPED', finishedAt: new Date(), errorMessage: 'Koneksi terputus; ditandai terpakai oleh admin ' + userId },
      });
      return { resolved: true };
    });
  }
  async approve(id: string, cycle: number, userId: string) {
    return this.prisma.$transaction(async tx => {
      const p = await tx.quotePlaylist.findUnique({ where: { id } });
      if (!p) throw new NotFoundException('Playlist tidak ditemukan.');
      if (p.cycle !== cycle) throw new BadRequestException('Putaran sudah berubah. Muat ulang daftar.');
      const used = await tx.quoteRun.findMany({ where: { playlistId: id, cycle, audioId: { not: null } } });
      if (used.some(r => ['LOADING', 'PLAYING'].includes(r.status))) throw new BadRequestException('Masih ada pemutaran yang belum selesai atau belum dikonfirmasi player.');
      const audios = await tx.audio.findMany({ where: { id: { in: p.audioIds }, isActive: true }, select: { id: true } });
      if (!audios.length || audios.some(a => !used.some(r => r.audioId === a.id))) throw new BadRequestException('Persetujuan ulang tersedia setelah seluruh stok aktif terpakai.');
      await tx.quoteApproval.create({ data: { playlistId: id, cycle: cycle + 1, approvedBy: userId } });
      return tx.quotePlaylist.update({ where: { id }, data: { cycle: { increment: 1 } } });
    }, { isolationLevel });
  }

  @Interval(20_000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const mosque = await this.mosque.getOrCreate();
      const clock = nowInTimezone(mosque.timezone);
      const playlists = await this.prisma.quotePlaylist.findMany({ where: { isActive: true } });
      for (const p of playlists) {
        if (!p.daysOfWeek.includes(clock.weekday) || !p.times.includes(clock.time)) continue;
        try { await this.dispatch(p.id, clock.date, clock.time, clock.weekday); }
        catch (error: any) {
          // Unique slots and serializable conflicts are retried by the next tick.
          if (!['P2002', 'P2034'].includes(error?.code)) this.logger.error(error?.message);
        }
      }
    } catch (error: any) { this.logger.error(error?.message); }
    finally { this.running = false; }
  }

  async dispatch(id: string, date: string, time: string, weekday: number) {
    const online = (await this.players.list()).filter(p => p.online && p.status !== 'PLAYING');
    if (!online.length) return;
    // One speaker device per slot, prefer the most recently active connection.
    online.sort((a, b) => (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0));
    const device = online[0];
    const reservation = await this.prisma.$transaction(async tx => {
      const p = await tx.quotePlaylist.findUnique({ where: { id } });
      if (!p?.isActive || !p.times.includes(time) || !p.daysOfWeek.includes(weekday)) return null;
      const slot = date + ' ' + time;
      if (await tx.quoteRun.findUnique({ where: { playlistId_slot: { playlistId: id, slot } } })) return null;
      // Also guards concurrent playlists and commands still loading.
      if (await tx.quoteRun.findFirst({ where: { deviceId: device.deviceId, status: { in: ['LOADING', 'PLAYING'] } } })) return null;
      if (await tx.playbackHistory.findFirst({ where: { playerDeviceId: device.deviceId, status: { in: ['LOADING', 'PLAYING'] } } })) return null;
      const used = await tx.quoteRun.findMany({ where: { playlistId: id, cycle: p.cycle, audioId: { not: null } }, select: { audioId: true } });
      const available = await tx.audio.findMany({ where: { id: { in: p.audioIds, notIn: used.map(r => r.audioId!) }, isActive: true } });
      if (!available.length) return null;
      const audio = available[randomInt(available.length)];
      const run = await tx.quoteRun.create({ data: {
        id: randomUUID(), playlistId: id, cycle: p.cycle, slot,
        audioId: audio.id, selectedAudioId: audio.id, audioName: audio.name, deviceId: device.deviceId,
      } });
      return { run, volume: p.volume };
    }, { isolationLevel });
    if (!reservation) return;
    try {
      await this.players.play(device.deviceId, reservation.run.audioId!, reservation.volume,
        TriggerType.SCHEDULE, undefined, undefined, undefined, reservation.run.id);
    } catch (error) {
      // If history exists the delivery may already have happened: retain reservation.
      const history = await this.prisma.playbackHistory.findUnique({ where: { id: reservation.run.id } });
      if (!history) await this.prisma.quoteRun.update({ where: { id: reservation.run.id }, data: { status: 'ERROR', audioId: null } });
      throw error;
    }
  }
}