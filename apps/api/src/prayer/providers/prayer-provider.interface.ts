export interface RawPrayerTimes {
  fajr: string;
  sunrise: string | null;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  source: string;
}

export interface PrayerLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  calculationMethod?: string;
}

/**
 * Abstraction over "where prayer times come from". Nothing else in the app
 * talks to an external prayer-time API directly, so the source can be
 * swapped (a different API, a local calculation library, manual entry)
 * without touching the engine, scheduler, or display.
 */
export const PRAYER_PROVIDER = Symbol('PRAYER_PROVIDER');

export interface PrayerProvider {
  getMonth(year: number, month: number, location: PrayerLocation): Promise<(RawPrayerTimes & { date: string })[]>;
  getPrayerTimes(date: string, location: PrayerLocation): Promise<RawPrayerTimes>;
}
