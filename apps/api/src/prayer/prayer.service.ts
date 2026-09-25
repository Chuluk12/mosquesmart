import { Inject, Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MosqueService } from '../mosque/mosque.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PRAYER_PROVIDER, PrayerProvider, RawPrayerTimes } from './providers/prayer-provider.interface';
import { UpdatePrayerSettingDto } from './dto/update-prayer-setting.dto';
import { addDays, addMinutesToTimeString, compareTimeStrings, nowInTimezone, zonedTimeToUtc } from './utils/time.util';

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
const PRAYER_KEYS: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: 'Subuh', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya',
};

@Injectable()
export class PrayerService implements OnModuleInit {
  private monthlyJobs = new Map<string, Promise<any>>();
  private warming = false;

  onModuleInit() { void this.warmMonths(); }

  @Interval(3_600_000)
  async warmMonths() {
    if (this.warming) return;
    this.warming = true;
    try {
      const mosque = await this.mosqueService.getOrCreate();
      const { date } = nowInTimezone(mosque.timezone);
      const [year, month] = date.split('-').map(Number);
      await this.getMonth(year, month);
      await this.getMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
    } catch (err) { this.logger.warn(`Monthly warmup: ${(err as Error).message}`); }
    finally { this.warming = false; }
  }

  async getMonth(year: number, month: number, refresh = false): Promise<any> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12)
      throw new BadRequestException('Tahun/bulan tidak valid (2000–2100, 1–12).');
    const mosque = await this.mosqueService.getOrCreate();
    const settings = await this.getSettings();
    const cacheKey = JSON.stringify([Number(mosque.latitude), Number(mosque.longitude), mosque.timezone, settings.calculationMethod]);
    const key = `${mosque.id}:${year}:${month}:${cacheKey}`;
    if (this.monthlyJobs.has(key)) return this.monthlyJobs.get(key);
    const job = (async () => {
      const where = { mosqueId: mosque.id, cacheKey, date: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) } };
      let rows = await this.prisma.prayerSchedule.findMany({ where, orderBy: { date: 'asc' } });
      const expectedDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
      let warning: string | null = null;
      if (refresh || rows.length !== expectedDays) {
        try {
          if (mosque.latitude == null || mosque.longitude == null) throw new Error('Koordinat masjid belum diatur');
          const fetched = await this.provider.getMonth(year, month, {
            latitude: Number(mosque.latitude), longitude: Number(mosque.longitude), timezone: mosque.timezone, calculationMethod: settings.calculationMethod,
          });
          await this.prisma.$transaction(fetched.map(({ date, ...raw }) => this.prisma.prayerSchedule.upsert({
            where: { mosqueId_date: { mosqueId: mosque.id, date: new Date(date) } },
            create: { mosqueId: mosque.id, date: new Date(date), cacheKey, ...raw }, update: { ...raw, cacheKey },
          })));
          rows = await this.prisma.prayerSchedule.findMany({ where, orderBy: { date: 'asc' } });
          this.realtime.emit('mosque:updated', { id: mosque.id });
        } catch (err) {
          this.logger.warn(`Monthly fetch: ${(err as Error).message}`);
          warning = 'API belum dapat diakses. Hanya jadwal yang sudah tersimpan ditampilkan; coba lagi nanti.';
        }
      }
      const today = nowInTimezone(mosque.timezone).date;
      return { year, month, timezone: mosque.timezone, city: mosque.city, method: settings.calculationMethod,
        today, expectedDays, complete: rows.length === expectedDays, warning,
        days: rows.map(row => ({ date: row.date.toISOString().slice(0, 10), source: row.source,
          effective: Object.fromEntries(PRAYER_KEYS.map(k => [k, addMinutesToTimeString(row[k], this.offsetFor(settings, k))])) })) };
    })();
    this.monthlyJobs.set(key, job);
    try { return await job; } finally { this.monthlyJobs.delete(key); }
  }
  private readonly logger = new Logger(PrayerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mosqueService: MosqueService,
    private readonly realtime: RealtimeGateway,
    @Inject(PRAYER_PROVIDER) private readonly provider: PrayerProvider,
  ) {}

  async getSettings() {
    const mosque = await this.mosqueService.getOrCreate();
    const existing = await this.prisma.prayerSetting.findUnique({ where: { mosqueId: mosque.id } });
    if (existing) return existing;
    return this.prisma.prayerSetting.create({ data: { mosqueId: mosque.id } });
  }

  async updateSettings(dto: UpdatePrayerSettingDto) {
    const settings = await this.getSettings();
    const updated = await this.prisma.prayerSetting.update({ where: { id: settings.id }, data: dto });
    this.realtime.emit('mosque:updated', { id: settings.mosqueId });
    return updated;
  }

  private offsetFor(settings: any, key: PrayerKey): number {
    return settings[`${key}OffsetMin`] ?? 0;
  }

  private iqomahFor(settings: any, key: PrayerKey): number {
    return settings[`${key}IqomahMin`] ?? 10;
  }

  /**
   * Returns the raw (uncorrected) schedule for a date, using the PostgreSQL
   * cache first. On a cache miss it calls the configured PrayerProvider and
   * persists the result. If the provider call fails (e.g. no internet) and
   * there is no cached row for this exact date, it falls back to the most
   * recently cached schedule so the display/scheduler still has *something*
   * to work with, clearly marked as stale.
   */
  async getRawSchedule(date: string): Promise<RawPrayerTimes & { date: string; stale?: boolean }> {
    const mosque = await this.mosqueService.getOrCreate();
    const settings = await this.getSettings();
    const cacheKey = JSON.stringify([Number(mosque.latitude), Number(mosque.longitude), mosque.timezone, settings.calculationMethod]);

    const cached = await this.prisma.prayerSchedule.findUnique({
      where: { mosqueId_date: { mosqueId: mosque.id, date: new Date(date) } },
    });
    if (cached && cached.cacheKey === cacheKey) {
      return { date, fajr: cached.fajr, sunrise: cached.sunrise, dhuhr: cached.dhuhr, asr: cached.asr, maghrib: cached.maghrib, isha: cached.isha, source: cached.source ?? 'cache' };
    }

    if (mosque.latitude == null || mosque.longitude == null) {
      throw new NotFoundException('Mosque latitude/longitude has not been configured yet');
    }

    try {
      const raw = await this.provider.getPrayerTimes(date, {
        latitude: Number(mosque.latitude),
        longitude: Number(mosque.longitude),
        timezone: mosque.timezone,
        calculationMethod: settings.calculationMethod,
      });

      await this.prisma.prayerSchedule.upsert({
        where: { mosqueId_date: { mosqueId: mosque.id, date: new Date(date) } },
        create: { mosqueId: mosque.id, date: new Date(date), ...raw, cacheKey },
        update: { ...raw, cacheKey },
      });

      return { date, ...raw };
    } catch (err) {
      this.logger.error(`Provider lookup failed for ${date}: ${(err as Error).message}`);

      const fallback = await this.prisma.prayerSchedule.findFirst({
        where: { mosqueId: mosque.id, cacheKey },
        orderBy: { date: 'desc' },
      });
      if (fallback) {
        this.logger.warn(`Falling back to last cached schedule (${fallback.date.toISOString().slice(0, 10)}) for ${date}`);
        return { date, fajr: fallback.fajr, sunrise: fallback.sunrise, dhuhr: fallback.dhuhr, asr: fallback.asr, maghrib: fallback.maghrib, isha: fallback.isha, source: 'fallback-stale', stale: true };
      }

      throw new NotFoundException('Prayer times are unavailable: the external provider could not be reached and there is no cached schedule yet.');
    }
  }

  /** Applies the admin-configured minute offsets to the raw schedule. */
  async getEffectiveSchedule(date: string) {
    const [raw, settings, mosque] = await Promise.all([
      this.getRawSchedule(date),
      this.getSettings(),
      this.mosqueService.getOrCreate(),
    ]);

    const effective: Record<PrayerKey, string> = {} as any;
    for (const key of PRAYER_KEYS) {
      effective[key] = addMinutesToTimeString(raw[key], this.offsetFor(settings, key));
    }

    return {
      date,
      timezone: mosque.timezone,
      raw,
      effective,
      iqomah: {
        fajr: settings.fajrIqomahMin, dhuhr: settings.dhuhrIqomahMin, asr: settings.asrIqomahMin,
        maghrib: settings.maghribIqomahMin, isha: settings.ishaIqomahMin,
      },
      stale: raw.stale ?? false,
    };
  }

  /**
   * The single source of truth for "what is happening right now, prayer-wise".
   * Used by both the Display TV (NORMAL/PRE_PRAYER/ADHAN/IQOMAH_COUNTDOWN state
   * machine) and the audio scheduler (PRAYER_RELATIVE schedules).
   */
  async getToday() {
    const mosque = await this.mosqueService.getOrCreate();
    const { date, time } = nowInTimezone(mosque.timezone);
    const today = await this.getEffectiveSchedule(date);

    let next: { name: PrayerKey; label: string; date: string; time: string; atUtc: string; iqomahMin: number } | null = null;
    for (const key of PRAYER_KEYS) {
      if (compareTimeStrings(today.effective[key], time) > 0) {
        next = {
          name: key, label: PRAYER_LABELS[key], date, time: today.effective[key],
          atUtc: zonedTimeToUtc(date, today.effective[key], mosque.timezone).toISOString(),
          iqomahMin: (today.iqomah as any)[key],
        };
        break;
      }
    }

    if (!next) {
      // All of today's prayers have passed; next is tomorrow's Fajr.
      const tomorrowDate = addDays(date, 1);
      const tomorrow = await this.getEffectiveSchedule(tomorrowDate);
      next = {
        name: 'fajr', label: PRAYER_LABELS.fajr, date: tomorrowDate, time: tomorrow.effective.fajr,
        atUtc: zonedTimeToUtc(tomorrowDate, tomorrow.effective.fajr, mosque.timezone).toISOString(),
        iqomahMin: tomorrow.iqomah.fajr,
      };
    }

    return { ...today, now: { date, time }, nextPrayer: next };
  }

  async getScheduleForDate(date: string) {
    return this.getEffectiveSchedule(date);
  }

  /** Pre-warms the cache a few days ahead so a later internet outage doesn't matter. */
  async prewarm(days = 3) {
    const mosque = await this.mosqueService.getOrCreate();
    const { date } = nowInTimezone(mosque.timezone);
    let cursor = date;
    for (let i = 0; i < days; i++) {
      try {
        await this.getRawSchedule(cursor);
      } catch (err) {
        this.logger.warn(`prewarm failed for ${cursor}: ${(err as Error).message}`);
      }
      cursor = addDays(cursor, 1);
    }
  }
}
