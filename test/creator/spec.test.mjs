// test/creator/spec.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkSpec, readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { parseOptions } from '../../plugins/kivo-creator/scripts/lib/args.mjs';
import { PLUGIN, validSpec } from './helpers.mjs';

test('checkSpec adds semantic checks on top of the schema', () => {
  const spec = validSpec();
  spec.slots.push({ name: 'heading', type: 'image', value: { alt: 'x' }, provenance: 'exact' });
  spec.slots.push({ name: 'empty', type: 'list', provenance: 'exact', items: [] });
  spec.slots.push({ name: 'blank', type: 'text', value: '', provenance: 'inferred' });
  spec.refs.desktop = 'refs/x.png';
  assert.deepEqual(checkSpec(spec), [
    '$.slots[2]: duplicate slot name "heading"',
    '$.slots[2]: image slot "heading" needs value.src',
    '$.slots[3]: list slot "empty" needs at least one item',
    '$.slots[4]: slot "blank" has no value',
    '$.refs.desktop: key must be a width in px',
  ]);
});

test('checkSpec returns schema errors first and stops there', () => {
  const spec = validSpec();
  spec.kind = 'banner';
  assert.equal(checkSpec(spec).length, 1);
});

test('readSpecs sorts by order', () => {
  const dir = mkdtempSync(join(tmpdir(), 'specs-'));
  writeFileSync(join(dir, 'a.json'), JSON.stringify({ ...validSpec(), id: 'b', order: 1 }));
  writeFileSync(join(dir, 'b.json'), JSON.stringify({ ...validSpec(), id: 'a', order: 0 }));
  assert.deepEqual(readSpecs(dir).map((s) => s.id), ['a', 'b']);
  assert.deepEqual(readSpecs(join(dir, 'missing')), []);
});

test('parseOptions reads --key=value and declared flags, and rejects the rest', () => {
  assert.deepEqual(parseOptions(['--run=x', '--check'], { run: '', check: false }), { run: 'x', check: true });
  assert.throws(() => parseOptions(['--nope=1'], { run: '' }), /unknown option --nope/);
  assert.throws(() => parseOptions(['--run'], { run: '' }), /--run needs a value/);
  assert.throws(() => parseOptions(['loose'], { run: '' }), /unexpected argument "loose"/);
});

test('validate-spec CLI exits 1 and prints every error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'specs-'));
  writeFileSync(join(dir, 'ok.json'), JSON.stringify(validSpec()));
  writeFileSync(join(dir, 'bad.json'), JSON.stringify({ ...validSpec(), kind: 'banner' }));
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'validate-spec.mjs'), dir], { encoding: 'utf8' });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /ok .*ok\.json/);
  assert.match(res.stderr, /bad\.json: \$\.kind: "banner" not in/);
});
