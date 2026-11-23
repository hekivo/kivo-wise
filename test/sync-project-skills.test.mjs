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
  put(plugin, '.claude-plugin/plugin.json', JSON.stringify({ name: 'kivo-wise', version: '9.9.9' }));
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
  const res = mod.sync({ pluginRoot: f.plugin, to: f.target });
  assert.equal(res.written, 3);
  assert.equal(readFileSync(join(f.target, 'alpha/references/r.md'), 'utf8'), 'ref\n');
  assert.ok(!existsSync(join(f.target, 'gpl-one')));
  const gen = readFileSync(join(f.target, 'GENERATED.md'), 'utf8');
  assert.match(gen, /Source plugin version: 9\.9\.9/);
  assert.doesNotMatch(gen, /Generated: \d{4}/, 'no run date');
  assert.match(gen, /Source commit: unknown/);
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

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function commitAll(dir) {
  git(dir, 'init', '-q');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'add', '-A');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.test', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'init');
  return git(dir, 'rev-parse', 'HEAD');
}

test('copies the runtime scripts into the hidden plugin root folder of the copy', () => {
  const f = fixture();
  put(f.plugin, 'scripts/detect-roots-project.mjs', 'detect\n');
  put(f.plugin, 'scripts/inventory-project.mjs', 'inventory\n');
  put(f.plugin, 'scripts/build-codex-plugin.mjs', 'dev only\n');
  mod.sync({ pluginRoot: f.plugin, to: f.target });
  assert.equal(readFileSync(join(f.target, '.kivo-wise/scripts/detect-roots-project.mjs'), 'utf8'), 'detect\n');
  assert.ok(existsSync(join(f.target, '.kivo-wise/scripts/inventory-project.mjs')));
  assert.ok(!existsSync(join(f.target, '.kivo-wise/scripts/build-codex-plugin.mjs')), 'development scripts stay out');
  const gen = readFileSync(join(f.target, 'GENERATED.md'), 'utf8');
  assert.match(gen, /`\.kivo-wise\/scripts\/detect-roots-project\.mjs`/);
  assert.match(gen, /Plugin root of the copied skills: `\.kivo-wise\/`/);
  assert.ok(mod.sync({ pluginRoot: f.plugin, to: f.target, check: true }).ok);
  rmSync(f.dir, { recursive: true });
});

test('GENERATED.md is deterministic and records the source commit and release tag', () => {
  const f = fixture();
  const head = commitAll(f.plugin);
  git(f.plugin, 'tag', 'kivo-wise-v9.9.9');
  git(f.plugin, 'tag', 'other-plugin-v1.0.0');
  mod.sync({ pluginRoot: f.plugin, to: f.target });
  const first = readFileSync(join(f.target, 'GENERATED.md'), 'utf8');
  assert.match(first, new RegExp(`Source commit: ${head}`));
  assert.match(first, /Source tag: kivo-wise-v9\.9\.9/);
  assert.doesNotMatch(first, /other-plugin/);
  const res = mod.sync({ pluginRoot: f.plugin, to: f.target });
  assert.equal(res.written, 0);
  assert.equal(readFileSync(join(f.target, 'GENERATED.md'), 'utf8'), first, 'a refresh from the same source writes the same bytes');
  rmSync(f.dir, { recursive: true });
});

test('--plugin-root copies another plugin beside kivo-wise without touching its files', () => {
  const f = fixture();
  const other = join(f.dir, 'creator');
  put(other, '.claude-plugin/plugin.json', JSON.stringify({ name: 'kivo-creator', version: '0.2.0' }));
  put(other, 'skills/gamma/SKILL.md', 'gamma\n');
  put(other, 'scripts/match.mjs', 'match\n');
  put(other, 'scripts/lib/args.mjs', 'args\n');
  put(other, 'schemas/spec.schema.json', '{}\n');
  mod.sync({ pluginRoot: f.plugin, to: f.target });
  const before = readFileSync(join(f.target, 'GENERATED.md'), 'utf8');

  const cli = spawnSync('node', [SCRIPT, '--plugin-root', other, '--to', f.target], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.ok(existsSync(join(f.target, 'gamma/SKILL.md')));
  assert.equal(readFileSync(join(f.target, '.kivo-creator/scripts/lib/args.mjs'), 'utf8'), 'args\n');
  assert.ok(existsSync(join(f.target, '.kivo-creator/schemas/spec.schema.json')));
  const gen = readFileSync(join(f.target, 'GENERATED.kivo-creator.md'), 'utf8');
  assert.match(gen, /Source plugin: kivo-creator/);
  assert.match(gen, /--plugin-root <kivo-creator> --to/);
  assert.equal(readFileSync(join(f.target, 'GENERATED.md'), 'utf8'), before, 'kivo-wise manifest untouched');
  assert.ok(existsSync(join(f.target, 'alpha/SKILL.md')), 'kivo-wise skills kept');

  // Each plugin checks only its own copy; the other's skills and manifest are foreign to it.
  const a = mod.sync({ pluginRoot: f.plugin, to: f.target, check: true });
  assert.ok(a.ok, JSON.stringify(a.diff));
  assert.ok(a.diff.foreign.includes('gamma'));
  const b = spawnSync('node', [SCRIPT, '--plugin-root=' + other, '--to', f.target, '--check'], { encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr);
  mod.sync({ pluginRoot: f.plugin, to: f.target });
  assert.ok(existsSync(join(f.target, 'gamma/SKILL.md')), 'a kivo-wise refresh keeps the other plugin');
  rmSync(f.dir, { recursive: true });
});

test('refuses a skill folder that another plugin manifest already lists', () => {
  const f = fixture();
  const other = join(f.dir, 'clash');
  put(other, '.claude-plugin/plugin.json', JSON.stringify({ name: 'clash', version: '1.0.0' }));
  put(other, 'skills/alpha/SKILL.md', 'not mine\n');
  mod.sync({ pluginRoot: f.plugin, to: f.target });
  assert.throws(() => mod.sync({ pluginRoot: other, to: f.target }), /alpha is already copied by GENERATED\.md/);
  assert.equal(readFileSync(join(f.target, 'alpha/SKILL.md'), 'utf8'), 'alpha\n');
  assert.equal(spawnSync('node', [SCRIPT, '--plugin-root', join(f.dir, 'missing'), '--to', f.target]).status, 2);
  rmSync(f.dir, { recursive: true });
});

test('real plugins: the wrapper runs the detector from a copy and both creator and rebuild copy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-real-'));
  const target = join(dir, 'project', '.claude', 'skills');
  const root = join(dirname(SCRIPT), '..');
  execFileSync('node', [SCRIPT, '--to', target]);
  for (const name of ['kivo-creator', 'kivo-rebuild']) {
    execFileSync('node', [SCRIPT, '--plugin-root', join(root, 'plugins', name), '--to', target]);
    assert.equal(spawnSync('node', [SCRIPT, '--plugin-root', join(root, 'plugins', name), '--to', target, '--check']).status, 0);
  }
  assert.equal(spawnSync('node', [SCRIPT, '--to', target, '--check']).status, 0);
  const out = execFileSync('node', [join(target, 'roots-triage/scripts/detect-roots-project.mjs'), `--path=${join(dir, 'project')}`], { encoding: 'utf8' });
  const doc = JSON.parse(out);
  assert.equal(doc.error, undefined, out);
  assert.equal(doc.tool.name, 'detect-roots-project');
  rmSync(dir, { recursive: true });
});
