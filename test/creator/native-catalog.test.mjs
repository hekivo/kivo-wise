// test/creator/native-catalog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { nativeCatalog, nativeField } from '../../plugins/kivo-creator/scripts/adapters/shared/native-block.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-radicle'));

test('reads every block.json below the app, skipping vendor and build folders', () => {
  const catalog = nativeCatalog(stack);
  assert.deepEqual(catalog.map((b) => b.name), ['acme/faq', 'acme/hero']);
  const hero = catalog.find((b) => b.name === 'acme/hero');
  assert.equal(hero.source, 'resources/blocks/hero/block.json');
  assert.deepEqual(hero.fields, [
    { name: 'heading', type: 'text' },
    { name: 'lead', type: 'text' },
    { name: 'image', type: 'image' },
    { name: 'button', type: 'link' },
  ]);
  assert.deepEqual(catalog[0].fields[1], { name: 'items', type: 'repeater', subFields: [{ name: 'question', type: 'text' }, { name: 'answer', type: 'wysiwyg' }] });
});

test('attribute types translate into the field vocabulary', () => {
  assert.deepEqual(nativeField('video_url', { type: 'string' }), { name: 'video_url', type: 'url' });
  assert.equal(nativeField('dark', { type: 'boolean' }), null);
  assert.equal(nativeField('settings', { type: 'object' }), null);
});
