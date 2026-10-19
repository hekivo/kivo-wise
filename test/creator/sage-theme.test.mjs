// test/creator/sage-theme.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { assign } from '../../plugins/kivo-creator/scripts/lib/fill.mjs';
import { loadTheme } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { FIX } from './helpers.mjs';

const specs = readSpecs(join(FIX, 'runs', 'landing', 'specs'));

test('ACF Composer theme: catalog, emit and scaffold inside the theme with the theme namespace', async () => {
  const stack = resolveStack(join(FIX, 'projects', 'acme-sage'));
  const adapter = await selectAdapter(stack);
  assert.equal(adapter.name, 'sage-theme');
  const catalog = adapter.catalog(stack);
  assert.deepEqual(catalog.map((b) => b.name), ['acf/hero']);
  const { markup } = adapter.emitPage(stack, [{ block: catalog[0], spec: specs[0], pairs: assign(specs[0].slots, catalog[0].fields).pairs }]);
  assert.match(markup, /^<!-- wp:acf\/hero \{"name":"acf\/hero","data":\{"title":"Acme ships faster"/);
  const out = adapter.scaffoldBlock(stack, specs[3], { theme: loadTheme(readFileSync(adapter.themeCss(stack), 'utf8')), catalog });
  assert.equal(out.files[0].path, 'web/app/themes/acme/app/Blocks/Stats.php');
  assert.match(out.files[0].content, /^<\?php\n\nnamespace App\\Blocks;/);
});

test('native theme: block.json catalog and native scaffold', async () => {
  const base = resolveStack(join(FIX, 'projects', 'acme-radicle'));
  const stack = { ...base, profile: 'sage-theme', blocks: 'native' };
  const adapter = await selectAdapter(stack);
  assert.deepEqual(adapter.catalog(stack).map((b) => b.name), ['acme/faq', 'acme/hero']);
  const out = adapter.scaffoldBlock(stack, specs[3], { theme: loadTheme(''), catalog: adapter.catalog(stack) });
  assert.equal(out.block.name, 'acme/stats');
});
