// test/creator/stack.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX, tmpCopy } from './helpers.mjs';

const MU = join(FIX, 'projects', 'acme-mu-plugin');

test('.roots-stack.json gives profile and app; the namespace comes from the app composer.json', () => {
  const s = resolveStack(MU);
  assert.equal(s.profile, 'acorn-mu-plugin');
  assert.equal(s.appPath, join(MU, 'wp-content', 'mu-plugins', 'acme-core'));
  assert.equal(s.namespace, 'AcmeCore\\');
  assert.equal(s.runner, 'lando');
});

test('without the flag, the kivo-wise detector output is used (kind mapped to profile)', () => {
  const dir = tmpCopy(MU);
  rmSync(join(dir, '.roots-stack.json'));
  const detection = { apps: [{ kind: 'acorn-plugin', path: 'wp-content/mu-plugins/acme-core', namespace: 'AcmeCore\\', blocks: 'acf-composer' }], active: 0, runtime: { runner: 'lando' } };
  const s = resolveStack(dir, { detection });
  assert.equal(s.profile, 'acorn-mu-plugin');
  assert.equal(s.blocks, 'acf-composer');
});

test('the flag wins over the detector', () => {
  const detection = { apps: [{ kind: 'sage-theme', path: 'web/app/themes/x' }], active: 0 };
  assert.equal(resolveStack(MU, { detection }).profile, 'acorn-mu-plugin');
});

test('no flag and no detector output is an error that says how to fix it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nostack-'));
  mkdirSync(join(dir, 'x'));
  assert.throws(() => resolveStack(dir), /roots-detect --write/);
});
