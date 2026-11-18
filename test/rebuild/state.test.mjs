import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpProject, run } from './helpers.mjs';
import { newRunId, runDir, writeDoc, readDoc, latestRun, ensureGitignore } from '../../plugins/kivo-rebuild/scripts/lib/state.mjs';

test('newRunId is date + slug', () => {
  assert.equal(newRunId('Acme Store', new Date('2026-01-02T10:00:00Z')), '2026-01-02-acme-store');
});

test('writeDoc validates, stamps and writes atomically', () => {
  const p = tmpProject();
  const id = newRunId('x');
  const file = join(runDir(p, id), 'urls.json');
  writeDoc(file, 'urls', { items: [{ path: '/', origin: 'sitemap', type: 'page', lastmod: null }] }, { runId: id });
  const doc = readDoc(file);
  assert.equal(doc.schema_version, 1);
  assert.equal(doc.kind, 'urls');
  assert.equal(doc.run_id, id);
  assert.equal(latestRun(p), id);
  assert.throws(() => writeDoc(file, 'urls', { items: [{ path: 'no-slash' }] }, { runId: id }), /urls\.json/);
  assert.equal(readDoc(file).items[0].path, '/');
});

test('ensureGitignore ignores everything under .rebuild', () => {
  const p = tmpProject();
  ensureGitignore(p);
  assert.equal(readFileSync(join(p, '.rebuild', '.gitignore'), 'utf8'), '*\n');
});

test('validate.mjs reports invalid files', () => {
  const p = tmpProject();
  const dir = join(p, '.rebuild', 'runs', 'r1');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'urls.json'), JSON.stringify({ schema_version: 1, kind: 'urls', run_id: 'r1', generated_at: 'x', items: [{ path: 'bad' }] }));
  const r = run('validate.mjs', ['--project=' + p, '--run=r1']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /urls\.json: \$\.items\[0\]\.path: does not match/);
});
