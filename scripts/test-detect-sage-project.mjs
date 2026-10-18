#!/usr/bin/env node
// Minimal check of the deprecated detect-sage-project.mjs shim. The detector itself is
// covered by `node --test test/detect-roots-project.test.mjs`.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const shim = fileURLToPath(new URL('./detect-sage-project.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('../test/fixtures/projects/sage-theme', import.meta.url));
const r = spawnSync(process.execPath, [shim, '--path', fixture], { encoding: 'utf8' });

assert.equal(r.status, 0, 'shim exits 0');
assert.match(r.stderr, /deprecated/, 'shim prints a deprecation note on stderr');
const out = JSON.parse(r.stdout);
assert.equal(out.tool.name, 'detect-roots-project', 'shim forwards to the new detector');
assert.equal(out.apps[0].kind, 'sage-theme');
console.log('detect-sage-project shim: 4 checks passed');
