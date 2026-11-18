// test/rebuild/agnostic.test.mjs
// The repository is public. A maintainer keeps a private list of client names outside it
// (~/.config/kion/forbidden-names.txt, one name per line); this test fails when any of them
// appears in the plugin or in its fixtures. It is skipped on machines without the list, such as CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FIX, PLUGIN } from './helpers.mjs';

const LIST = join(homedir(), '.config', 'kion', 'forbidden-names.txt');
function* walk(dir) { for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) yield* walk(p); else yield p; } }

test('no client name in the plugin or its fixtures', { skip: !existsSync(LIST) && 'no forbidden-names list on this machine' }, () => {
  const names = readFileSync(LIST, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const hits = [];
  for (const root of [PLUGIN, FIX]) for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const n of names) if (new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) hits.push(`${file}: ${n}`);
  }
  assert.deepEqual(hits, []);
});
