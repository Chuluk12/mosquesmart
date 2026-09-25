const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PrayerService } = require('../dist/prayer/prayer.service');
const { AladhanPrayerProvider } = require('../dist/prayer/providers/aladhan.provider');

test('monthly provider validates leap month, missing dates and invalid times', async () => {
  const provider = new AladhanPrayerProvider();
  const rows = Array.from({ length: 29 }, (_, i) => ({ date: { gregorian: { date: `${String(i + 1).padStart(2, '0')}-02-2028` } }, timings: { Fajr: '04:30 (WIB)', Sunrise: '05:40', Dhuhr: '12:00', Asr: '15:00', Maghrib: '18:00', Isha: '19:00' } }));
  provider.http = { get: async () => ({ data: { data: rows } }) };
  const result = await provider.getMonth(2028, 2, {});
  assert.equal(result.length, 29);
  assert.equal(result[28].date, '2028-02-29');
  assert.equal(result[0].fajr, '04:30');
  rows[0].timings.Fajr = '25:00';
  await assert.rejects(provider.getMonth(2028, 2, {}), /Invalid prayer time/);
  rows.pop();
  await assert.rejects(provider.getMonth(2028, 2, {}), /Incomplete/);
});

test('monthly cache serves offline, applies offsets and excludes another location', async () => {
  const mosque = { id: 'test', latitude: -6, longitude: 107, timezone: 'Asia/Jakarta' };
  const settings = { calculationMethod: 'MWL', fajrOffsetMin: 2 };
  let calls = 0, offline = false;
  const rows = [];
  const prisma = {
    prayerSetting: { findUnique: async () => settings },
    prayerSchedule: {
      findMany: async ({ where }) => rows.filter(row => row.cacheKey === where.cacheKey && row.date >= where.date.gte && row.date < where.date.lt),
      upsert: async ({ create }) => { rows.push(create); return create; },
    },
    $transaction: async jobs => Promise.all(jobs),
  };
  const service = new PrayerService(prisma, { getOrCreate: async () => mosque }, { emit() {} }, {
    getMonth: async () => {
      calls++;
      if (offline) throw new Error('offline');
      return Array.from({ length: 28 }, (_, i) => ({ date: `2027-02-${String(i + 1).padStart(2, '0')}`, fajr: '04:30', dhuhr: '12:00', asr: '15:00', maghrib: '18:00', isha: '19:00', source: 'aladhan' }));
    },
  });
  assert.equal((await service.getMonth(2027, 2)).complete, true);
  offline = true;
  assert.equal((await service.getMonth(2027, 2)).days[0].effective.fajr, '04:32');
  assert.equal(calls, 1);
  const fallback = await service.getMonth(2027, 2, true);
  assert.equal(fallback.days.length, 28);
  assert.ok(fallback.warning);
  mosque.latitude = -1;
  const other = await service.getMonth(2027, 2);
  assert.equal(other.days.length, 0);
  assert.equal(other.complete, false);
  await assert.rejects(service.getMonth(2027, 13), /tidak valid/);
});
