import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrayerService, PrayerKey } from '../prayer/prayer.service';
import { MosqueService } from '../mosque/mosque.service';
import { addDays, addMinutesToTimeString, nowInTimezone, zonedTimeToUtc } from '../prayer/utils/time.util';
import { CreateAudioScheduleDto, UpdateAudioScheduleDto } from './dto/audio-schedule.dto';

@Injectable()
export class AudioScheduleService {
  constructor(private readonly prisma: PrismaService, private readonly prayers: PrayerService, private readonly mosque: MosqueService) {}

  async upcoming() {
    const mosque = await this.mosque.getOrCreate();
    const today = nowInTimezone(mosque.timezone).date;
    const now = Date.now();
    const schedules = await this.list();
    const executions = await this.prisma.scheduleExecution.findMany({ where: { plannedDate: new Date(today) } });
    const resolved = new Map<string, Awaited<ReturnType<PrayerService['getEffectiveSchedule']>> | null>();
    const keys: Record<string, PrayerKey> = { FAJR: 'fajr', DHUHR: 'dhuhr', ASR: 'asr', MAGHRIB: 'maghrib', ISHA: 'isha' };
    const items = [];
    for (const schedule of schedules) {
      let atUtc: string | null = null;
      let reason = !schedule.isActive ? 'Jadwal nonaktif' : !schedule.audio.isActive ? 'Audio nonaktif' : 'Tidak ada jadwal mendatang';
      if (schedule.isActive && schedule.audio.isActive) {
        const start = schedule.startDate?.toISOString().slice(0, 10);
        const end = schedule.endDate?.toISOString().slice(0, 10);
        const first = start && start > today ? start : today;
        for (let offset = 0; offset < 8; offset++) {
          const date = addDays(first, offset);
          if (end && date > end) break;
          if (schedule.daysOfWeek.length && !schedule.daysOfWeek.includes(new Date(date).getUTCDay())) continue;
          if (date === today && executions.some(e => e.scheduleId === schedule.id)) continue;
          let time = schedule.fixedTime;
          if (schedule.scheduleType === 'PRAYER_RELATIVE' && schedule.prayerName) {
            if (!resolved.has(date)) resolved.set(date, await this.prayers.getEffectiveSchedule(date).catch(() => null));
            const prayer = resolved.get(date);
            if (!prayer || prayer.stale) { reason = 'Jadwal sholat belum tersedia'; break; }
            time = addMinutesToTimeString(prayer.effective[keys[schedule.prayerName]], schedule.offsetMinutes ?? 0);
          }
          if (!time) continue;
          const target = zonedTimeToUtc(date, time, mosque.timezone);
          // Scheduler checks the whole scheduled minute, once every 20 seconds.
          if (target.getTime() + 60_000 <= now) continue;
          atUtc = target.toISOString(); break;
        }
      }
      items.push({ id: schedule.id, atUtc, reason: atUtc ? null : reason });
    }
    return { serverNow: new Date().toISOString(), timezone: mosque.timezone, items };
  }

  async listPublic() {
    const mosque = await this.mosque.getOrCreate();
    const schedules = await this.prisma.audioSchedule.findMany({
      where: { audio: { mosqueId: mosque.id } },
      include: { audio: { select: { id: true, name: true, isActive: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return schedules.map(({ resumeHistoryId: _resumeHistoryId, ...schedule }) => schedule);
  }

  async listPublicAudios() {
    const mosque = await this.mosque.getOrCreate();
    return this.prisma.audio.findMany({
      where: { mosqueId: mosque.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async createPublic(dto: CreateAudioScheduleDto) {
    return this.create(dto);
  }

  async updatePublic(id: string, dto: UpdateAudioScheduleDto) {
    const mosque = await this.mosque.getOrCreate();
    const schedule = await this.prisma.audioSchedule.findFirst({
      where: { id, audio: { mosqueId: mosque.id } },
      select: { id: true },
    });
    if (!schedule) throw new NotFoundException('Jadwal audio tidak ditemukan.');
    if (dto.audioId) {
      const audio = await this.prisma.audio.findFirst({
        where: { id: dto.audioId, mosqueId: mosque.id, isActive: true },
        select: { id: true },
      });
      if (!audio) throw new NotFoundException('Audio aktif tidak ditemukan.');
    }
    return this.update(id, dto);
  }

  async removePublic(id: string) {
    const mosque = await this.mosque.getOrCreate();
    const schedule = await this.prisma.audioSchedule.findFirst({
      where: { id, audio: { mosqueId: mosque.id } },
      select: { id: true },
    });
    if (!schedule) throw new NotFoundException('Jadwal audio tidak ditemukan.');
    return this.remove(id);
  }
  list() {
    return this.prisma.audioSchedule.findMany({ include: { audio: true }, orderBy: { createdAt: 'desc' } });
  }


  async create(dto: CreateAudioScheduleDto) {
    const mosque = await this.mosque.getOrCreate();
    const audioIds = this.normalizeAudioIds(dto.audioId, dto.audioIds);
    await this.ensureAudiosBelongToMosque(audioIds, mosque.id);
    return this.prisma.audioSchedule.create({ data: { ...dto, audioId: audioIds[0], audioIds } as any });
  }

  async update(id: string, dto: UpdateAudioScheduleDto) {
    const current = await this.ensureExists(id);
    const audioIds = dto.audioIds ?? (dto.audioId ? [dto.audioId] : undefined);
    if (audioIds) {
      const mosque = await this.mosque.getOrCreate();
      await this.ensureAudiosBelongToMosque(audioIds, mosque.id);
    }
    const reset = (audioIds !== undefined && JSON.stringify(audioIds) !== JSON.stringify(current.audioIds))
      || (dto.resumePlayback !== undefined && dto.resumePlayback !== current.resumePlayback);
    return this.prisma.audioSchedule.update({ where: { id }, data: {
      ...dto, ...(audioIds ? { audioId: audioIds[0], audioIds } : {}),
      ...(reset ? { resumePositionSeconds: 0, resumeHistoryId: null } : {}),
    } });
  }
  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.audioSchedule.delete({ where: { id } });
    return { ok: true };
  }

  private normalizeAudioIds(audioId: string, audioIds?: string[]) {
    const normalized = [...new Set(audioIds?.length ? audioIds : [audioId])];
    if (!normalized.length || normalized.some(id => !id)) throw new BadRequestException('Pilih minimal satu audio.');
    return normalized;
  }

  private async ensureAudiosBelongToMosque(audioIds: string[], mosqueId: string) {
    const found = await this.prisma.audio.findMany({ where: { id: { in: audioIds }, mosqueId, isActive: true }, select: { id: true } });
    if (found.length !== audioIds.length) throw new NotFoundException('Satu atau beberapa audio aktif tidak ditemukan.');
  }
  private async ensureExists(id: string) {
    const found = await this.prisma.audioSchedule.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Audio schedule not found');
    return found;
  }
}
