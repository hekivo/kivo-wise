// test/creator/block-type.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { DOMINANT_SHARE, resolveBlockType } from '../../plugins/kivo-creator/scripts/adapters/shared/block-type.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { assign } from '../../plugins/kivo-creator/scripts/lib/fill.mjs';
import { loadTheme } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { FIX, PLUGIN, readJson, tmpCopy } from './helpers.mjs';

const specs = readSpecs(join(FIX, 'runs', 'landing', 'specs'));
const stats = specs.find((s) => s.id === '04-stats');
const MU_APP = join('wp-content', 'mu-plugins', 'acme-core');

function setFlag(project, extra) {
  const file = join(project, '.roots-stack.json');
  writeFileSync(file, JSON.stringify({ ...readJson(file), ...extra }));
}
function addBlockJson(dir, name) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'block.json'), JSON.stringify({ name, title: name, attributes: { heading: { type: 'string' } } }));
}
async function contextFor(project) {
  const stack = resolveStack(project);
  const adapter = await selectAdapter(stack);
  const catalog = adapter.catalog(stack);
  return { stack, adapter, catalog, decision: resolveBlockType(stack, catalog) };
}
function emptyProject(flag, composer = { name: 'acme/site', require: { 'roots/acorn': '^6.2' } }) {
  const dir = mkdtempSync(join(tmpdir(), 'creator-empty-'));
  writeFileSync(join(dir, '.roots-stack.json'), JSON.stringify({ app: '.', runner: 'none', ...flag }));
  writeFileSync(join(dir, 'composer.json'), JSON.stringify(composer));
  return dir;
}

test('the dominance threshold is 80%', () => {
  assert.equal(DOMINANT_SHARE, 0.8);
});

test('count: an ACF Composer project scaffolds ACF blocks', async () => {
  const { decision } = await contextFor(join(FIX, 'projects', 'acme-mu-plugin'));
  assert.deepEqual(decision, { type: 'acf', source: 'count', counts: { acf: 4, native: 0 } });
});

test('count: ACF Composer\'s cached block.json files (storage/) are not native blocks', async () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  addBlockJson(join(project, MU_APP, 'storage', 'framework', 'cache', 'acf-composer', 'blocks', 'hero'), 'acf/hero');
  const { decision } = await contextFor(project);
  assert.deepEqual(decision, { type: 'acf', source: 'count', counts: { acf: 4, native: 0 } });
});

test('count: a block.json project scaffolds native blocks, whatever the profile', async () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-sage'));
  const app = join(project, 'web', 'app', 'themes', 'acme');
  cpSync(join(FIX, 'projects', 'acme-radicle', 'resources', 'blocks'), join(app, 'resources', 'blocks'), { recursive: true });
  // Empty the only ACF class so the theme holds block.json blocks only.
  writeFileSync(join(app, 'app', 'Blocks', 'Hero.php'), '<?php\n');
  const { stack, adapter, catalog, decision } = await contextFor(project);
  assert.deepEqual(decision, { type: 'native', source: 'count', counts: { acf: 0, native: 2 } });
  const out = adapter.scaffoldBlock(stack, stats, { theme: loadTheme(''), catalog, blockType: decision });
  assert.equal(out.block.name, 'acme/stats');
  assert.ok(out.files[0].path.endsWith('/stats/block.json'));
});

test('count: 4 ACF and 1 native is exactly 80%, so ACF', async () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  addBlockJson(join(project, MU_APP, 'resources', 'blocks', 'quote'), 'acme/quote');
  const { decision } = await contextFor(project);
  assert.deepEqual(decision, { type: 'acf', source: 'count', counts: { acf: 4, native: 1 } });
});

test('override: creator.blocks wins over the count', async () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  setFlag(project, { creator: { blocks: 'native' } });
  const { stack, adapter, catalog, decision } = await contextFor(project);
  assert.deepEqual(decision, { type: 'native', source: 'override', counts: { acf: 4, native: 0 } });
  const out = adapter.scaffoldBlock(stack, stats, { theme: loadTheme(''), catalog, blockType: decision });
  assert.ok(out.files[0].path.endsWith('/stats/block.json'));
  assert.deepEqual(out.commands, []);
});

test('override: an invalid creator.blocks value is a clear error', async () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  setFlag(project, { creator: { blocks: 'acf-composer' } });
  await assert.rejects(contextFor(project), /creator\.blocks must be "acf" or "native" \(got "acf-composer"\)/);
});

test('asked: the person\'s answer decides a mixed project; it cannot contradict the override', async () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-sage'));
  addBlockJson(join(project, 'web', 'app', 'themes', 'acme', 'resources', 'blocks', 'quote'), 'acme/quote');
  const { stack, catalog } = await contextFor(project);
  assert.deepEqual(resolveBlockType(stack, catalog, { asked: 'native' }), { type: 'native', source: 'asked', counts: { acf: 1, native: 1 } });
  assert.throws(() => resolveBlockType(stack, catalog, { asked: 'both' }), /--blocks must be "acf" or "native"/);
  setFlag(project, { creator: { blocks: 'acf' } });
  const again = await contextFor(project);
  assert.throws(() => resolveBlockType(again.stack, again.catalog, { asked: 'native' }), /conflicts with creator\.blocks "acf"/);
});

test('mixed: no guess, and scaffolding refuses with the JSON to record the answer', async () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-sage'));
  addBlockJson(join(project, 'web', 'app', 'themes', 'acme', 'resources', 'blocks', 'quote'), 'acme/quote');
  const { stack, adapter, catalog, decision } = await contextFor(project);
  assert.deepEqual(decision, { type: null, source: null, reason: 'mixed', counts: { acf: 1, native: 1 } });
  assert.throws(
    () => adapter.scaffoldBlock(stack, stats, { theme: loadTheme(''), catalog, blockType: decision }),
    (e) => /1 ACF Composer block and 1 block\.json block/.test(e.message) && /"creator": \{ "blocks": "acf" \}/.test(e.message) && /block-type\.mjs --set=/.test(e.message),
  );
});

test('none: no blocks yet; the recommendation is the profile default', async () => {
  const cases = [
    [{ profile: 'acorn-mu-plugin' }, undefined, 'acf'],
    [{ profile: 'radicle-app' }, undefined, 'native'],
    [{ profile: 'sage-theme' }, { name: 'acme/theme', require: { 'log1x/acf-composer': '^3.4' } }, 'acf'],
    [{ profile: 'sage-theme' }, undefined, 'native'],
  ];
  for (const [flag, composer, recommended] of cases) {
    const { stack, adapter, catalog, decision } = await contextFor(emptyProject(flag, composer));
    assert.deepEqual(decision, { type: null, source: null, reason: 'none', recommended, counts: { acf: 0, native: 0 } }, flag.profile);
    assert.throws(() => adapter.scaffoldBlock(stack, stats, { theme: loadTheme(''), catalog, blockType: decision }), new RegExp(`recommends "${recommended}"`));
  }
});

test('matching sees the union of ACF and native blocks, and emits each in its own markup', async () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  addBlockJson(join(project, MU_APP, 'resources', 'blocks', 'quote'), 'acme/quote');
  const { stack, adapter, catalog } = await contextFor(project);
  assert.deepEqual(catalog.map((b) => `${b.name}:${b.type}`), ['acf/cta:acf', 'acf/faq:acf', 'acf/feature-grid:acf', 'acf/hero:acf', 'acme/quote:native']);
  const hero = catalog.find((b) => b.name === 'acf/hero');
  const quote = catalog.find((b) => b.name === 'acme/quote');
  const { markup } = adapter.emitPage(stack, [
    { block: hero, spec: specs[0], pairs: assign(specs[0].slots, hero.fields).pairs },
    { block: quote, spec: specs[0], pairs: assign(specs[0].slots, quote.fields).pairs },
  ]);
  assert.match(markup, /^<!-- wp:acf\/hero \{"name":"acf\/hero","data":/);
  assert.match(markup, /\n\n<!-- wp:acme\/quote \{"heading":"Acme ships faster"\} \/-->\n$/);
});

function prepareRun(project, decisions) {
  const run = join(project, '.creator', 'run-1');
  mkdirSync(run, { recursive: true });
  cpSync(join(FIX, 'runs', 'landing', 'specs'), join(run, 'specs'), { recursive: true });
  const sections = Object.entries(decisions).map(([spec, decision]) => ({ spec, kind: spec.split('-')[1], candidates: [], decision }));
  writeFileSync(join(run, 'match-plan.json'), JSON.stringify({ run: 'run-1', adapter: 'sage-theme', threshold: 0.6, sections }));
  return run;
}
const script = (name, project, ...args) => spawnSync(process.execPath, [join(PLUGIN, 'scripts', name), `--project=${project}`, ...args], { encoding: 'utf8' });

test('scripts: emit refuses to scaffold a mixed project until the type is recorded or given', () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-sage'));
  addBlockJson(join(project, 'web', 'app', 'themes', 'acme', 'resources', 'blocks', 'quote'), 'acme/quote');
  const run = prepareRun(project, { '04-stats': { action: 'scaffold', block: null, confidence: 1, reason: 'no stats block' } });
  const refused = script('emit.mjs', project, `--run=${run}`);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /"creator": \{ "blocks": "acf" \}/);
  const check = script('match.mjs', project, `--run=${run}`, '--check');
  assert.notEqual(check.status, 0);
  assert.match(check.stderr, /new blocks need a block type/i);
  const asked = script('emit.mjs', project, `--run=${run}`, '--blocks=native');
  assert.equal(asked.status, 0, asked.stderr);
  assert.deepEqual(readJson(join(run, 'emitted.json')).blockType, { type: 'native', source: 'asked', counts: { acf: 1, native: 1 } });
  const set = script('block-type.mjs', project, '--set=acf');
  assert.equal(set.status, 0, set.stderr);
  assert.deepEqual(readJson(join(project, '.roots-stack.json')).creator, { blocks: 'acf' });
  assert.equal(readJson(join(project, '.roots-stack.json')).profile, 'sage-theme');
  const recorded = script('emit.mjs', project, `--run=${run}`);
  assert.equal(recorded.status, 0, recorded.stderr);
  const emitted = readJson(join(run, 'emitted.json'));
  assert.deepEqual(emitted.blockType, { type: 'acf', source: 'override', counts: { acf: 1, native: 1 } });
  assert.ok(emitted.files.some((f) => f.target.endsWith('app/Blocks/Stats.php')));
});

test('scripts: the match plan records the decision and block-type.mjs prints it', () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  const run = join(project, '.creator', 'run-1');
  mkdirSync(run, { recursive: true });
  cpSync(join(FIX, 'runs', 'landing', 'specs'), join(run, 'specs'), { recursive: true });
  const built = script('match.mjs', project, `--run=${run}`);
  assert.equal(built.status, 0, built.stderr);
  assert.deepEqual(JSON.parse(built.stdout).blockType, { type: 'acf', source: 'count', counts: { acf: 4, native: 0 } });
  assert.deepEqual(readJson(join(run, 'match-plan.json')).blockType, { type: 'acf', source: 'count', counts: { acf: 4, native: 0 } });
  assert.match(readFileSync(join(run, 'match-plan.md'), 'utf8'), /New blocks: `acf` \(count: 4 ACF Composer, 0 block\.json\)/);
  const printed = script('block-type.mjs', project);
  assert.equal(printed.status, 0, printed.stderr);
  assert.deepEqual(JSON.parse(printed.stdout), { type: 'acf', source: 'count', counts: { acf: 4, native: 0 } });
  assert.notEqual(script('block-type.mjs', project, '--set=gutenberg').status, 0);
});
