// test/creator/code-connect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { proposeMappings, bladeComponents, similarity } from '../../plugins/kivo-creator/scripts/lib/code-connect.mjs';
import { componentsFromMetadata } from '../../plugins/kivo-creator/scripts/lib/figma.mjs';
import { acfCatalog } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX, PLUGIN } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-mu-plugin'));
const components = componentsFromMetadata(readFileSync(join(FIX, 'figma', 'metadata.xml'), 'utf8'));
const map = JSON.parse(readFileSync(join(FIX, 'figma', 'code-connect-map.json'), 'utf8'));

test('similarity ignores variant words', () => {
  assert.equal(similarity('Hero/Default', 'Hero'), 1);
  assert.equal(similarity('Feature Card', 'Feature Grid'), 1 / 3);
});

test('Blade components are listed as x-<name>', () => {
  assert.deepEqual(bladeComponents(stack).map((c) => c.name), ['x-button']);
});

test('keeps existing mappings, proposes confident ones and flags components without code', () => {
  const r = proposeMappings({ components, map, targets: [...acfCatalog(stack), ...bladeComponents(stack)] });
  assert.deepEqual(r.mapped.map((m) => `${m.component}->${m.codeConnectName}`), ['Button/Primary->x-button']);
  assert.deepEqual(r.proposals.map((p) => `${p.component}->${p.target}`), ['Hero/Default->acf/hero']);
  assert.deepEqual(r.unmatched.map((u) => u.component), ['Logo/Acme', 'Feature Card', 'Pricing/Plan']);
});

test('CLI writes the proposal file and sends nothing', () => {
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'code-connect.mjs'), `--project=${join(FIX, 'projects', 'acme-mu-plugin')}`, `--metadata=${join(FIX, 'figma', 'metadata.xml')}`, `--map=${join(FIX, 'figma', 'code-connect-map.json')}`], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(JSON.parse(res.stdout).proposals[0].target, 'acf/hero');
});
