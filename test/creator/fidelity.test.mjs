// test/creator/fidelity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSection, summarize, formatFidelity } from '../../plugins/kivo-creator/scripts/lib/fidelity.mjs';

const spec = { id: '01-hero', kind: 'hero' };

test('a section passes when the diff is within the limit and every style matches', () => {
  const row = evaluateSection({ spec, width: 390, diff: { ratio: 0.005, sizeMatch: true }, styles: [], threshold: 0.02 });
  assert.equal(row.pass, true);
  const missing = evaluateSection({ spec, width: 390, diff: null, styles: [], threshold: 0.02 });
  assert.equal(missing.pass, true);
  assert.equal(missing.pixel.reason, 'no reference image');
});

test('formats the report table, the style mismatches and the lint findings', () => {
  const rows = [
    evaluateSection({ spec, width: 390, diff: { ratio: 0.005, sizeMatch: true }, styles: [], threshold: 0.02 }),
    evaluateSection({ spec, width: 1440, diff: { ratio: 0.031, sizeMatch: false }, threshold: 0.02, styles: [
      { role: 'heading', prop: 'color', expected: 'rgb(17, 24, 39)', actual: 'rgb(17, 24, 39)', pass: true },
      { role: 'heading', prop: 'fontSize', expected: '56px', actual: '48px', pass: false },
    ] }),
  ];
  const result = summarize(rows, [{ file: 'x.blade.php', line: 3, rule: 'arbitrary-value', match: 'bg-[#fff]' }]);
  assert.equal(result.pass, false);
  assert.equal(formatFidelity(result, { run: 'run-1', threshold: 0.02 }), [
    '# Fidelity report: run-1',
    '',
    'Result: **FAIL** (pixel limit 2.00% per section and width)',
    '',
    '| Section | Kind | Width | Pixel diff | Styles | Result |',
    '|---|---|---|---|---|---|',
    '| 01-hero | hero | 390 | 0.50% | - | pass |',
    '| 01-hero | hero | 1440 | 3.10% (size differs) | 1/2 | FAIL |',
    '',
    '## Style mismatches',
    '',
    '- `01-hero` at 1440 px: heading fontSize expected 56px, got 48px',
    '',
    '## Lint',
    '',
    '- `x.blade.php:3` arbitrary-value `bg-[#fff]`',
    '',
  ].join('\n'));
});
