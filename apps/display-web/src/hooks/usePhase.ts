import { useEffect, useState } from 'react';
import { computeDisplayPhase, PhaseResult } from '../lib/displayState';
import { nowMinutesInTimezone } from '../lib/time';
import { PrayerToday } from './useMosqueData';

const DEFAULT: PhaseResult = { state: 'NORMAL', activePrayer: null, phaseEndMinute: null };

/** Re-evaluates the display phase every tick against the live clock, so transitions (e.g. into ADHAN) happen exactly on time without waiting for the next 30s data poll. */
export function usePhase(prayer: PrayerToday | null, timezone: string): PhaseResult {
  const [phase, setPhase] = useState<PhaseResult>(DEFAULT);

  useEffect(() => {
    if (!prayer) return;
    const evaluate = () => setPhase(computeDisplayPhase(prayer.effective, prayer.iqomah, nowMinutesInTimezone(timezone)));
    evaluate();
    const id = setInterval(evaluate, 1000);
    return () => clearInterval(id);
  }, [prayer, timezone]);

  return phase;
}
