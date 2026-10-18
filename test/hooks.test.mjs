#!/usr/bin/env node
/**
 * Fixture-based tests for hooks/*.mjs (contract C4).
 *
 * Layout: test/hooks/<hook>/<case>/
 *   stdin.json              raw stdin for the hook (may be malformed on purpose)
 *   expected-exit           exit code
 *   expected-stdout.json    parsed stdout must deep-equal this JSON
 *   expected-stdout-absent  present → stdout must be empty
 *   env.json                optional env overrides (KIVO_WISE_DETECTOR is resolved from the repo root)
 *
 * Tokens {{ROOT}} and {{FIXTURES}} inside stdin.json, env.json and expected-stdout.json
 * are replaced with absolute paths. Every case runs with KIVO_WISE_NO_CACHE=1 and the
 * mu-plugin fixture detector unless env.json says otherwise.
 *
 * Run: node --test test/hooks.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CASES_DIR = join(ROOT, 'test', 'hooks');
const FIXTURES = join(CASES_DIR, 'fixtures');
const HOOKS_DIR = join(ROOT, 'hooks');

const DETECTOR_ENV_KEYS = new Set(['KIVO_WISE_DETECTOR']);

function substitute(text) {
  return text.replaceAll('{{ROOT}}', ROOT).replaceAll('{{FIXTURES}}', FIXTURES);
}

function readCase(caseDir) {
  const stdin = substitute(readFileSync(join(caseDir, 'stdin.json'), 'utf8'));
  const expectedExit = Number.parseInt(readFileSync(join(caseDir, 'expected-exit'), 'utf8').trim(), 10);
  const expectedStdoutPath = join(caseDir, 'expected-stdout.json');
  const expectedStdout = existsSync(expectedStdoutPath)
    ? JSON.parse(substitute(readFileSync(expectedStdoutPath, 'utf8')))
    : undefined;
  const expectAbsent = existsSync(join(caseDir, 'expected-stdout-absent'));
  const envPath = join(caseDir, 'env.json');
  const envOverrides = existsSync(envPath) ? JSON.parse(substitute(readFileSync(envPath, 'utf8'))) : {};
  return { stdin, expectedExit, expectedStdout, expectAbsent, envOverrides };
}

function buildEnv(overrides) {
  const env = { ...process.env };
  delete env.KIVO_WISE_HOOK_DEBUG;
  delete env.KIVO_WISE_HOOK_LOG;
  env.KIVO_WISE_NO_CACHE = '1';
  env.KIVO_WISE_DETECTOR = join(FIXTURES, 'detector-mu-plugin.mjs');
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete env[key];
    } else if (DETECTOR_ENV_KEYS.has(key)) {
      env[key] = resolve(ROOT, value);
    } else {
      env[key] = String(value);
    }
  }
  return env;
}

function runHook(hookName, fixture) {
  const script = join(HOOKS_DIR, `${hookName}.mjs`);
  const result = spawnSync(process.execPath, [script], {
    input: fixture.stdin,
    encoding: 'utf8',
    cwd: ROOT,
    env: buildEnv(fixture.envOverrides),
    timeout: 20_000,
  });
  return { status: result.status ?? -1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

const hookDirs = readdirSync(CASES_DIR)
  .filter((name) => name !== 'fixtures' && statSync(join(CASES_DIR, name)).isDirectory())
  .sort();

for (const hookName of hookDirs) {
  const caseNames = readdirSync(join(CASES_DIR, hookName))
    .filter((name) => statSync(join(CASES_DIR, hookName, name)).isDirectory())
    .sort();

  for (const caseName of caseNames) {
    test(`${hookName} / ${caseName}`, () => {
      const script = join(HOOKS_DIR, `${hookName}.mjs`);
      assert.ok(existsSync(script), `hook script missing: hooks/${hookName}.mjs`);

      const fixture = readCase(join(CASES_DIR, hookName, caseName));
      const { status, stdout, stderr } = runHook(hookName, fixture);

      assert.equal(status, fixture.expectedExit, `exit code\nstdout: ${stdout}\nstderr: ${stderr}`);

      if (fixture.expectAbsent) {
        assert.equal(stdout.trim(), '', `expected silent stdout, got: ${stdout}`);
      }
      if (fixture.expectedStdout !== undefined) {
        let parsed;
        try {
          parsed = JSON.parse(stdout);
        } catch (error) {
          assert.fail(`stdout is not a single JSON object: ${stdout}\n${error.message}`);
        }
        assert.deepEqual(parsed, fixture.expectedStdout);
      }
    });
  }
}

test('every hook has at least three fixture cases', () => {
  const hooks = readdirSync(HOOKS_DIR).filter((f) => f.endsWith('.mjs') && f !== 'lib.mjs').map((f) => f.slice(0, -4));
  for (const hook of hooks) {
    const dir = join(CASES_DIR, hook);
    assert.ok(existsSync(dir), `no fixtures for hooks/${hook}.mjs`);
    const count = readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).length;
    assert.ok(count >= 3, `hooks/${hook}.mjs has ${count} fixture case(s); need at least 3`);
  }
});

test('SessionStart additionalContext stays within 1,500 characters for the mu-plugin fixture', () => {
  const fixture = readCase(join(CASES_DIR, 'session-start', 'mu-plugin-lando'));
  const { stdout } = runHook('session-start', fixture);
  const parsed = JSON.parse(stdout);
  const context = parsed.hookSpecificOutput.additionalContext;
  assert.ok(context.length <= 1500, `additionalContext is ${context.length} chars`);
  assert.ok(!/<[A-Z_]+>/.test(context), 'no shouting tags in additionalContext');
});
