export type PrayerName = 'FAJR' | 'DHUHR' | 'ASR' | 'MAGHRIB' | 'ISHA';
export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type PlayerCommand = { type: 'PLAY' | 'STOP' | 'PAUSE' | 'RESUME' | 'SET_VOLUME'; payload?: unknown };

/** Display TV state machine — see apps/display-web/src/lib/displayState.ts for the transition logic. */
export type DisplayState = 'NORMAL' | 'PRE_PRAYER' | 'ADHAN' | 'IQOMAH_COUNTDOWN' | 'PRAYER';

export interface EffectiveSchedule {
  date: string;
  timezone: string;
  effective: Record<PrayerKey, string>;
  iqomah: Record<PrayerKey, number>;
}
