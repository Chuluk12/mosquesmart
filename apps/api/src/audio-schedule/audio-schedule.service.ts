import { Injectable, NotFoundException } from '@nestjs/common';
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

  list() {
    return this.prisma.audioSchedule.findMany({ include: { audio: true }, orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateAudioScheduleDto) {
    return this.prisma.audioSchedule.create({ data: dto as any });
  }

  async update(id: string, dto: UpdateAudioScheduleDto) {
    const current = await this.ensureExists(id);
    const reset = (dto.audioId !== undefined && dto.audioId !== current.audioId)
      || (dto.resumePlayback !== undefined && dto.resumePlayback !== current.resumePlayback);
    return this.prisma.audioSchedule.update({ where: { id }, data: {
      ...dto, ...(reset ? { resumePositionSeconds: 0, resumeHistoryId: null } : {}),
    } });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.audioSchedule.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.audioSchedule.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Audio schedule not found');
    return found;
  }
}
