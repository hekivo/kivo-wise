import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ROOT, PLUGIN, readJson } from './helpers.mjs';

const MARKETS = ['.claude-plugin', '.cursor-plugin', '.codex-plugin'].map((d) => join(ROOT, d, 'marketplace.json'))
  .concat(join(ROOT, '.agents', 'plugins', 'marketplace.json'));

test('three manifests share name and version and depend on kivo-wise', () => {
  const claude = readJson(join(PLUGIN, '.claude-plugin', 'plugin.json'));
  assert.equal(claude.name, 'kivo-rebuild');
  assert.deepEqual(claude.dependencies, ['kivo-wise']);
  for (const d of ['.codex-plugin', '.cursor-plugin']) {
    const m = readJson(join(PLUGIN, d, 'plugin.json'));
    assert.equal(m.name, 'kivo-rebuild');
    assert.equal(m.version, claude.version);
  }
});

test('every marketplace lists kivo-rebuild as plugins[2] with the plugin version', () => {
  const version = readJson(join(PLUGIN, '.claude-plugin', 'plugin.json')).version;
  for (const file of MARKETS) {
    const entry = readJson(file).plugins[2];
    assert.equal(entry?.name, 'kivo-rebuild', file);
    assert.equal(entry.version, version, file);
  }
});

test('release-please knows the package', () => {
  const cfg = readJson(join(ROOT, '.release-please-config.json'));
  assert.ok(cfg.packages['plugins/kivo-rebuild']);
  assert.ok(cfg.packages['.']['exclude-paths'].includes('plugins/kivo-rebuild'));
  assert.equal(readJson(join(ROOT, '.release-please-manifest.json'))['plugins/kivo-rebuild'], '0.1.0');
});
