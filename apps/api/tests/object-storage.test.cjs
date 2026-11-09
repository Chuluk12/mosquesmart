const assert = require('node:assert/strict');
const { test } = require('node:test');

function loadStorage(credentials = true) {
  for (const key of ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) delete process.env[key];
  process.env.S3_ENDPOINT = 'https://bucket.gte.co.id';
  process.env.S3_BUCKET = 'mosquesmart';
  if (credentials) {
    process.env.S3_ACCESS_KEY_ID = 'test-access';
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
  }
  const modulePath = require.resolve('../src/object-storage/object-storage.service.ts');
  delete require.cache[modulePath];
  return require(modulePath).ObjectStorageService;
}

test('S3 adapter sends objects to configured bucket and keys', async () => {
  const ObjectStorageService = loadStorage();
  const storage = new ObjectStorageService();
  const calls = [];
  storage.client = { send: async command => {
    calls.push(command);
    if (command.constructor.name === 'GetObjectCommand') return { Body: 'stream', ContentType: 'audio/mpeg' };
    if (command.constructor.name === 'HeadObjectCommand') return {};
    return {};
  }};

  await storage.put('audio/test.mp3', Buffer.from('audio'), 'audio/mpeg');
  const object = await storage.get('audio/test.mp3');
  await storage.remove('audio/test.mp3');
  assert.equal(await storage.exists('audio/test.mp3'), true);
  assert.deepEqual(calls.map(call => call.constructor.name), [
    'PutObjectCommand', 'GetObjectCommand', 'DeleteObjectCommand', 'HeadObjectCommand',
  ]);
  assert.equal(calls[0].input.Bucket, 'mosquesmart');
  assert.equal(calls[0].input.Key, 'audio/test.mp3');
  assert.equal(calls[0].input.ContentType, 'audio/mpeg');
  assert.equal(object.ContentType, 'audio/mpeg');
});

test('S3 adapter reports missing object without hiding other errors', async () => {
  const ObjectStorageService = loadStorage();
  const storage = new ObjectStorageService();
  storage.client = { send: async () => { throw Object.assign(new Error('missing'), { name: 'NoSuchKey' }); } };
  assert.equal(await storage.exists('content-images/missing'), false);

  storage.client = { send: async () => { throw Object.assign(new Error('denied'), { name: 'AccessDenied' }); } };
  await assert.rejects(storage.exists('content-images/denied'), /denied/);
});

test('S3 adapter stays disabled when credentials are absent', async () => {
  const ObjectStorageService = loadStorage(false);
  const storage = new ObjectStorageService();
  assert.equal(storage.isEnabled(), false);
  assert.equal(await storage.exists('audio/local.mp3'), false);
  await assert.rejects(storage.put('audio/local.mp3', Buffer.from('audio'), 'audio/mpeg'), /not configured/);
});
