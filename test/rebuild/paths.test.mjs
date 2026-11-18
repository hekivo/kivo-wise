import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath, joinUrl } from '../../plugins/kivo-rebuild/scripts/lib/paths.mjs';

test('normalizePath joins encoding, origin and trailing-slash variants', () => {
  const o = 'https://www.example.test';
  assert.equal(normalizePath('https://www.example.test/caf%C3%A9', o), '/café/');
  assert.equal(normalizePath('/café/'), '/café/');
  assert.equal(normalizePath('/a'), '/a/');
  assert.equal(normalizePath('//a//b'), '/a/b/');
  assert.equal(normalizePath('/file.pdf'), '/file.pdf');
  assert.equal(normalizePath('/?s=x&b=1'), '/?b=1&s=x');
  assert.equal(normalizePath('https://other.test/x', o), 'https://other.test/x/');
  assert.equal(normalizePath('/%E0%A4%A'), '/%E0%A4%A/');
});

test('joinUrl', () => {
  assert.equal(joinUrl('https://a.test/', '/x/'), 'https://a.test/x/');
});
