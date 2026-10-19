// test/creator/match.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPlan, checkPlan, formatPlan, THRESHOLD } from '../../plugins/kivo-creator/scripts/lib/match.mjs';
import { acfCatalog } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { FIX, PLUGIN, tmpCopy } from './helpers.mjs';

const catalog = acfCatalog(resolveStack(join(FIX, 'projects', 'acme-mu-plugin')));
const specs = readSpecs(join(FIX, 'runs', 'landing', 'specs'));
const header = { id: '00-header', kind: 'custom', chrome: true, slots: [] };
const media = { id: '05-media', kind: 'media', slots: [{ name: 'embed', type: 'embed', value: { src: 'https://video.acme.test/1' }, provenance: 'exact' }] };
const connected = { ...specs[3], id: '06-stats', codeConnect: { block: 'acf/feature-grid', component: 'Stats/Default' } };

test('deterministic decisions: chrome is skipped, Code Connect fills, nothing-fits scaffolds; the rest waits for judgment', () => {
  const plan = buildPlan({ run: 'r', adapter: 'acorn-mu-plugin', specs: [header, ...specs, media, connected], catalog });
  const d = Object.fromEntries(plan.sections.map((s) => [s.spec, s.decision?.action ?? null]));
  assert.deepEqual(d, { '00-header': 'skip', '01-hero': null, '02-faq': null, '03-testimonial': null, '04-stats': null, '05-media': 'scaffold', '06-stats': 'fill' });
  assert.deepEqual(plan.sections[2].candidates.map((c) => c.block), ['acf/faq', 'acf/feature-grid']);
  assert.equal(plan.threshold, THRESHOLD);
});

test('a target that forbids generated blocks records a gap instead', () => {
  const plan = buildPlan({ run: 'r', adapter: 'x', specs: [media], catalog, allowsGeneratedBlocks: false });
  assert.equal(plan.sections[0].decision.action, 'gap');
});

test('checkPlan refuses open, unknown, low-confidence and filter-violating decisions', () => {
  const plan = buildPlan({ run: 'r', adapter: 'acorn-mu-plugin', specs, catalog });
  plan.sections[0].decision = { action: 'fill', block: 'acf/hero', confidence: 0.9, reason: 'hero with image' };
  plan.sections[1].decision = { action: 'fill', block: 'acf/hero', confidence: 0.9, reason: 'x' };
  plan.sections[2].decision = { action: 'fill', block: 'acf/hero', confidence: 0.4, reason: 'unsure' };
  assert.deepEqual(checkPlan(plan, catalog), [
    'section 02-faq: "acf/hero" did not pass the compatibility filter',
    'section 03-testimonial: confidence 0.4 is below 0.6; ask the person and set approvedBy: "person"',
    'section 04-stats: no decision yet (judge the candidates)',
  ]);
});

test('formatPlan renders a table that names the open sections', () => {
  const md = formatPlan(buildPlan({ run: 'r', adapter: 'acorn-mu-plugin', specs: specs.slice(0, 2), catalog }));
  assert.match(md, /^# Match plan: r/);
  assert.match(md, /\| 02-faq \| faq \| judge \| - \| - \| candidates: acf\/faq \(1\), acf\/feature-grid \(1\) \|/);
});

test('CLI: builds the plan, refuses to overwrite it, and --check fails while decisions are open', () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  const run = join(project, '.creator', 'run-1');
  mkdirSync(run, { recursive: true });
  cpSync(join(FIX, 'runs', 'landing', 'specs'), join(run, 'specs'), { recursive: true });
  const cli = (...args) => spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'match.mjs'), `--project=${project}`, ...args], { encoding: 'utf8' });
  const built = cli(`--run=${run}`);
  assert.equal(built.status, 0, built.stderr);
  assert.deepEqual(JSON.parse(built.stdout).judge, ['01-hero', '02-faq', '03-testimonial', '04-stats']);
  assert.match(cli(`--run=${run}`).stderr, /exists; edit it and run --check/);
  assert.equal(cli(`--run=${run}`, '--check').status, 1);
  const plan = JSON.parse(readFileSync(join(run, 'match-plan.json'), 'utf8'));
  for (const s of plan.sections) s.decision = { action: 'scaffold', block: null, confidence: 1, reason: 'test' };
  writeFileSync(join(run, 'match-plan.json'), JSON.stringify(plan));
  const ok = cli(`--run=${run}`, '--check');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(cli('--catalog').stdout, /"acf\/feature-grid"/);
});
