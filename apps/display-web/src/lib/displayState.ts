import { DisplayState, PrayerKey } from '@mosque/shared-types';

const PRAYER_ORDER: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

// Fixed durations for phases the backend does not itself schedule the end
// of (adhan audio length, how long the "sedang sholat" screen is shown).
// Iqomah duration comes from admin-configured settings per prayer instead.
export const ADHAN_DURATION_MIN = 4;
export const PRAYER_DURATION_MIN = 15;
export const PRE_PRAYER_WINDOW_MIN = 10;

export interface PhaseResult {
  state: DisplayState;
  activePrayer: PrayerKey | null;
  /** Minutes-of-day (0-1439) at which the *current* phase ends and the next check should re-evaluate. */
  phaseEndMinute: number | null;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Pure function mapping "what time is it, and what are today's prayer
 * times" to a Display TV state. Kept pure and dependency-free so it can be
 * unit tested directly (see displayState.test.ts) without any DOM, React,
 * or network involved.
 */
export function computeDisplayPhase(effective: Record<PrayerKey, string>, iqomah: Record<PrayerKey, number>, nowMinutes: number): PhaseResult {
  for (let i = PRAYER_ORDER.length - 1; i >= 0; i--) {
    const key = PRAYER_ORDER[i];
    const prayerMin = timeToMinutes(effective[key]);
    if (nowMinutes < prayerMin) continue;

    const elapsed = nowMinutes - prayerMin;
    const adhanEnd = ADHAN_DURATION_MIN;
    const iqomahEnd = adhanEnd + (iqomah[key] ?? 10);
    const prayerEnd = iqomahEnd + PRAYER_DURATION_MIN;

    if (elapsed < adhanEnd) return { state: 'ADHAN', activePrayer: key, phaseEndMinute: prayerMin + adhanEnd };
    if (elapsed < iqomahEnd) return { state: 'IQOMAH_COUNTDOWN', activePrayer: key, phaseEndMinute: prayerMin + iqomahEnd };
    if (elapsed < prayerEnd) return { state: 'PRAYER', activePrayer: key, phaseEndMinute: prayerMin + prayerEnd };
    break; // this prayer's cycle is over; fall through to NORMAL/PRE_PRAYER against the next one
  }

  // Not inside any prayer's ADHAN/IQOMAH/PRAYER window -- find the next upcoming prayer today.
  const next = PRAYER_ORDER.find((key) => timeToMinutes(effective[key]) > nowMinutes);
  if (!next) return { state: 'NORMAL', activePrayer: null, phaseEndMinute: null }; // after Isha; next is tomorrow's Fajr

  const nextMin = timeToMinutes(effective[next]);
  if (nextMin - nowMinutes <= PRE_PRAYER_WINDOW_MIN) {
    return { state: 'PRE_PRAYER', activePrayer: next, phaseEndMinute: nextMin };
  }
  return { state: 'NORMAL', activePrayer: null, phaseEndMinute: nextMin - PRE_PRAYER_WINDOW_MIN };
}
