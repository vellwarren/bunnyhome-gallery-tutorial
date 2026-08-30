import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeImage, cleanTitle } from '../src/image.js';

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.from('minimal-test-payload'),
]);

test('decodes an allowed image and creates a stable binary hash', () => {
  const first = decodeImage({ media_type: 'image/png', data: png.toString('base64') });
  const second = decodeImage({ media_type: 'image/png', data: `data:image/png;base64,${png.toString('base64')}` });
  assert.equal(first.hash, second.hash);
  assert.equal(first.extension, 'png');
  assert.deepEqual(first.buffer, png);
});

test('a binary change creates a different hash', () => {
  const first = decodeImage({ media_type: 'image/png', data: png.toString('base64') });
  const changed = decodeImage({ media_type: 'image/png', data: Buffer.concat([png, Buffer.from('re-encoded')]).toString('base64') });
  assert.notEqual(first.hash, changed.hash);
});

test('rejects a media type that does not match the binary signature', () => {
  assert.throws(
    () => decodeImage({ media_type: 'image/jpeg', data: png.toString('base64') }),
    /image_signature_mismatch/,
  );
});

test('bounds titles by Unicode code points', () => {
  assert.equal(cleanTitle('  一张小图  '), '一张小图');
  assert.equal(Array.from(cleanTitle('图'.repeat(80))).length, 60);
});

