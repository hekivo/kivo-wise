// test/creator/blade-directive.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bladeDirectiveRegistered } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { loadTheme } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { lintSource } from '../../plugins/kivo-creator/scripts/lib/lint.mjs';
import { FIX } from './helpers.mjs';

const stats = readSpecs(join(FIX, 'runs', 'landing', 'specs')).find((s) => s.id === '04-stats');

test('finds a Blade directive registered in the project code', () => {
  assert.equal(bladeDirectiveRegistered(resolveStack(join(FIX, 'projects', 'acme-mu-plugin')), 'textarea'), true);
  assert.equal(bladeDirectiveRegistered(resolveStack(join(FIX, 'projects', 'acme-sage')), 'textarea'), false);
});

test('without @textarea the ACF view escapes textarea fields with nl2br(e()) and says so in the notes', async () => {
  const stack = resolveStack(join(FIX, 'projects', 'acme-sage'));
  const adapter = await selectAdapter(stack);
  const out = adapter.scaffoldBlock(stack, stats, { theme: loadTheme(readFileSync(adapter.themeCss(stack), 'utf8')), catalog: adapter.catalog(stack) });
  const view = out.files[1].content;
  assert.doesNotMatch(view, /@textarea/);
  assert.match(view, /<p class="text-muted">\{!! nl2br\(e\(\$item\['text'\]\)\) !!\}<\/p>/);
  assert.match(out.notes.join('\n'), /@textarea is not registered/);
  assert.deepEqual(lintSource(view, out.files[1].path), []);
});

test('with @textarea registered the view keeps the directive and adds no note', async () => {
  const stack = resolveStack(join(FIX, 'projects', 'acme-mu-plugin'));
  const adapter = await selectAdapter(stack);
  const out = adapter.scaffoldBlock(stack, stats, { theme: loadTheme(readFileSync(adapter.themeCss(stack), 'utf8')), catalog: adapter.catalog(stack) });
  assert.match(out.files[1].content, /@textarea\(\$item\['text'\]\)/);
  assert.doesNotMatch(out.notes.join('\n'), /@textarea/);
});
