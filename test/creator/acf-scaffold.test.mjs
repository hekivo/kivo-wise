// test/creator/acf-scaffold.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { loadTheme } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { lintSource } from '../../plugins/kivo-creator/scripts/lib/lint.mjs';
import { parseBlockClass } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { FIX } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-mu-plugin'));
const stats = readSpecs(join(FIX, 'runs', 'landing', 'specs')).find((s) => s.id === '04-stats');
const golden = (f) => readFileSync(join(FIX, 'golden', 'acorn-mu-plugin', f), 'utf8');

test('scaffolds class, view and CSS that match the golden files', async () => {
  const adapter = await selectAdapter(stack);
  const theme = loadTheme(readFileSync(adapter.themeCss(stack), 'utf8'));
  const out = adapter.scaffoldBlock(stack, stats, { theme, catalog: adapter.catalog(stack) });
  assert.deepEqual(out.commands, ['acf:block Stats --no-interaction']);
  assert.deepEqual(out.files.map((f) => f.path), [
    'wp-content/mu-plugins/acme-core/app/Blocks/Stats.php',
    'wp-content/mu-plugins/acme-core/resources/views/blocks/stats.blade.php',
    'wp-content/mu-plugins/acme-core/resources/css/blocks/stats.css',
  ]);
  assert.equal(out.files[0].content, golden('Stats.php'));
  assert.equal(out.files[1].content, golden('stats.blade.php'));
  assert.equal(out.files[2].content, golden('stats.css'));
  assert.deepEqual(out.proposals.map((p) => p.suggested), ['--text-body']);
  for (const f of out.files) assert.deepEqual(lintSource(f.content, f.path), [], f.path);
});

test('the scaffolded class reads back as a catalog block that holds the spec', async () => {
  const adapter = await selectAdapter(stack);
  const out = adapter.scaffoldBlock(stack, stats, { theme: loadTheme(''), catalog: [] });
  const parsed = parseBlockClass(out.files[0].content, out.files[0].path);
  assert.deepEqual(parsed.fields, out.block.fields);
  assert.equal(out.block.name, 'acf/stats');
});

test('a name already in the catalog gets a numeric suffix', async () => {
  const adapter = await selectAdapter(stack);
  const out = adapter.scaffoldBlock(stack, stats, { theme: loadTheme(''), catalog: [{ className: 'Stats', slug: 'stats' }] });
  assert.equal(out.block.name, 'acf/stats-2');
});
