// Integration: SessionStart hook driven by the real detector (no canned detector fixture),
// so a change in the detector's output shape cannot silently empty the session context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(ROOT, 'hooks', 'session-start.mjs');
const FIXTURES = join(ROOT, 'test', 'fixtures', 'projects');

function context(project) {
  const env = { ...process.env, KIVO_WISE_NO_CACHE: '1' };
  delete env.KIVO_WISE_DETECTOR;
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd: join(FIXTURES, project) }),
    env,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  if (!res.stdout.trim()) return '';
  return JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
}

test('mu-plugin fixture: profile and runner commands reach the session context', () => {
  const text = context('composer-mu-plugin');
  assert.match(text, /profile acorn-mu-plugin @ wp-content\/mu-plugins\//);
  assert.match(text, /wp=lando wp/);
  assert.match(text, /acorn=lando wp acorn/);
  assert.match(text, /\ncommands: write every wp\/acorn\/composer\/node\/test command exactly as on the runner line \(e\.g\. `lando wp acorn optimize:clear`\)/);
  assert.match(text, /CI\/deploy commands .* separate block/);
  assert.ok(text.length <= 1500, `context is ${text.length} chars`);
});

test('radicle fixture: radicle-app profile with runner commands', () => {
  const text = context('radicle');
  assert.match(text, /profile radicle-app @ \./);
  assert.match(text, /wp=lando wp/);
  assert.match(text, /\ncommands: .*runner line/);
});

test('plain WordPress fixture without Acorn: context stays within the cap', () => {
  const text = context('plain-wp');
  assert.ok(text.length <= 1500);
});
