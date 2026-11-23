// Release-please keeps one version per package in .release-please-manifest.json and bumps the
// plugin manifests in the same release pull request. Tests compare the two instead of pinning a
// version, so they hold on main and on the release branch alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...p) => JSON.parse(readFileSync(join(ROOT, ...p), 'utf8'));

test('every release-please package version equals its plugin manifest version', () => {
  const config = readJson('.release-please-config.json');
  const manifest = readJson('.release-please-manifest.json');
  assert.deepEqual(Object.keys(manifest).sort(), Object.keys(config.packages).sort());
  for (const pkg of Object.keys(config.packages)) {
    const plugin = readJson(pkg, '.claude-plugin', 'plugin.json');
    assert.equal(manifest[pkg], plugin.version, `${pkg}: .release-please-manifest.json vs .claude-plugin/plugin.json`);
  }
});
