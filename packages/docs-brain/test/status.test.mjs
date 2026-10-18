import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { PROJECT, runCli, tmp, write } from './helpers.mjs';

const MANIFEST = resolve(import.meta.dirname, 'fixtures/manifests/versions.yaml');

function lockWith(sources) {
  const corpus = join(tmp(), 'out');
  write(join(corpus, '.state/lock.json'), JSON.stringify({ version: 1, sources }, null, 2));
  return corpus;
}

const entry = (version, extra = {}) => ({ type: 'git', version, ref: version, pages: { 'a.md': { title: 'A', sha256: 'x' } }, page_count: 1, upstream: {}, ...extra });

test('status --check exits 1 when the project moved to another docs version', async () => {
  const corpus = lockWith({ laravel: entry('12.x', { installed: 'v12.40.0' }), livewire: entry('4.3.5') });
  const r = await runCli(['status', '--check', '--offline', '--project', PROJECT, '--manifest', MANIFEST, '--corpus', corpus]);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /laravel.*corpus 12\.x, project 13\.x/);
  assert.match(r.stdout, /livewire.*project ok/);
});

test('status --check exits 0 when corpus versions match the locks', async () => {
  const corpus = lockWith({ laravel: entry('13.x', { installed: 'v13.26.1' }), livewire: entry('4.3.5'), acf: { ...entry('6.8'), type: 'rest' } });
  const r = await runCli(['status', '--check', '--offline', '--project', PROJECT, '--manifest', MANIFEST, '--corpus', corpus]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no drift/);
});

test('status without --check reports drift but exits 0', async () => {
  const corpus = lockWith({ phpunit: entry('9.5') });
  const r = await runCli(['status', '--offline', '--project', PROJECT, '--manifest', MANIFEST, '--corpus', corpus]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /phpunit.*corpus 9\.5, project 9\.6/);
});
