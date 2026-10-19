// test/creator/segment.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segment, textOf, MIN_SECTION_HEIGHT } from '../../plugins/kivo-creator/scripts/lib/segment.mjs';
import { n, r } from './helpers.mjs';
import { landing, hero, cta } from './snapshots.mjs';

const tags = (sections) => sections.map((s) => `${s.chrome ? 'chrome:' : ''}${s.node.tag}`);

test('main content becomes sections; header and footer become chrome, in page order', () => {
  assert.deepEqual(tags(segment(landing())), ['chrome:header', 'section', 'section', 'section', 'section', 'chrome:footer']);
});

test('single wrappers around header, main and footer are unwrapped', () => {
  assert.deepEqual(tags(segment(landing({ wrap: true }))), ['chrome:header', 'section', 'section', 'section', 'section', 'chrome:footer']);
});

test('without <main>, the body children that are not chrome are the sections', () => {
  const body = n('body', r(0, 900), [n('header', r(0, 80)), hero(), cta()]);
  assert.deepEqual(tags(segment(body)), ['chrome:header', 'section', 'section']);
});

test('short siblings merge into the previous section; empty ones are dropped', () => {
  const note = n('div', r(680, 40), [], { text: 'Trusted by 4,000 teams' });
  const spacer = n('div', r(720, 20));
  const main = n('main', r(80, 900), [hero(), note, spacer, cta()]);
  const sections = segment(n('body', r(0, 1000), [main]));
  assert.equal(sections.length, 2);
  assert.match(textOf(sections[0].node), /Trusted by 4,000 teams$/);
  assert.deepEqual(sections[0].node.merged, [note.path]);
  assert.ok(MIN_SECTION_HEIGHT === 80);
});

test('invisible nodes are not sections', () => {
  const hidden = { ...cta(), visible: false };
  const main = n('main', r(80, 900), [hero(), hidden]);
  assert.equal(segment(n('body', r(0, 1000), [main])).length, 1);
});
