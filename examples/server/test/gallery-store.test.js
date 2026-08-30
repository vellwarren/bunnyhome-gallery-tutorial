import assert from 'node:assert/strict';
import test from 'node:test';
import { GalleryStore, objectPaths } from '../src/gallery-store.js';
import { decodeImage } from '../src/image.js';

function conflictError() {
  return Object.assign(new Error('The resource already exists'), { statusCode: '409' });
}

function notFoundError() {
  return Object.assign(new Error('Object not found'), { statusCode: '404' });
}

function createStorageMock() {
  const objects = new Map();
  const failures = [];
  const api = {
    objects,
    failNext(pattern, message = 'injected failure') { failures.push({ pattern, message }); },
    async upload(path, body, options = {}) {
      const failureIndex = failures.findIndex((failure) => failure.pattern.test(path));
      if (failureIndex >= 0) {
        const [failure] = failures.splice(failureIndex, 1);
        return { data: null, error: Object.assign(new Error(failure.message), { statusCode: '500' }) };
      }
      if (objects.has(path) && options.upsert === false) return { data: null, error: conflictError() };
      objects.set(path, Buffer.from(body));
      return { data: { path }, error: null };
    },
    async update(path, body) {
      if (!objects.has(path)) return { data: null, error: notFoundError() };
      objects.set(path, Buffer.from(body));
      return { data: { path }, error: null };
    },
    async download(path) {
      if (!objects.has(path)) return { data: null, error: notFoundError() };
      return { data: new Blob([objects.get(path)]), error: null };
    },
    async remove(paths) {
      paths.forEach((path) => objects.delete(path));
      return { data: paths, error: null };
    },
    async createSignedUrl(path, expiresIn) {
      return { data: { signedUrl: `https://signed.example/${path}?ttl=${expiresIn}` }, error: null };
    },
    async list() { return { data: [], error: null }; },
  };
  return api;
}

function fixture() {
  const buffer = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from('gallery-store-test'),
  ]);
  return decodeImage({ media_type: 'image/png', data: buffer.toString('base64') });
}

function createStore(storage) {
  const supabase = { storage: { from: () => storage } };
  return new GalleryStore({ supabase, bucket: 'private-gallery', signedUrlTtl: 120 });
}

const createInput = (image) => ({
  image,
  title: '窗台上的光',
  description: '画面中央是一扇白色窗户，浅金色日光落在木质窗台上，右侧放着一只透明玻璃杯。',
  firstImpression: '我想把今天这点安静替你留住。',
  contextNote: '今天的光很好看。',
  firstSeenAt: '2026-08-30T00:00:00.000Z',
});

test('concurrent identical saves create one image and one metadata object', async () => {
  const storage = createStorageMock();
  const store = createStore(storage);
  const image = fixture();
  const [first, second] = await Promise.all([
    store.create('user-1', createInput(image)),
    store.create('user-1', createInput(image)),
  ]);

  assert.equal([first.created, second.created].filter(Boolean).length, 1);
  assert.equal(first.item.id, image.hash);
  assert.equal(second.item.id, image.hash);
  const paths = objectPaths('user-1', image.hash, 'png');
  assert.equal(storage.objects.has(paths.image), true);
  assert.equal(storage.objects.has(paths.metadata), true);
  assert.equal(storage.objects.has(paths.claim), false);
});

test('metadata failure compensates a newly uploaded image and releases its claim', async () => {
  const storage = createStorageMock();
  const store = createStore(storage);
  const image = fixture();
  const paths = objectPaths('user-1', image.hash, 'png');
  storage.failNext(/\/meta\//, 'metadata unavailable');

  await assert.rejects(() => store.create('user-1', createInput(image)), /metadata unavailable/);
  assert.equal(storage.objects.has(paths.image), false);
  assert.equal(storage.objects.has(paths.metadata), false);
  assert.equal(storage.objects.has(paths.claim), false);
});

test('image upload failure never writes metadata', async () => {
  const storage = createStorageMock();
  const store = createStore(storage);
  const image = fixture();
  const paths = objectPaths('user-1', image.hash, 'png');
  storage.failNext(/\/images\//, 'image unavailable');

  await assert.rejects(() => store.create('user-1', createInput(image)), /image unavailable/);
  assert.equal(storage.objects.has(paths.image), false);
  assert.equal(storage.objects.has(paths.metadata), false);
  assert.equal(storage.objects.has(paths.claim), false);
});
