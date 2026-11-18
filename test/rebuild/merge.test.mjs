import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeFragments } from '../../plugins/kivo-rebuild/scripts/merge.mjs';
import { readJson, run, tmpProject } from './helpers.mjs';

const f = (id) => ({ id, area: 'theme', name: id, source: 'functions.php:1', behaviour: 'b' });

test('features: duplicates across fragments are errors', () => {
  const { errors } = mergeFragments('features', [{ name: 'a.json', items: [f('F-a')] }, { name: 'b.json', items: [f('F-a')] }]);
  assert.deepEqual(errors, ['duplicate F-a in a.json and b.json']);
});

test('parity: unknown and unaudited features are errors', () => {
  const features = [f('F-a'), f('F-b')];
  const { errors } = mergeFragments('parity', [{ name: 'x.json', items: [{ feature: 'F-a', class: 'done', priority: 'P2' }, { feature: 'F-z', class: 'done', priority: 'P2' }] }], { features });
  assert.deepEqual(errors.sort(), ['not audited: F-b', 'unknown feature F-z in x.json']);
});

test('clean merge keeps order by fragment name', () => {
  const { items, errors } = mergeFragments('features', [{ name: 'b.json', items: [f('F-b')] }, { name: 'a.json', items: [f('F-a')] }]);
  assert.deepEqual(errors, []);
  assert.deepEqual(items.map((i) => i.id), ['F-a', 'F-b']);
});

test('parity: a duplicate feature across fragments is an error', () => {
  const row = { feature: 'F-a', class: 'done', priority: 'P2' };
  const { errors } = mergeFragments('parity', [{ name: 'a.json', items: [row] }, { name: 'b.json', items: [row] }], { features: [f('F-a')] });
  assert.deepEqual(errors, ['duplicate F-a in a.json and b.json']);
});

function project() {
  const p = tmpProject();
  const dir = join(p, '.rebuild', 'runs', '2026-11-18-acme');
  mkdirSync(join(dir, 'fragments', 'features'), { recursive: true });
  mkdirSync(join(dir, 'fragments', 'parity'), { recursive: true });
  return { p, dir };
}
const frag = (dir, kind, name, items) => writeFileSync(join(dir, 'fragments', kind, name), JSON.stringify({ items }));

test('cli merges features fragments into features.json and then parity', () => {
  const { p, dir } = project();
  frag(dir, 'features', 'theme.json', [f('F-a')]);
  frag(dir, 'features', 'plugins.json', [f('F-b')]);
  let r = run('merge.mjs', [`--project=${p}`, '--kind=features']);
  assert.equal(r.code, 0, r.stderr);
  const features = readJson(join(dir, 'features.json'));
  assert.equal(features.kind, 'features');
  assert.equal(features.run_id, '2026-11-18-acme');
  assert.deepEqual(features.items.map((i) => i.id), ['F-b', 'F-a']);

  frag(dir, 'parity', 'all.json', [{ feature: 'F-a', class: 'done', priority: 'P2' }, { feature: 'F-b', class: 'partial', priority: 'P1', note: 'no export' }]);
  r = run('merge.mjs', [`--project=${p}`, '--kind=parity']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(readJson(join(dir, 'parity.json')).items.length, 2);
});

test('cli prints errors, exits 1 and writes nothing when the merge has errors', () => {
  const { p, dir } = project();
  frag(dir, 'features', 'a.json', [f('F-a')]);
  frag(dir, 'features', 'b.json', [f('F-a')]);
  const r = run('merge.mjs', [`--project=${p}`, '--kind=features']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /duplicate F-a in a\.json and b\.json/);
  assert.throws(() => readJson(join(dir, 'features.json')));
});

test('cli reports a schema error with the fragment name and writes nothing', () => {
  const { p, dir } = project();
  frag(dir, 'features', 'bad.json', [{ id: 'not-an-id', area: 'theme', name: 'x', source: 's', behaviour: 'b' }]);
  const r = run('merge.mjs', [`--project=${p}`, '--kind=features']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /bad\.json/);
  assert.throws(() => readJson(join(dir, 'features.json')));
});

test('cli parity needs features.json and a valid kind', () => {
  const { p, dir } = project();
  frag(dir, 'parity', 'x.json', [{ feature: 'F-a', class: 'done', priority: 'P2' }]);
  let r = run('merge.mjs', [`--project=${p}`, '--kind=parity']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /features\.json/);
  r = run('merge.mjs', [`--project=${p}`, '--kind=other']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /--kind=features\|parity/);
});

test('cli without a run says so', () => {
  const r = run('merge.mjs', [`--project=${tmpProject()}`, '--kind=features']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no run/);
});
