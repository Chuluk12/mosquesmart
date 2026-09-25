import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { PrayerProvider, PrayerLocation, RawPrayerTimes } from './prayer-provider.interface';

// Maps our internal, provider-agnostic method names to Aladhan's numeric codes.
const METHOD_MAP: Record<string, number> = {
  MWL: 3,        // Muslim World League
  EGYPT: 5,
  KARACHI: 1,
  KEMENAG: 20,   // Kementerian Agama RI (commonly used in Indonesia)
  UMM_AL_QURA: 4,
  ISNA: 2,
};

/**
 * Adapter for the Aladhan public prayer-times API
 * (https://aladhan.com/prayer-times-api). Network calls are wrapped with a
 * timeout and a small bounded retry so a slow/unstable connection degrades
 * gracefully instead of hanging the request pipeline.
 */
@Injectable()
export class AladhanPrayerProvider implements PrayerProvider {
  private readonly logger = new Logger(AladhanPrayerProvider.name);
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: 'https://api.aladhan.com/v1',
      timeout: 8000,
    });
  }

  async getPrayerTimes(date: string, location: PrayerLocation): Promise<RawPrayerTimes> {
    const method = METHOD_MAP[location.calculationMethod ?? 'MWL'] ?? METHOD_MAP.MWL;
    const [year, month, day] = date.split('-');
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.http.get(`/timings/${day}-${month}-${year}`, {
          params: {
            latitude: location.latitude,
            longitude: location.longitude,
            timezonestring: location.timezone,
            method,
          },
        });

        const t = response.data?.data?.timings;
        if (!t) throw new Error('Unexpected response shape from Aladhan API');

        const clean = (v: string) => v?.split(' ')[0]; // strips e.g. "(WIB)" suffixes

        return {
          fajr: clean(t.Fajr),
          sunrise: clean(t.Sunrise) ?? null,
          dhuhr: clean(t.Dhuhr),
          asr: clean(t.Asr),
          maghrib: clean(t.Maghrib),
          isha: clean(t.Isha),
          source: 'aladhan',
        };
      } catch (err) {
        lastError = err;
        this.logger.warn(`Aladhan API attempt ${attempt}/${maxAttempts} failed: ${(err as Error).message}`);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 500)); // small linear backoff
        }
      }
    }

    throw new Error(`Failed to fetch prayer times from Aladhan after ${maxAttempts} attempts: ${(lastError as Error)?.message}`);
  }

  async getMonth(year: number, month: number, location: PrayerLocation) {
    const response = await this.http.get(`/calendar/${year}/${month}`, { params: {
      latitude: location.latitude, longitude: location.longitude,
      timezonestring: location.timezone, method: METHOD_MAP[location.calculationMethod ?? 'MWL'] ?? 3,
    } });
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const rows = response.data?.data;
    if (!Array.isArray(rows) || rows.length !== days) throw new Error('Incomplete monthly calendar');
    return rows.map((row: any, index: number) => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
      const expected = `${String(index + 1).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
      if (row.date?.gregorian?.date !== expected) throw new Error('Unexpected calendar date');
      const clean = (value: string) => {
        const time = value?.split(' ')[0];
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid prayer time');
        return time;
      };
      return { date, fajr: clean(row.timings.Fajr), sunrise: clean(row.timings.Sunrise),
        dhuhr: clean(row.timings.Dhuhr), asr: clean(row.timings.Asr),
        maghrib: clean(row.timings.Maghrib), isha: clean(row.timings.Isha), source: 'aladhan' };
    });
  }
}
