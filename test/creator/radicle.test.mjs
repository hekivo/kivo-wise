// test/creator/radicle.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdirSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX, PLUGIN, tmpCopy } from './helpers.mjs';

test('radicle-app profile selects the native radicle adapter', async () => {
  const stack = resolveStack(join(FIX, 'projects', 'acme-radicle'));
  const adapter = await selectAdapter(stack);
  assert.equal(adapter.name, 'radicle');
  assert.deepEqual(adapter.catalog(stack).map((b) => b.name), ['acme/faq', 'acme/hero']);
  assert.equal(adapter.themeCss(stack), join(stack.appPath, 'resources', 'css', 'app.css'));
});

test('match and emit work end to end on the radicle fixture', () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-radicle'));
  const run = join(project, '.creator', 'run-1');
  mkdirSync(run, { recursive: true });
  cpSync(join(FIX, 'runs', 'landing', 'specs'), join(run, 'specs'), { recursive: true });
  const node = (script, ...args) => spawnSync(process.execPath, [join(PLUGIN, 'scripts', script), `--project=${project}`, `--run=${run}`, ...args], { encoding: 'utf8' });
  const built = node('match.mjs');
  assert.equal(built.status, 0, built.stderr);
  assert.deepEqual(JSON.parse(built.stdout).judge, ['01-hero', '02-faq', '03-testimonial', '04-stats']);
});
