// test/creator/playwright.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPlaywright, NO_PLAYWRIGHT } from '../../plugins/kivo-creator/scripts/lib/playwright.mjs';
import { collectSnapshot } from '../../plugins/kivo-creator/scripts/lib/collect.mjs';

test('returns null when the project has no Playwright, and the message says how to install it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nopw-'));
  writeFileSync(join(dir, 'package.json'), '{}');
  assert.equal(await loadPlaywright(dir), null);
  assert.match(NO_PLAYWRIGHT, /playwright install chromium/);
});

test('loads playwright from the project node_modules, not from this plugin', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fakepw-'));
  const pkg = join(dir, 'node_modules', 'playwright');
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'playwright', main: 'index.js' }));
  writeFileSync(join(pkg, 'index.js'), 'exports.chromium = { fake: true };');
  writeFileSync(join(dir, 'package.json'), '{}');
  const pw = await loadPlaywright(dir);
  assert.equal(pw.name, 'playwright');
  assert.deepEqual(pw.chromium, { fake: true });
});

test('the collector is self-contained so Playwright can serialise it', () => {
  const source = collectSnapshot.toString();
  assert.doesNotMatch(source, /\bimport\b|\brequire\(/);
  assert.match(source, /getComputedStyle/);
});
