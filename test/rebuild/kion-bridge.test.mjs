import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedFeatures, gapQuestions, existingQuestionTexts } from '../../plugins/kivo-rebuild/scripts/kion-bridge.mjs';
import { readJson, run, tmpProject } from './helpers.mjs';

test('seed skips removed items and links the kion id', () => {
  const items = seedFeatures({ items: [
    { id: 'INV-001', area: 'plugins', kind: 'plugin', name: 'Banner Slider', source: 'wp-content/plugins/slider', evidence: 'home slides', verdict: 'rebuild', risk: [], raises: [] },
    { id: 'INV-002', area: 'plugins', kind: 'plugin', name: 'Old Cache', source: 'x', verdict: 'remove', risk: [], raises: [] },
  ] });
  assert.deepEqual(items, [{ id: 'F-banner-slider', area: 'plugins', name: 'Banner Slider', source: 'wp-content/plugins/slider', behaviour: 'home slides', kion: 'INV-001' }]);
});

test('seed falls back to the name when there is no evidence and strips accents from ids', () => {
  const [it] = seedFeatures({ items: [{ id: 'INV-003', area: 'theme', name: 'Câmbio Widget', source: 's', verdict: 'keep' }] });
  assert.equal(it.id, 'F-cambio-widget');
  assert.equal(it.behaviour, 'Câmbio Widget');
});

test('questions only for P0/P1 missing-not-planned', () => {
  const features = [{ id: 'F-a', area: 'checkout', name: 'State registration field', source: 'functions.php:452', behaviour: 'b' }, { id: 'F-b', area: 'x', name: 'B', source: 's', behaviour: 'b' }];
  const parity = [{ feature: 'F-a', class: 'missing-not-planned', priority: 'P0', note: 'sent to the ERP' }, { feature: 'F-b', class: 'missing-not-planned', priority: 'P3' }];
  const qs = gapQuestions(parity, features);
  assert.equal(qs.length, 1);
  assert.equal(qs[0].tier, 'high');
  assert.match(qs[0].text, /State registration field/);
  assert.equal(qs[0].options[0].recommended, true);
});

test('a P1 gap is a normal-tier question that does not recommend building', () => {
  const features = [{ id: 'F-a', area: 'x', name: 'Wishlist', source: 'theme/wishlist.php', behaviour: 'b' }];
  const [q] = gapQuestions([{ feature: 'F-a', class: 'missing-not-planned', priority: 'P1' }], features);
  assert.equal(q.tier, 'normal');
  assert.notEqual(q.options[0].recommended, true);
  assert.deepEqual(q.grounds, ['theme/wishlist.php']);
  assert.deepEqual(q.options.map((o) => o.key), ['build', 'later', 'drop']);
  assert.equal(q.status, 'open');
  assert.equal(q.source, 'discovery');
});

test('a parity row for an unknown feature is an error, not a crash', () => {
  assert.throws(() => gapQuestions([{ feature: 'F-zz', class: 'missing-not-planned', priority: 'P0' }], []), /unknown feature F-zz/);
});

function project() {
  const p = tmpProject();
  const dir = join(p, '.rebuild', 'runs', '2026-11-18-acme');
  mkdirSync(dir, { recursive: true });
  return { p, dir };
}

test('cli seed writes the kion fragment', () => {
  const { p, dir } = project();
  mkdirSync(join(p, '.kion'));
  writeFileSync(join(p, '.kion', 'inventory.json'), JSON.stringify({ items: [{ id: 'INV-001', area: 'plugins', name: 'Banner Slider', source: 'wp-content/plugins/slider', evidence: 'home slides', verdict: 'rebuild' }] }));
  const r = run('kion-bridge.mjs', ['seed', `--project=${p}`]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /seeded 1 features/);
  assert.equal(readJson(join(dir, 'fragments', 'features', 'kion.json')).items[0].kion, 'INV-001');
});

test('cli seed refuses items that would fail the features schema', () => {
  const { p, dir } = project();
  mkdirSync(join(p, '.kion'));
  writeFileSync(join(p, '.kion', 'inventory.json'), JSON.stringify({ items: [{ id: 'INV-001', area: 'plugins', name: 'Banner Slider', verdict: 'rebuild' }] }));
  const r = run('kion-bridge.mjs', ['seed', `--project=${p}`]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /source/);
  assert.throws(() => readJson(join(dir, 'fragments', 'features', 'kion.json')));
});

function withParity() {
  const { p, dir } = project();
  writeFileSync(join(dir, 'features.json'), JSON.stringify({ schema_version: 1, kind: 'features', run_id: '2026-11-18-acme', generated_at: 'x', items: [{ id: 'F-a', area: 'checkout', name: "Buyer's tax id", source: 'functions.php:452', behaviour: 'b' }] }));
  writeFileSync(join(dir, 'parity.json'), JSON.stringify({ schema_version: 1, kind: 'parity', run_id: '2026-11-18-acme', generated_at: 'x', items: [{ feature: 'F-a', class: 'missing-not-planned', priority: 'P0' }] }));
  // Stand-in for kion.mjs: records the arguments it receives.
  const out = join(p, 'received.log');
  const kion = join(p, 'fake-kion.mjs');
  writeFileSync(kion, `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(out)}, process.argv.slice(2).join('\\u0001') + '\\n');\n`);
  return { p, kion, out };
}

test('cli questions is a dry run without --apply and prints a shell-safe command', () => {
  const { p, kion, out } = withParity();
  const r = run('kion-bridge.mjs', ['questions', `--project=${p}`, `--kion=${kion}`]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /add question --data '/);
  assert.match(r.stdout, /Buyer'\\''s tax id/);
  assert.match(r.stdout, /1 questions \(dry run/);
  assert.throws(() => readJson(out));
});

test('cli questions --apply runs kion with the question as one --data argument', () => {
  const { p, kion, out } = withParity();
  const r = run('kion-bridge.mjs', ['questions', `--project=${p}`, `--kion=${kion}`, '--apply']);
  assert.equal(r.code, 0, r.stderr);
  const [add, question, data, json] = readFileSync(out, 'utf8').trim().split('\u0001');
  assert.deepEqual([add, question, data], ['add', 'question', '--data']);
  assert.match(JSON.parse(json).text, /Buyer's tax id/);
});

test('cli questions needs --kion', () => {
  const { p } = withParity();
  const r = run('kion-bridge.mjs', ['questions', `--project=${p}`]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /--kion/);
});

test('cli rejects an unknown command', () => {
  const r = run('kion-bridge.mjs', ['nope']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /usage: kion-bridge\.mjs/);
});

test('seed ids stay unique for repeated or non-Latin names', () => {
  const items = seedFeatures({ items: [
    { id: 'INV-010', area: 'theme', name: 'Slider', source: 'a', verdict: 'keep' },
    { id: 'INV-011', area: 'theme', name: 'Slider', source: 'b', verdict: 'keep' },
    { id: 'INV-012', area: 'theme', name: '日本', source: 'c', verdict: 'keep' },
  ] });
  assert.deepEqual(items.map((i) => i.id), ['F-slider', 'F-slider-inv-011', 'F-inv-012']);
});

test('existing kion questions are read so --apply does not add them twice', () => {
  const project = tmpProject();
  assert.equal(existingQuestionTexts(project).size, 0);
  mkdirSync(join(project, '.kion'), { recursive: true });
  writeFileSync(join(project, '.kion', 'questions.json'), JSON.stringify({ items: [{ id: 'Q-001', text: 'Who owns "Slider" in the new project, and is it needed at launch?' }] }));
  assert.ok(existingQuestionTexts(project).has('Who owns "Slider" in the new project, and is it needed at launch?'));
});
