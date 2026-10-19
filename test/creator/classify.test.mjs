// test/creator/classify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, repeatedGroup } from '../../plugins/kivo-creator/scripts/lib/segment.mjs';
import { n, r } from './helpers.mjs';
import { hero, features, faq, cta, stats } from './snapshots.mjs';

test('the landing sections get the expected kinds', () => {
  assert.equal(classify(hero()), 'hero');
  assert.equal(classify(features()), 'features');
  assert.equal(classify(faq()), 'faq');
  assert.equal(classify(cta()), 'cta');
  assert.equal(classify(stats()), 'stats');
});

test('forms, quotes, logos, steps, media and text', () => {
  assert.equal(classify(n('section', r(0, 300), [n('h2', r(0, 40), [], { text: 'Contact' }), n('form', r(50, 200), [n('input', r(50, 40), [], { attrs: { name: 'email' } })])])), 'form');
  assert.equal(classify(n('section', r(0, 300), [n('blockquote', r(0, 100), [], { text: 'Acme changed how we ship.' })])), 'testimonial');
  const logo = (i) => n('img', r(0, 40, i * 200, 120), [], { attrs: { src: `https://acme.test/l${i}.svg`, alt: '' } });
  assert.equal(classify(n('section', r(0, 120), [logo(0), logo(1), logo(2), logo(3)])), 'logos');
  const step = (i) => n('li', r(100, 80, i * 300, 280), [n('h3', r(100, 30, i * 300, 280), [], { text: `Sign up ${i}` })]);
  assert.equal(classify(n('section', r(0, 300), [n('h2', r(0, 40), [], { text: 'How it works' }), n('ol', r(100, 80), [step(1), step(2), step(3)])])), 'steps');
  assert.equal(classify(n('section', r(0, 500), [n('iframe', r(0, 500), [], { attrs: { src: 'https://video.acme.test/1' } })])), 'media');
  assert.equal(classify(n('section', r(0, 500), [n('h2', r(0, 40), [], { text: 'About' }), n('p', r(50, 40), [], { text: 'One.' }), n('p', r(90, 40), [], { text: 'Two.' }), n('p', r(130, 40), [], { text: 'Three.' })])), 'text');
});

test('repeatedGroup finds 3+ siblings with the same tag and classes', () => {
  const group = repeatedGroup(features());
  assert.equal(group.items.length, 3);
  assert.equal(group.container.cls[0], 'grid');
  assert.equal(repeatedGroup(cta()), null);
});
