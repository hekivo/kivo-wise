// test/creator/manifests.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { PLUGIN, readJson } from './helpers.mjs';

const manifest = (dir) => readJson(join(PLUGIN, dir, 'plugin.json'));

test('the three kivo-creator manifests share name and version', () => {
  const claude = manifest('.claude-plugin');
  for (const dir of ['.cursor-plugin', '.codex-plugin']) {
    const m = manifest(dir);
    assert.equal(m.name, 'kivo-creator', dir);
    assert.equal(m.version, claude.version, dir);
    assert.ok(m.description, `${dir} has a description`);
  }
  assert.equal(claude.name, 'kivo-creator');
});

test('kivo-creator depends on kivo-wise from the same marketplace', () => {
  assert.deepEqual(manifest('.claude-plugin').dependencies, ['kivo-wise']);
});

test('the Codex manifest points at the skills folder', () => {
  const m = manifest('.codex-plugin');
  assert.equal(m.skills, './skills/');
  assert.equal(m.interface.displayName, 'Kivo Creator');
});

import { ROOT } from './helpers.mjs';

const RELATIVE = './plugins/kivo-creator';
const MARKETPLACES = [
  ['.claude-plugin/marketplace.json', RELATIVE],
  ['.cursor-plugin/marketplace.json', RELATIVE],
  ['.codex-plugin/marketplace.json', { source: 'local', path: RELATIVE }],
  ['.agents/plugins/marketplace.json', { source: 'local', path: RELATIVE }],
];

test('every marketplace lists kivo-creator second, with the plugin version and a relative source', () => {
  const version = manifest('.claude-plugin').version;
  for (const [file, source] of MARKETPLACES) {
    const entry = readJson(join(ROOT, file)).plugins[1];
    assert.equal(entry?.name, 'kivo-creator', `${file} plugins[1]`);
    assert.equal(entry.version, version, `${file} version`);
    assert.deepEqual(entry.source, source, `${file} source`);
  }
});

test('kivo-wise stays the first entry of every marketplace', () => {
  for (const [file] of MARKETPLACES) assert.equal(readJson(join(ROOT, file)).plugins[0].name, 'kivo-wise', file);
});
