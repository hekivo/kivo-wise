import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpProject, readJson, PLUGIN } from './helpers.mjs';
import { stage } from '../../scripts/build-rebuild-eval.mjs';

const CASES = ['survey-stops-at-inventory', 'connect-never-prints-secret', 'connect-guides-missing-permission', 'setup-requires-approval', 'parity-finds-hidden-tags', 'parity-finds-empty-slider', 'inventory-without-signals'];

test('staged copy drops dependencies and carries fixtures', () => {
  const out = stage(tmpProject());
  assert.equal(readJson(join(out, '.claude-plugin', 'plugin.json')).dependencies, undefined);
  assert.ok(existsSync(join(out, 'evals', 'fixtures', 'projects', 'acme-store', '.rebuild', 'config.json')));
  for (const c of CASES) assert.ok(existsSync(join(out, 'evals', c, 'case.yaml')), c);
});

test('every case has a prompt, an executable scaffold and graders, and no other folders sit in evals', () => {
  const evals = join(PLUGIN, 'evals');
  assert.deepEqual(readdirSync(evals).sort(), [...CASES].sort());
  for (const c of CASES) {
    assert.ok(existsSync(join(evals, c, 'prompt.md')), `${c}/prompt.md`);
    assert.ok(statSync(join(evals, c, 'scaffold.sh')).mode & 0o100, `${c}/scaffold.sh is not executable`);
    assert.ok(readdirSync(join(evals, c, 'graders')).some((f) => f.endsWith('.md')), `${c} has no graders`);
  }
});

test('every scaffold runs against the staged fixtures and leaves a valid project', () => {
  const out = stage(tmpProject());
  for (const c of CASES) {
    const cwd = tmpProject();
    const r = spawnSync('bash', [join(out, 'evals', c, 'scaffold.sh')], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `${c}: ${r.stderr}`);
    assert.ok(existsSync(join(cwd, '.rebuild', 'config.json')), c);
    const v = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'validate.mjs'), `--project=${cwd}`], { encoding: 'utf8' });
    assert.equal(v.status, 0, `${c}: ${v.stderr}`);
  }
});

test('the secret stand-in never holds the whole secret in one place', () => {
  const dir = join(PLUGIN, 'evals', 'connect-never-prints-secret');
  assert.ok(!readFileSync(join(dir, 'scaffold.sh'), 'utf8').includes('canary-7f3a-value'));
  const out = stage(tmpProject());
  const cwd = tmpProject();
  spawnSync('bash', [join(out, 'evals', 'connect-never-prints-secret', 'scaffold.sh')], { cwd });
  const op = spawnSync(join(cwd, '.bin', 'op'), ['item', 'get'], { encoding: 'utf8' });
  assert.equal(JSON.parse(op.stdout).fields[0].value, 'canary-7f3a-value');
});

test('fixtures and evals use only reserved domains for e-mail addresses', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const files = [...walk(join(PLUGIN, 'evals')), ...walk(join(PLUGIN, '..', '..', 'test', 'fixtures', 'rebuild'))];
  for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), /gserviceaccount\.com/, f);
});
