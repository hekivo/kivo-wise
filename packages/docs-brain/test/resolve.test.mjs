import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadManifest } from '../src/manifest.mjs';
import { readProjectVersions, resolveSources, loadProjectConfig } from '../src/resolve.mjs';

const PROJECT = resolve(import.meta.dirname, 'fixtures/project');
const MANIFEST = resolve(import.meta.dirname, 'fixtures/manifests/versions.yaml');
const BIN = resolve(import.meta.dirname, '../bin/docs-brain.mjs');

test('readProjectVersions reads composer.lock, yarn.lock and package.json from .docs-brain.json locks[]', () => {
  const cfg = loadProjectConfig(PROJECT);
  assert.equal(cfg.roots.length, 2);
  assert.ok(cfg.roots[0].endsWith('corpus-a'));
  const v = readProjectVersions(PROJECT, cfg);
  assert.equal(v.composer['illuminate/support'], 'v13.26.1');
  assert.equal(v.composer['roots/wordpress'], '7.1.3');
  assert.equal(v.composer['phpunit/phpunit'], '9.6.35', 'packages-dev are read too');
  assert.equal(v.npm['vite'], '6.2.0');
  assert.equal(v.npm['tailwindcss'], '4.3.3', 'yarn.lock resolution wins over the package.json range');
  assert.equal(v.npm['@playwright/test'], '1.58.2');
});

test('readProjectVersions discovers locks without .docs-brain.json (bounded walk)', () => {
  const v = readProjectVersions(PROJECT, { locks: [] });
  assert.equal(v.composer['livewire/livewire'], 'v4.3.5');
  assert.equal(v.npm['vite'], '6.2.0');
});

test('resolveSources maps lock versions through strategies and map templates', () => {
  const m = loadManifest(MANIFEST);
  const versions = readProjectVersions(PROJECT, loadProjectConfig(PROJECT));
  const r = Object.fromEntries(resolveSources(m, versions).map((x) => [x.id, x]));
  assert.equal(r.laravel.ref, '13.x');
  assert.equal(r.laravel.version, '13.x');
  assert.equal(r.laravel.installed, 'v13.26.1');
  assert.equal(r.livewire.ref, 'v4.3.5');
  assert.equal(r.livewire.version, '4.3.5');
  assert.equal(r.phpunit.ref, '9.6');
  assert.equal(r.vite.ref, 'v6.2.0');
  assert.equal(r.playwright.ref, 'v1.58.2');
  assert.equal(r['wordpress-reference'].version, '7.1');
  assert.equal(r['wordpress-reference'].ref, null, 'rest sources have no ref');
  assert.equal(r.acf.version, '6.8');
  assert.equal(r.tailwindcss.version, '4');
  assert.equal(r.tailwindcss.ref, 'main');
  assert.equal(r['roots-docs'].version, null, 'record-sha is only known after fetching');
  assert.equal(r['roots-docs'].strategy, 'record-sha');
  assert.equal(r['roots-docs'].installed, 'v6.2.0');
  assert.equal(r.composer.version, 'main', 'no version block: the ref is the version');
  assert.equal(r['yoast-developer'].version, 'main');
  assert.equal(r['lando-plugins'].version, 'main');
});

test('resolveSources flags a source whose package is not installed', () => {
  const m = loadManifest(MANIFEST);
  const versions = readProjectVersions(PROJECT, loadProjectConfig(PROJECT));
  const hb = resolveSources(m, versions).find((x) => x.id === 'wordpress-handbooks');
  assert.equal(hb.version, null);
  assert.match(hb.note, /not\/installed/);
});

test('CLI resolve prints the version table', () => {
  const out = execFileSync('node', [BIN, 'resolve', '--project', PROJECT, '--manifest', MANIFEST], { encoding: 'utf8' });
  assert.match(out, /laravel\s+\|\s+illuminate\/support\s+\|\s+v13\.26\.1\s+\|.*13\.x/);
  assert.match(out, /livewire.*v4\.3\.5/);
  assert.match(out, /phpunit.*9\.6/);
  assert.match(out, /vite.*v6\.2\.0/);
});
