/** Returns minutes-since-midnight "now" in the given IANA timezone (browser-safe, uses Intl only). */
export function nowMinutesInTimezone(timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  return hour * 60 + Number(map.minute);
}

export function formatClock(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.hour}:${value.minute}:${value.second} ${value.dayPeriod}`;
}

export function formatGregorian(timeZone: string): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

/** Approximate Hijri date using the ICU civil Islamic calendar built into Intl (no external dependency/API needed). */
export function formatHijri(timeZone: string): string {
  try {
    const formatted = new Intl.DateTimeFormat('id-ID-u-ca-islamic', { timeZone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    return /\bH\b/.test(formatted) ? formatted : `${formatted} H`;
  } catch {
    return '';
  }
}

/** Converts "today at minutesOfDay, in timeZone" into an absolute epoch-ms timestamp (handles the local UTC-offset correctly, browser-safe). */
export function todayMinuteToTimestamp(timeZone: string, minutesOfDay: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const guess = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0);

  const offsetParts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date(guess)).reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUtc = Date.UTC(
    Number(offsetParts.year), Number(offsetParts.month) - 1, Number(offsetParts.day),
    Number(offsetParts.hour) === 24 ? 0 : Number(offsetParts.hour), Number(offsetParts.minute), Number(offsetParts.second),
  );
  const offsetMin = Math.round((asUtc - guess) / 60000);
  return guess - offsetMin * 60000;
}
