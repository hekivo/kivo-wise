// test/creator/extract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSlots, extractLayout, extractTokens, roleNode, toSpec } from '../../plugins/kivo-creator/scripts/lib/segment.mjs';
import { checkSpec } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { hero, features, faq, stats } from './snapshots.mjs';

test('hero slots carry exact DOM values', () => {
  assert.deepEqual(extractSlots(hero()), [
    { name: 'heading', type: 'heading', value: 'Acme ships faster', provenance: 'exact' },
    { name: 'text', type: 'text', value: 'Plan, build and launch in one place.', provenance: 'exact' },
    { name: 'link', type: 'link', value: { href: 'https://acme.test/signup', text: 'Start free' }, provenance: 'exact' },
    { name: 'image', type: 'image', value: { src: 'https://acme.test/hero.png', alt: 'Acme dashboard' }, provenance: 'exact' },
  ]);
});

test('a repeated group becomes one list slot named items', () => {
  const slots = extractSlots(features());
  assert.deepEqual(slots.map((s) => s.name), ['heading', 'items']);
  assert.equal(slots[1].items.length, 3);
  assert.deepEqual(slots[1].items[0].map((s) => `${s.name}:${s.value}`), ['heading:Feature 1', 'text:Feature 1 explained.']);
});

test('details/summary items keep hidden answers', () => {
  const items = extractSlots(faq())[1].items;
  assert.deepEqual(items[2].map((s) => s.value), ['Question 3?', 'Answer 3.']);
});

test('layout: columns from the first row, alignment from the heading, media position', () => {
  assert.deepEqual(extractLayout(hero()), { columns: 1, align: 'left', media: 'right', repeat: 0 });
  assert.deepEqual(extractLayout(features()), { columns: 3, align: 'center', media: 'none', repeat: 3 });
  assert.deepEqual(extractLayout(stats()), { columns: 4, align: 'left', media: 'none', repeat: 4 });
});

test('tokens are computed styles per role, skipping empty values', () => {
  const tokens = extractTokens(hero());
  assert.deepEqual(tokens.map((t) => `${t.role}.${t.prop}=${t.value}`), [
    'section.paddingTop=80px',
    'section.paddingBottom=80px',
    'heading.color=rgb(17, 24, 39)',
    'heading.fontFamily=Inter, sans-serif',
    'heading.fontSize=56px',
    'heading.fontWeight=700',
    'heading.lineHeight=64px',
    'text.color=rgb(75, 85, 99)',
    'text.fontSize=18px',
    'button.backgroundColor=rgb(10, 132, 255)',
    'button.color=rgb(255, 255, 255)',
  ]);
  assert.ok(tokens.every((t) => t.provenance === 'exact' && t.node));
  assert.equal(roleNode(hero(), 'link'), null);
});

test('toSpec builds a valid spec; chrome sections are flagged', () => {
  const spec = toSpec({ node: hero(), chrome: false }, { index: 0, sourceRef: 'file:///acme/landing.html' });
  assert.equal(spec.id, '01-hero');
  assert.equal(spec.source.kind, 'html');
  assert.deepEqual(checkSpec(spec), []);
  const chrome = toSpec({ node: { ...hero(), tag: 'header' }, chrome: true }, { index: 5, sourceRef: 'x' });
  assert.equal(chrome.id, '06-header');
  assert.equal(chrome.chrome, true);
});
