import assert from 'node:assert/strict';
import test from 'node:test';
import { bearerToken } from '../src/auth.js';
import { objectPaths } from '../src/gallery-store.js';

test('extracts only a bearer token', () => {
  assert.equal(bearerToken('Bearer abc.def'), 'abc.def');
  assert.equal(bearerToken('basic abc'), null);
  assert.equal(bearerToken(''), null);
});

test('scopes every gallery object beneath the authenticated user prefix', () => {
  const hash = 'a'.repeat(64);
  assert.deepEqual(objectPaths('user-123', hash, 'webp'), {
    image: `users/user-123/images/${hash}.webp`,
    metadata: `users/user-123/meta/${hash}.json`,
    claim: `users/user-123/claims/${hash}.json`,
  });
});

