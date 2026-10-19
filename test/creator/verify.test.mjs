// test/creator/verify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVerifyArgs, targetsFor } from '../../plugins/kivo-creator/scripts/verify.mjs';

test('options: run and url are required; threshold must be a ratio', () => {
  const o = parseVerifyArgs(['--run=.creator/r', '--url=https://acme.test/?p=12']);
  assert.equal(o.threshold, 0.02);
  assert.deepEqual(o.widths, [390, 1440]);
  assert.equal(o.selector, '[data-block]');
  assert.throws(() => parseVerifyArgs(['--run=x']), /--url/);
  assert.throws(() => parseVerifyArgs(['--run=x', '--url=y', '--threshold=2']), /between 0 and 1/);
});

test('targets skip chrome, gaps and skipped sections, in plan order', () => {
  const specs = [{ id: '01-header', chrome: true }, { id: '02-hero' }, { id: '03-stats' }, { id: '04-cta' }];
  const plan = { sections: [
    { spec: '01-header', decision: { action: 'skip' } },
    { spec: '02-hero', decision: { action: 'fill' } },
    { spec: '03-stats', decision: { action: 'gap' } },
    { spec: '04-cta', decision: { action: 'scaffold' } },
  ] };
  assert.deepEqual(targetsFor(specs, plan).map((s) => s.id), ['02-hero', '04-cta']);
});
