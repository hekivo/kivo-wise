// test/creator/emit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { FIX, PLUGIN, tmpCopy } from './helpers.mjs';

function prepare(decisions) {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  const run = join(project, '.creator', 'run-1');
  mkdirSync(run, { recursive: true });
  cpSync(join(FIX, 'runs', 'landing', 'specs'), join(run, 'specs'), { recursive: true });
  const sections = Object.entries(decisions).map(([spec, decision]) => ({ spec, kind: spec.split('-')[1], candidates: [], decision }));
  writeFileSync(join(run, 'match-plan.json'), JSON.stringify({ run: 'run-1', adapter: 'acorn-mu-plugin', threshold: 0.6, sections }));
  return { project, run };
}
const emit = (project, run) => spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'emit.mjs'), `--project=${project}`, `--run=${run}`], { encoding: 'utf8' });

test('fills existing blocks, scaffolds the gap under .creator and records what to do next', () => {
  const { project, run } = prepare({
    '01-hero': { action: 'fill', block: 'acf/hero', confidence: 0.9, reason: 'hero' },
    '02-faq': { action: 'fill', block: 'acf/faq', confidence: 0.8, reason: 'faq' },
    '03-testimonial': { action: 'gap', block: null, confidence: 1, reason: 'no testimonial block; asked to skip' },
    '04-stats': { action: 'scaffold', block: null, confidence: 1, reason: 'no stats block' },
  });
  const res = emit(project, run);
  assert.equal(res.status, 0, res.stderr);
  const page = readFileSync(join(run, 'page.html'), 'utf8');
  assert.deepEqual(page.match(/<!-- wp:acf\/[\w-]+/g), ['<!-- wp:acf/hero', '<!-- wp:acf/faq', '<!-- wp:acf/stats']);
  const emitted = JSON.parse(readFileSync(join(run, 'emitted.json'), 'utf8'));
  assert.deepEqual(emitted.commands, ['acf:block Stats --no-interaction']);
  assert.deepEqual(emitted.files.map((f) => f.target), [
    'wp-content/mu-plugins/acme-core/app/Blocks/Stats.php',
    'wp-content/mu-plugins/acme-core/resources/views/blocks/stats.blade.php',
    'wp-content/mu-plugins/acme-core/resources/css/blocks/stats.css',
  ]);
  assert.ok(existsSync(join(project, emitted.files[0].scaffold)));
  assert.ok(!existsSync(join(project, emitted.files[0].target)), 'emit never writes into the project');
  assert.deepEqual(emitted.gaps, [{ spec: '03-testimonial', reason: 'no testimonial block; asked to skip' }]);
  assert.equal(emitted.media.length, 1);
  assert.deepEqual(emitted.proposals.map((p) => p.suggested), ['--text-body']);
});

test('refuses a plan that does not pass --check', () => {
  const { project, run } = prepare({ '01-hero': null });
  const res = emit(project, run);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /no decision yet/);
});
