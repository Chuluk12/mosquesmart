const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AudioScheduleService } = require('../dist/audio-schedule/audio-schedule.service');
const { nowInTimezone, addDays, zonedTimeToUtc } = require('../dist/prayer/utils/time.util');

test('countdown uses next day prayer and offset, respects disabled audio and end date', async () => {
  const today = nowInTimezone('Asia/Jakarta').date;
  const tomorrow = addDays(today, 1);
  const base = { id: 'voice', isActive: true, audio: { isActive: true }, daysOfWeek: [], scheduleType: 'PRAYER_RELATIVE', prayerName: 'DHUHR', offsetMinutes: -3, startDate: new Date(tomorrow) };
  const service = new AudioScheduleService({
    audioSchedule: { findMany: async () => [base, { ...base, id: 'off', audio: { isActive: false } }, { ...base, id: 'expired', endDate: new Date(today) }] },
    scheduleExecution: { findMany: async () => [] },
  }, { getEffectiveSchedule: async date => ({ effective: { dhuhr: date === tomorrow ? '11:43' : '11:44' }, stale: false }) }, { getOrCreate: async () => ({ timezone: 'Asia/Jakarta' }) });
  const result = await service.upcoming();
  assert.equal(result.items[0].atUtc, zonedTimeToUtc(tomorrow, '11:40', 'Asia/Jakarta').toISOString());
  assert.equal(result.items[1].atUtc, null);
  assert.equal(result.items[1].reason, 'Audio nonaktif');
  assert.equal(result.items[2].atUtc, null);
});
