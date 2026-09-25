/**
 * Timezone-aware time helpers built on the built-in Intl API only (no extra
 * dependency). The system treats prayer times as wall-clock "HH:mm" strings
 * in the mosque's configured IANA timezone; these helpers convert between
 * that representation and absolute UTC instants (needed for countdowns and
 * for the scheduler, which must fire at the correct real-world moment
 * regardless of the server's own timezone).
 */

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Returns { date: 'YYYY-MM-DD', time: 'HH:mm', weekday: 0-6 (Sun-Sat) } for "now" in the given IANA timezone. */
export function nowInTimezone(timeZone: string): { date: string; time: string; weekday: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour === '24' ? '00' : map.hour}:${map.minute}`,
    weekday: weekdayMap[map.weekday] ?? now.getUTCDay(),
  };
}

/** Returns the timezone's current UTC offset in minutes (e.g. Asia/Jakarta -> 420). */
export function timezoneOffsetMinutes(timeZone: string, atUtc: Date = new Date()): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = dtf.formatToParts(atUtc).reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((asUTC - atUtc.getTime()) / 60000);
}

/** Converts a wall-clock "YYYY-MM-DD" + "HH:mm" in `timeZone` into an absolute UTC Date. */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  // First guess treating the wall-clock as if it were UTC, then correct by the zone's offset.
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const offset = timezoneOffsetMinutes(timeZone, guess);
  return new Date(guess.getTime() - offset * 60000);
}

/** Adds `minutes` (can be negative) to an "HH:mm" string, wrapping within a single day. */
export function addMinutesToTimeString(time: string, minutes: number): string {
  const [hh, mm] = time.split(':').map(Number);
  let total = hh * 60 + mm + minutes;
  total = ((total % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export function compareTimeStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
