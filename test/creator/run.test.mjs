// test/creator/run.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRun, runId, runPaths, slugify } from '../../plugins/kivo-creator/scripts/lib/run.mjs';

test('runId is a UTC timestamp plus a slug', () => {
  assert.equal(runId(new Date(Date.UTC(2026, 9, 19, 8, 5, 3)), 'Acme Landing!'), '20261019-080503-acme-landing');
  assert.equal(slugify('  Café / Ünïcode  '), 'cafe-unicode');
});

test('createRun makes the folders and a self-ignoring .creator/.gitignore', () => {
  const project = mkdtempSync(join(tmpdir(), 'proj-'));
  const run = createRun(project, 'landing', new Date(Date.UTC(2026, 0, 2, 3, 4, 5)));
  assert.equal(run.id, '20260102-030405-landing');
  for (const sub of ['specs', 'refs', 'verify']) assert.ok(existsSync(join(run.dir, sub)), sub);
  assert.equal(readFileSync(join(project, '.creator', '.gitignore'), 'utf8'), '*\n');
  assert.equal(runPaths(run.dir).plan, join(run.dir, 'match-plan.json'));
});
