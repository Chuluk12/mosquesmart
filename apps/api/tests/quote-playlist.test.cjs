require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
const { PrismaClient, TriggerType, PlaybackStatus } = require('@prisma/client');
const { validateSync } = require('class-validator');
const { QuotePlaylistService } = require('../dist/quote-playlist/playlist.service');
const { CreatePlaylistDto } = require('../dist/quote-playlist/playlist.dto');
const { PlayerService } = require('../dist/player/player.service');
const prisma = new PrismaClient();
const prefix = 'quote-test-' + randomUUID();
const createdAudio = [], createdPlaylists = [], devices = [prefix];
const calls = [];
const realtime = { emit() {} };
let player, service;
const settings = { name: prefix, times: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'], daysOfWeek: [1,2,3,4,5], volume: 80, isActive: true };
const scheduleDate = '2099-01-05';
async function makePlaylist(count) {
  const p = await service.create({ ...settings, audioIds: createdAudio.slice(0, count) });
  createdPlaylists.push(p.id); return p;
}
async function run(p, time) { await service.dispatch(p.id, scheduleDate, time, 1); return prisma.quoteRun.findFirst({ where: { playlistId: p.id, slot: scheduleDate + ' ' + time } }); }
async function finish(r) {
  assert.ok(r); await player.reportStatus(prefix, r.id, PlaybackStatus.PLAYING);
  await player.reportStatus(prefix, r.id, PlaybackStatus.FINISHED);
}
(async () => {
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname), 'Tests must use a local database');
  const mosque = await prisma.mosque.findFirst();
  assert.ok(mosque, 'Local mosque fixture required');
  const mosqueService = { getOrCreate: async () => mosque };
  const audioService = { findOne: id => prisma.audio.findUniqueOrThrow({ where: { id } }), publicUrl: id => '/fake/' + id };
  player = new PlayerService(prisma, mosqueService, audioService, realtime);
  player.bindServer({ to: () => ({ emit: (event, payload) => calls.push({ event, payload }) }) });
  // No real sockets: this device records commands only, never emits sound.
  await player.registerConnection(prefix, prefix, prefix);
  service = new QuotePlaylistService(prisma, mosqueService, player);
  for (let i=0;i<3;i++) {
    const a = await prisma.audio.create({ data: { mosqueId: mosque.id, name: prefix + i, category: 'GENERAL', filePath: prefix, isActive: true } });
    createdAudio.push(a.id);
  }
  const valid = Object.assign(new CreatePlaylistDto(), settings, { audioIds: createdAudio });
  assert.equal(validateSync(valid).length, 0);
  for (const patch of [{ times: ['25:00'] }, { times: ['08:00','08:00'] }, { daysOfWeek: [] }, { daysOfWeek: [7] }, { volume: 101 }, { audioIds: [] }]) {
    assert.ok(validateSync(Object.assign(new CreatePlaylistDto(), valid, patch)).length, JSON.stringify(patch));
  }
  const p = await makePlaylist(3);
  const attempts = await Promise.allSettled([run(p, '08:00'), run(p, '08:00')]);
  assert.ok(attempts.some(r => r.status === 'fulfilled'));
  assert.equal(await prisma.quoteRun.count({ where: { playlistId: p.id } }), 1, 'concurrent tick idempotency');
  assert.equal(calls.length, 1);
  const first = await prisma.quoteRun.findFirst({ where: { playlistId: p.id } });
  await finish(first);
  await assert.rejects(service.approve(p.id, 1, 'test-admin'), /seluruh stok/);
  await finish(await run(p, '09:00'));
  await finish(await run(p, '10:00'));
  const runs = await prisma.quoteRun.findMany({ where: { playlistId: p.id } });
  assert.equal(new Set(runs.map(r => r.audioId)).size, 3, 'no repeats before exhaustion');
  assert.equal(await run(p, '11:00'), null, 'exhausted playlist stops');
  // A new service instance reads the same durable usage.
  const restarted = new QuotePlaylistService(prisma, mosqueService, player);
  await restarted.dispatch(p.id, scheduleDate, '13:00', 1);
  assert.equal(calls.length, 3, 'restart must not reset usage');
  const approvals = await Promise.allSettled([service.approve(p.id, 1, 'test-admin'), service.approve(p.id, 1, 'test-admin')]);
  assert.equal(approvals.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await prisma.quotePlaylist.findUnique({ where: { id: p.id } })).cycle, 2);
  assert.equal(await prisma.quoteApproval.count({ where: { playlistId: p.id } }), 1);
  await run(p, '08:00');
  assert.equal(calls.length, 3, 'approval must not replay an already dispatched slot');
  await finish(await run(p, '14:00'));
  assert.equal(calls.length, 4, 'approved cycle plays at a new slot');

  const errors = await makePlaylist(1);
  const failed = await run(errors, '08:00');
  await player.reportStatus(prefix, failed.id, PlaybackStatus.ERROR, 'test-before-play');
  assert.equal((await prisma.quoteRun.findUnique({ where: { id: failed.id } })).audioId, null, 'pre-play error returns stock');
  const partial = await run(errors, '09:00');
  await player.reportStatus(prefix, partial.id, PlaybackStatus.PLAYING);
  await player.reportStatus(prefix, partial.id, PlaybackStatus.ERROR, 'test-after-play');
  assert.notEqual((await prisma.quoteRun.findUnique({ where: { id: partial.id } })).audioId, null, 'heard audio stays consumed');
  assert.equal(await run(errors, '10:00'), null);

  const offline = await makePlaylist(1);
  await player.handleDisconnect(prefix);
  assert.equal(await run(offline, '08:00'), null, 'offline does not consume a slot or audio');
  await player.registerConnection(prefix, prefix, prefix);
  assert.equal(await run(offline, '08:00') !== null, true, 'reconnect in same minute can dispatch');
  const pending = await prisma.quoteRun.findFirst({ where: { playlistId: offline.id } });
  await assert.rejects(service.approve(offline.id, 1, 'test-admin'), /belum selesai/);
  await assert.rejects(service.resolveInterrupted(offline.id, pending.id, 'test-admin'), /masih online/);
  await player.handleDisconnect(prefix);
  await service.resolveInterrupted(offline.id, pending.id, 'test-admin');
  const resolved = await prisma.quoteRun.findUnique({ where: { id: pending.id } });
  assert.equal(resolved.status, 'REVIEWED'); assert.ok(resolved.audioId);
  await service.approve(offline.id, 1, 'test-admin');

  const inactive = await makePlaylist(1);
  await player.registerConnection(prefix, prefix, prefix);
  await service.update(inactive.id, { ...settings, isActive: false });
  assert.equal(await run(inactive, '08:00'), null);
  await service.update(inactive.id, settings);
  await service.dispatch(inactive.id, scheduleDate, '08:00', 0);
  assert.equal(await prisma.quoteRun.count({ where: { playlistId: inactive.id } }), 0, 'unselected weekday');
  await service.dispatch(inactive.id, scheduleDate, '08:01', 1);
  assert.equal(await prisma.quoteRun.count({ where: { playlistId: inactive.id } }), 0, 'unselected time');
  const summary = (await service.list()).find(p => p.id === errors.id);
  assert.equal(summary.remaining, 0); assert.equal(summary.usedCount, 1);
  console.log('PASS: validation, random exhaustion, durable restart, concurrent slots/approval, approval audit, no slot replay, errors before/after playback, offline recovery, interruption review, days/time/activation, stock counts.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  await prisma.playbackHistory.deleteMany({ where: { playerDeviceId: { in: devices } } });
  await prisma.quotePlaylist.deleteMany({ where: { id: { in: createdPlaylists } } });
  await prisma.audioPlayer.deleteMany({ where: { deviceId: { in: devices } } });
  await prisma.audio.deleteMany({ where: { id: { in: createdAudio } } });
  await prisma.$disconnect();
});