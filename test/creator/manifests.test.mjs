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
