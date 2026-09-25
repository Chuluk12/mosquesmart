const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PrayerService } = require('../dist/prayer/prayer.service');

test('cache follows location, timezone and method; offline fallback cannot cross locations', async () => {
  const mosque = { id: 'test', latitude: -6.2394, longitude: 106.9927, timezone: 'Asia/Jakarta' };
  const settings = { calculationMethod: 'MWL' };
  let row;
  let calls = 0;
  let offline = false;
  const prisma = {
    prayerSetting: { findUnique: async () => settings },
    prayerSchedule: {
      findUnique: async ({ where }) => row?.date.getTime() === where.mosqueId_date.date.getTime() ? row : null,
      upsert: async ({ create }) => { row = create; },
      findFirst: async ({ where }) => row?.cacheKey === where.cacheKey ? row : null,
    },
  };
  const service = new PrayerService(prisma, { getOrCreate: async () => mosque }, { emit() {} }, {
    getPrayerTimes: async () => {
      calls++;
      if (offline) throw new Error('offline');
      return { fajr: '04:30', sunrise: '05:40', dhuhr: '12:00', asr: '15:00', maghrib: '18:00', isha: '19:00', source: 'test' };
    },
  });
  await service.getRawSchedule('2026-09-22');
  await service.getRawSchedule('2026-09-22');
  assert.equal(calls, 1);
  mosque.latitude = -1.26753;
  mosque.longitude = 116.82887;
  await service.getRawSchedule('2026-09-22');
  assert.equal(calls, 2);
  mosque.timezone = 'Asia/Makassar';
  await service.getRawSchedule('2026-09-22');
  assert.equal(calls, 3);
  settings.calculationMethod = 'KEMENAG';
  await service.getRawSchedule('2026-09-22');
  assert.equal(calls, 4);
  offline = true;
  assert.equal((await service.getRawSchedule('2026-09-23')).stale, true);
  mosque.latitude = -6.2394;
  await assert.rejects(service.getRawSchedule('2026-09-23'), /unavailable/);
});
