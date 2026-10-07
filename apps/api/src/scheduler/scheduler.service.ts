import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MosqueService } from '../mosque/mosque.service';
import { PrayerService, PrayerKey } from '../prayer/prayer.service';
import { PlayerService } from '../player/player.service';
import { addMinutesToTimeString, nowInTimezone } from '../prayer/utils/time.util';
import { PrayerName, TriggerType } from '@prisma/client';

const PRAYER_NAME_TO_KEY: Record<PrayerName, PrayerKey> = {
  FAJR: 'fajr', DHUHR: 'dhuhr', ASR: 'asr', MAGHRIB: 'maghrib', ISHA: 'isha',
};

/**
 * Ticks every 20 seconds and checks every active AudioSchedule against
 * "now" (in the mosque's timezone). Idempotency is enforced at the database
 * level: before dispatching, the tick tries to INSERT a ScheduleExecution
 * row with a UNIQUE(scheduleId, plannedDate) constraint. Only the tick that
 * wins that insert actually plays the audio, so overlapping ticks, server
 * restarts, or clock jitter can never cause the same schedule to fire twice
 * in one day.
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mosqueService: MosqueService,
    private readonly prayerService: PrayerService,
    private readonly playerService: PlayerService,
  ) {}

  async onModuleInit() {
    // Warm the prayer-time cache a few days ahead on boot so a later
    // internet blip doesn't prevent PRAYER_RELATIVE schedules from resolving.
    this.prayerService.prewarm(3).catch((err) => this.logger.warn(`prewarm on boot failed: ${(err as Error).message}`));
  }

  @Interval(20_000)
  async tick() {
    if (this.running) return; // guards against a slow tick overlapping the next one
    this.running = true;
    try {
      await this.runTick();
    } catch (err) {
      this.logger.error(`Scheduler tick failed: ${(err as Error).message}`, (err as Error).stack);
    } finally {
      this.running = false;
    }
  }

  private async runTick() {
    const mosque = await this.mosqueService.getOrCreate();
    const { date, time, weekday } = nowInTimezone(mosque.timezone);

    const schedules = await this.prisma.audioSchedule.findMany({
      where: { isActive: true, audio: { isActive: true } },
      include: { audio: true },
    });
    if (schedules.length === 0) return;

    let todaysPrayers: Record<PrayerKey, string> | null = null;

    for (const schedule of schedules) {
      if (schedule.daysOfWeek.length && !schedule.daysOfWeek.includes(weekday)) continue;
      if (schedule.startDate && new Date(date) < new Date(schedule.startDate)) continue;
      if (schedule.endDate && new Date(date) > new Date(schedule.endDate)) continue;

      let plannedTime: string | null = null;

      if (schedule.scheduleType === 'FIXED_TIME' && schedule.fixedTime) {
        plannedTime = schedule.fixedTime;
      } else if (schedule.scheduleType === 'PRAYER_RELATIVE' && schedule.prayerName) {
        if (!todaysPrayers) {
          const effective = await this.prayerService.getEffectiveSchedule(date);
          todaysPrayers = effective.effective;
        }
        const base = todaysPrayers[PRAYER_NAME_TO_KEY[schedule.prayerName]];
        plannedTime = addMinutesToTimeString(base, schedule.offsetMinutes ?? 0);
      }

      if (!plannedTime) continue;

      const plannedMinutes = Number(plannedTime.slice(0, 2)) * 60 + Number(plannedTime.slice(3));
      const nowMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
      const minutesLate = nowMinutes - plannedMinutes;
      if (minutesLate < 0 || minutesLate > 5) continue;

      await this.tryDispatch(schedule.id, date, plannedTime, (schedule.audioIds?.length ? schedule.audioIds : [schedule.audioId]), schedule.volume, schedule.maxDurationMinutes, schedule.repeatCount);
    }
  }

  private async tryDispatch(scheduleId: string, date: string, plannedTime: string, audioIds: string[], volume: number, maxDurationMinutes: number | null, repeatCount: number) {
    // FAILED executions remain retryable during the grace window.
    try {
      const existing = await this.prisma.scheduleExecution.findUnique({ where: { scheduleId_plannedDate: { scheduleId, plannedDate: new Date(date) } } });
      if (existing?.status === 'DISPATCHED' || existing?.status === 'DONE') return;
      if (existing) await this.prisma.scheduleExecution.update({ where: { id: existing.id }, data: { status: 'DISPATCHED' } });
      else await this.prisma.scheduleExecution.create({ data: { scheduleId, plannedDate: new Date(date), plannedTime, status: 'DISPATCHED' } });
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.code === 'P2034') return;
      throw err;
    }

    try {
      const result = await this.playerService.playSequenceOnAllOnline(audioIds, volume, TriggerType.SCHEDULE, scheduleId, maxDurationMinutes, repeatCount);
      this.logger.log(`Dispatched schedule ${scheduleId} at ${plannedTime} to ${result.targeted} player(s), repeatCount=${repeatCount}`);
      if (result.targeted === 0) throw new Error('No player is online; execution will be retried');
    } catch (err) {
      this.logger.error(`Dispatch failed for schedule ${scheduleId}: ${(err as Error).message}`);
      await this.prisma.scheduleExecution.updateMany({
        where: { scheduleId, plannedDate: new Date(date) },
        data: { status: 'FAILED' },
      }).catch(() => undefined);
    }
  }
}
