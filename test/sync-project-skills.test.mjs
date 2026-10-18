import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'sync-project-skills.mjs');

function put(root, rel, text) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'sync-skills-'));
  const plugin = join(dir, 'plugin');
  put(plugin, '.claude-plugin/plugin.json', JSON.stringify({ name: 'x', version: '9.9.9' }));
  put(plugin, 'skills/alpha/SKILL.md', 'alpha\n');
  put(plugin, 'skills/alpha/references/r.md', 'ref\n');
  put(plugin, 'skills/beta/SKILL.md', 'beta\n');
  put(plugin, 'third-party/gpl-one/SKILL.md', 'gpl\n');
  put(plugin, 'third-party/LICENSE', 'license\n');
  return { dir, plugin, target: join(dir, 'project', '.agents', 'skills') };
}

// Runs the real script with a copy of the layout: the script resolves the plugin from its own
// location, so the tests import it and pass pluginRoot explicitly.
const mod = await import(SCRIPT);

test('copies skills, skips third-party by default and writes GENERATED.md', () => {
  const f = fixture();
  const res = mod.sync({ pluginRoot: f.plugin, to: f.target, now: new Date('2026-10-18T00:00:00Z') });
  assert.equal(res.written, 3);
  assert.equal(readFileSync(join(f.target, 'alpha/references/r.md'), 'utf8'), 'ref\n');
  assert.ok(!existsSync(join(f.target, 'gpl-one')));
  const gen = readFileSync(join(f.target, 'GENERATED.md'), 'utf8');
  assert.match(gen, /Source plugin version: 9\.9\.9/);
  assert.match(gen, /Generated: 2026-10-18/);
  assert.match(gen, /do not edit|Do not edit/);
  assert.match(gen, /- alpha\n- beta/);
  assert.match(gen, /`alpha\/SKILL\.md`/);
  rmSync(f.dir, { recursive: true });
});

test('--include-gpl copies third-party skill folders only', () => {
  const f = fixture();
  mod.sync({ pluginRoot: f.plugin, to: f.target, includeGpl: true });
  assert.ok(existsSync(join(f.target, 'gpl-one/SKILL.md')));
  assert.ok(!existsSync(join(f.target, 'LICENSE')));
  assert.match(readFileSync(join(f.target, 'GENERATED.md'), 'utf8'), /gpl-one \(GPL-2\.0-or-later\)/);
  assert.ok(mod.sync({ pluginRoot: f.plugin, to: f.target, check: true }).ok, 'check honours the recorded flag');
  rmSync(f.dir, { recursive: true });
});

test('check passes after sync and reports missing, changed and extra files', () => {
  const f = fixture();
  mod.sync({ pluginRoot: f.plugin, to: f.target });
  assert.ok(mod.sync({ pluginRoot: f.plugin, to: f.target, check: true }).ok);
  rmSync(join(f.target, 'beta/SKILL.md'));
  writeFileSync(join(f.target, 'alpha/SKILL.md'), 'edited\n');
  put(f.target, 'alpha/stray.md', 'x');
  const res = mod.sync({ pluginRoot: f.plugin, to: f.target, check: true });
  assert.equal(res.ok, false);
  assert.deepEqual(res.diff.missing, ['beta/SKILL.md']);
  assert.deepEqual(res.diff.changed, ['alpha/SKILL.md']);
  assert.deepEqual(res.diff.extra.map((e) => e.path), ['alpha/stray.md']);
  rmSync(f.dir, { recursive: true });
});

test('check fails when the target does not exist', () => {
  const f = fixture();
  const res = mod.sync({ pluginRoot: f.plugin, to: f.target, check: true });
  assert.equal(res.ok, false);
  assert.ok(res.diff.missing.includes('GENERATED.md'));
  assert.ok(!existsSync(f.target), 'check writes nothing');
  rmSync(f.dir, { recursive: true });
});

test('removes stale files listed in GENERATED.md but never unlisted ones', () => {
  const f = fixture();
  mod.sync({ pluginRoot: f.plugin, to: f.target });
  rmSync(join(f.plugin, 'skills/beta'), { recursive: true });
  put(f.target, 'mine/notes.md', 'keep me');
  const res = mod.sync({ pluginRoot: f.plugin, to: f.target });
  assert.deepEqual(res.removed, ['beta/SKILL.md']);
  assert.deepEqual(res.diff.foreign, ['mine']);
  assert.ok(!existsSync(join(f.target, 'beta')), 'empty folder pruned');
  assert.equal(readFileSync(join(f.target, 'mine/notes.md'), 'utf8'), 'keep me');
  rmSync(f.dir, { recursive: true });
});

test('does not delete files in a target that has no GENERATED.md', () => {
  const f = fixture();
  put(f.target, 'handmade/SKILL.md', 'mine');
  const res = mod.sync({ pluginRoot: f.plugin, to: f.target });
  assert.deepEqual(res.diff.foreign, ['handmade']);
  assert.ok(existsSync(join(f.target, 'handmade/SKILL.md')));
  rmSync(f.dir, { recursive: true });
});

test('CLI: --check exits 1 on drift and prints the list; real plugin syncs cleanly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-cli-'));
  const target = join(dir, 'skills');
  execFileSync('node', [SCRIPT, '--to', target]);
  assert.equal(spawnSync('node', [SCRIPT, '--to', target, '--check']).status, 0);
  writeFileSync(join(target, 'roots-router/SKILL.md'), 'tampered');
  const r = spawnSync('node', [SCRIPT, '--to', target, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /changed\s+roots-router\/SKILL\.md/);
  assert.equal(spawnSync('node', [SCRIPT, '--bogus']).status, 2);
  rmSync(dir, { recursive: true });
});

test('foreign skill folders are ignored by sync and check; extra files in synced folders still count', () => {
  const f = fixture();
  put(f.target, 'own-skill/SKILL.md', 'mine\n');
  mod.sync({ pluginRoot: f.plugin, to: f.target });
  assert.equal(readFileSync(join(f.target, 'own-skill/SKILL.md'), 'utf8'), 'mine\n');
  const ok = mod.sync({ pluginRoot: f.plugin, to: f.target, check: true });
  assert.ok(ok.ok);
  assert.deepEqual(ok.diff.foreign, ['own-skill']);
  put(f.target, 'alpha/stray.md', 'x\n');
  const bad = mod.sync({ pluginRoot: f.plugin, to: f.target, check: true });
  assert.ok(!bad.ok);
  assert.deepEqual(bad.diff.extra.map((e) => e.path), ['alpha/stray.md']);
  const cli = spawnSync('node', [SCRIPT, '--to', f.target, '--check'], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  rmSync(f.dir, { recursive: true });
});
