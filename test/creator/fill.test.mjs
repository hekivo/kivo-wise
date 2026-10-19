// test/creator/fill.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { assign, valueFor } from '../../plugins/kivo-creator/scripts/lib/fill.mjs';
import { acfCatalog } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { FIX } from './helpers.mjs';

const catalog = acfCatalog(resolveStack(join(FIX, 'projects', 'acme-mu-plugin')));
const block = (name) => catalog.find((b) => b.name === name);
const [hero, faq, testimonial, stats] = readSpecs(join(FIX, 'runs', 'landing', 'specs'));
const fits = (spec) => catalog.filter((b) => assign(spec.slots, b.fields).leftovers.length === 0).map((b) => b.name);

test('names first, then type: the hero slots land in title, lead, image and cta', () => {
  const r = assign(hero.slots, block('acf/hero').fields);
  assert.deepEqual(r.pairs.map((p) => `${p.slot.name}->${p.field.name}`), ['heading->title', 'text->lead', 'image->image', 'link->cta']);
  assert.equal(r.coverage, 1);
});

test('which blocks can hold each fixture section', () => {
  assert.deepEqual(fits(hero), ['acf/hero']);
  assert.deepEqual(fits(faq), ['acf/faq', 'acf/feature-grid']);
  assert.deepEqual(fits(testimonial), ['acf/hero']);
  assert.deepEqual(fits(stats), ['acf/faq', 'acf/feature-grid']);
});

test('a list longer than the repeater max does not fit', () => {
  const many = { ...stats, slots: [stats.slots[0], { ...stats.slots[1], items: Array(7).fill(stats.slots[1].items[0]) }] };
  assert.deepEqual(fits(many), ['acf/faq']);
});

test('values are shaped per field type', () => {
  assert.deepEqual(valueFor(hero.slots[3], { type: 'link' }), { url: 'https://acme.test/signup', title: 'Start free', target: '' });
  assert.equal(valueFor(hero.slots[0], { type: 'text' }), 'Acme ships faster');
  assert.equal(valueFor({ type: 'embed', value: { src: 'https://video.acme.test/1' } }, { type: 'oembed' }), 'https://video.acme.test/1');
});
