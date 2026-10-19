// test/creator/adapters.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertAdapter, selectAdapter, ADAPTER_FOR_PROFILE } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';

test('assertAdapter names every missing member', () => {
  assert.throws(() => assertAdapter({ name: 'x', catalog() {} }), /adapter x misses profiles, selector, allowsGeneratedBlocks, emitPage, scaffoldBlock, themeCss/);
});

test('profiles map to adapters; an unknown profile is an error', async () => {
  assert.equal(ADAPTER_FOR_PROFILE['radicle-app'], 'radicle');
  await assert.rejects(selectAdapter({ profile: 'nope' }), /No adapter for profile "nope"/);
});
