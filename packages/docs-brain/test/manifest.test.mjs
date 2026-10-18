import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadManifest } from '../src/manifest.mjs';

const FIXTURE = resolve(import.meta.dirname, 'fixtures/manifests/versions.yaml');

test('loadManifest applies defaults and normalises sources', () => {
  const m = loadManifest(FIXTURE);
  assert.equal(m.corpusDir, 'corpus');
  assert.equal(m.defaults.politeness_ms, 0);
  const laravel = m.sources.find((s) => s.id === 'laravel');
  assert.equal(laravel.type, 'git');
  assert.equal(laravel.redistribute, true, 'defaults.redistribute applies');
  assert.equal(laravel.politeness_ms, 0);
  const acf = m.sources.find((s) => s.id === 'acf');
  assert.equal(acf.redistribute, false, 'explicit redistribute wins');
  assert.deepEqual(acf.collections, ['resource']);
});

test('loadManifest expands the repos list form into sub-repos', () => {
  const m = loadManifest(FIXTURE);
  const lando = m.sources.find((s) => s.id === 'lando-plugins');
  assert.equal(lando.repos.length, 2);
  assert.equal(lando.repos[0].name, 'php');
  assert.equal(lando.repos[0].root, 'docs');
  assert.deepEqual(lando.repos[1].include, ['index.md']);
  assert.equal(lando.repos[1].convert, 'vitepress', 'source-level convert is inherited');
});

test('loadManifest rejects unknown source types and duplicate ids with notes, not throws', () => {
  const m = loadManifest(resolve(import.meta.dirname, 'fixtures/manifests/broken.yaml'));
  assert.equal(m.sources.length, 1);
  assert.ok(m.notes.some((n) => /unknown type "ftp"/.test(n)));
  assert.ok(m.notes.some((n) => /duplicate id "dup"/.test(n)));
});
