// test/creator/style-check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styleCheck } from '../../plugins/kivo-creator/scripts/lib/style-check.mjs';
import { n, r } from './helpers.mjs';

const rendered = n('section', r(0, 400), [
  n('h2', r(10, 40), [], { text: 'Acme in numbers', style: { color: 'rgb(17, 24, 39)', fontSize: '35.8px' } }),
], { style: { backgroundColor: 'rgb(245, 247, 250)' } });

test('compares exact tokens with the rendered computed style; inferred tokens are ignored', () => {
  const spec = { tokens: [
    { role: 'section', prop: 'backgroundColor', value: '#f5f7fa', provenance: 'exact' },
    { role: 'heading', prop: 'fontSize', value: '36px', provenance: 'exact' },
    { role: 'heading', prop: 'color', value: 'rgb(0, 0, 0)', provenance: 'exact' },
    { role: 'text', prop: 'color', value: 'rgb(75, 85, 99)', provenance: 'exact' },
    { role: 'heading', prop: 'lineHeight', value: '40px', provenance: 'inferred' },
  ] };
  assert.deepEqual(styleCheck(spec, rendered), [
    { role: 'section', prop: 'backgroundColor', expected: '#f5f7fa', actual: 'rgb(245, 247, 250)', pass: true },
    { role: 'heading', prop: 'fontSize', expected: '36px', actual: '35.8px', pass: true },
    { role: 'heading', prop: 'color', expected: 'rgb(0, 0, 0)', actual: 'rgb(17, 24, 39)', pass: false },
    { role: 'text', prop: 'color', expected: 'rgb(75, 85, 99)', actual: null, pass: false, reason: 'no text element in the rendered section' },
  ]);
});
