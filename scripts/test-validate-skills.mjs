#!/usr/bin/env node
/**
 * Test suite for scripts/validate-skills.mjs (skill contract C3).
 *
 * Runs the real validator against fixture trees under
 * scripts/__fixtures__/skills/{valid,invalid} and against the three entry
 * skills of this plugin, asserting exit codes and diagnostics.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, 'validate-skills.mjs');
const FIXTURES = resolve(__dirname, '__fixtures__', 'skills');
const REPO_ROOT = resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(label, condition, details) {
  if (condition) {
    console.log(`  ok   ${label}`);
    passed++;
  } else {
    console.log(`  FAIL ${label}`);
    if (details) console.log(`       ${details}`);
    failed++;
  }
}

function run(args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
  return { exit: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function summary(stdout) {
  const m = stdout.match(/Summary: (\d+) passed, (\d+) warnings, (\d+) errors/);
  return m ? { passed: +m[1], warnings: +m[2], errors: +m[3] } : null;
}

function testValidFixture() {
  console.log('\nCase: valid fixture tree passes with 0 errors');
  const { exit, stdout } = run(['--root', join(FIXTURES, 'valid')]);
  assert('exit code 0', exit === 0, stdout.slice(-300));
  const s = summary(stdout);
  assert('summary reports 0 errors', s && s.errors === 0, stdout.slice(-300));
  assert('good-skill listed as passing', stdout.includes('✓ skills/good-skill'));
  assert('third-party skill checked by name only', stdout.includes('✓ third-party/gpl-skill'));
}

function testInvalidFixture() {
  console.log('\nCase: invalid fixture tree reports every contract violation');
  const { exit, stdout } = run(['--root', join(FIXTURES, 'invalid')]);
  assert('exit code 1', exit === 1, `exit ${exit}`);
  const expectations = [
    ['extra-key', 'frontmatter key "user-invocable" is not allowed'],
    ['wrong-name', 'name "another-name" must equal the folder name "wrong-name"'],
    ['no-use-when', 'description must start with "Use when"'],
    ['yaml-plain-scalar', 'description is not a valid plain YAML scalar'],
    ['long-description', 'characters (max 1024)'],
    ['bad-sections', 'H2 sections in order'],
    ['extra-section', 'unexpected H2: ## Notes'],
    ['no-fix-table', 'must contain a Symptom / Cause / Fix table'],
    ['tool-name', 'tool name "Cursor" is not allowed'],
    ['plugin-var', '${CLAUDE_*} variable'],
    ['plugin-var', '$ARGUMENTS placeholder'],
    ['ref-no-h1', 'references/notes.md — must start with an H1 title'],
    ['cross-link', "links into another skill's folder"],
    ['too-long', 'lines (max 500)'],
    ['missing-script', 'script "scripts/check.mjs" not found'],
    ['parent-script', 'no "../" or absolute paths'],
    ['broken-ref-link', 'link target "references/missing.md" does not exist'],
    ['no-frontmatter', 'missing YAML frontmatter'],
    ['third-party/wrong-tp', 'name "something-else" must equal the folder name "wrong-tp"'],
  ];
  for (const [skill, message] of expectations) {
    const line = stdout.split('\n').find((l) => l.includes(skill) && l.includes(message));
    assert(`${skill}: ${message}`, Boolean(line), stdout.split('\n').filter((l) => l.includes(skill)).join(' | ').slice(0, 300));
  }
  assert('fine-skill still passes inside the invalid tree', stdout.includes('✓ skills/fine-skill'));
}

function testOnlyFlag() {
  console.log('\nCase: --only validates the named skill and counts the rest');
  const { exit, stdout } = run(['--root', join(FIXTURES, 'invalid'), '--only', 'fine-skill']);
  assert('exit code 0 when the selected skill passes', exit === 0, stdout.slice(-300));
  assert('no diagnostics for unselected skills', !stdout.includes('extra-key'), stdout.slice(-300));
  const skipped = stdout.match(/Skipped (\d+) skill\(s\) not listed in --only; (\d+) of them currently fail the contract/);
  assert('skipped summary line present', Boolean(skipped), stdout.slice(-300));
  if (skipped) {
    assert('18 skills skipped', skipped[1] === '18', skipped[0]);
    assert('18 of them failing', skipped[2] === '18', skipped[0]);
  }
}

function testOnlyUnknown() {
  console.log('\nCase: --only with an unknown skill name fails fast');
  const { exit, stderr } = run(['--root', join(FIXTURES, 'valid'), '--only', 'does-not-exist']);
  assert('exit code 1', exit === 1, `exit ${exit}`);
  assert('names the missing skill', stderr.includes('does-not-exist'), stderr);
}

function testCRLF() {
  console.log('\nCase: CRLF line endings parse like LF');
  const tmp = mkdtempSync(join(tmpdir(), 'validate-skills-crlf-'));
  try {
    cpSync(join(FIXTURES, 'valid'), tmp, { recursive: true });
    const target = join(tmp, 'skills', 'good-skill', 'SKILL.md');
    writeFileSync(target, readFileSync(target, 'utf8').replace(/\r?\n/g, '\r\n'));
    const { exit, stdout } = run(['--root', tmp]);
    assert('exit code 0 with CRLF skill', exit === 0, stdout.slice(-300));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function testProjectRootScript() {
  console.log('\nCase: script paths resolve against the parent of --root (project skills)');
  const tmp = mkdtempSync(join(tmpdir(), 'validate-skills-proj-'));
  try {
    const root = join(tmp, '.claude');
    cpSync(join(FIXTURES, 'valid'), root, { recursive: true });
    const target = join(root, 'skills', 'good-skill', 'SKILL.md');
    writeFileSync(target, `${readFileSync(target, 'utf8').trimEnd()}\n\nRun \`scripts/docker/core-setup.sh\` in the repository.\n`);
    const before = run(['--root', root]);
    assert('missing project script is an error', before.exit === 1 && before.stdout.includes('scripts/docker/core-setup.sh'), before.stdout.slice(-300));
    mkdirSync(join(tmp, 'scripts', 'docker'), { recursive: true });
    writeFileSync(join(tmp, 'scripts', 'docker', 'core-setup.sh'), '#!/bin/sh\n');
    const after = run(['--root', root]);
    assert('script at the parent of --root is accepted', after.exit === 0, after.stdout.slice(-300));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function testEntrySkills() {
  console.log('\nCase: the entry skills of this plugin satisfy the contract');
  const entry = ['roots-router', 'roots-triage', 'lando-wp'].filter((s) => existsSync(join(REPO_ROOT, 'skills', s, 'SKILL.md')));
  if (entry.length === 0) {
    console.log('  skip no entry skills present yet');
    return;
  }
  const { exit, stdout } = run(entry.flatMap((s) => ['--only', s]));
  assert('exit code 0', exit === 0, stdout.slice(-600));
  for (const skill of entry) {
    assert(`${skill} passes`, stdout.includes(`✓ skills/${skill}`), stdout.split('\n').filter((l) => l.includes(skill)).join(' | ').slice(0, 400));
  }
}

console.log('Testing scripts/validate-skills.mjs');
testValidFixture();
testInvalidFixture();
testOnlyFlag();
testOnlyUnknown();
testCRLF();
testProjectRootScript();
testEntrySkills();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
