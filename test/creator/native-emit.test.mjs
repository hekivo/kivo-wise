// test/creator/native-emit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nativeCatalog, emitNativePage, scaffoldNative } from '../../plugins/kivo-creator/scripts/adapters/shared/native-block.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { assign } from '../../plugins/kivo-creator/scripts/lib/fill.mjs';
import { loadTheme } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { lintSource } from '../../plugins/kivo-creator/scripts/lib/lint.mjs';
import { FIX } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-radicle'));
const catalog = nativeCatalog(stack);
const specs = readSpecs(join(FIX, 'runs', 'landing', 'specs'));
const theme = loadTheme(readFileSync(join(stack.appPath, 'resources', 'css', 'app.css'), 'utf8'));

test('emits native block markup with attribute values', () => {
  const hero = catalog.find((b) => b.name === 'acme/hero');
  const { markup, media } = emitNativePage([{ block: hero, spec: specs[0], pairs: assign(specs[0].slots, hero.fields).pairs }]);
  assert.equal(markup, '<!-- wp:acme/hero {"heading":"Acme ships faster","lead":"Plan, build and launch in one place.","image":{"url":"https://acme.test/hero.png","alt":"Acme dashboard"},"button":{"url":"https://acme.test/signup","text":"Start free"}} /-->\n');
  assert.deepEqual(media, [{ spec: '01-hero', block: 'acme/hero', field: 'image', src: 'https://acme.test/hero.png', alt: 'Acme dashboard' }]);
});

test('scaffolds block.json next to the existing blocks, a Blade view and registration notes', () => {
  const out = scaffoldNative(stack, specs[3], { theme, catalog });
  assert.deepEqual(out.files.map((f) => f.path), ['resources/blocks/stats/block.json', 'resources/views/blocks/stats.blade.php', 'resources/css/blocks/stats.css']);
  assert.deepEqual(JSON.parse(out.files[0].content), {
    $schema: 'https://schemas.wp.org/trunk/block.json',
    apiVersion: 3,
    name: 'acme/stats',
    title: 'Stats',
    category: 'design',
    description: 'Stats section generated from the design.',
    attributes: {
      heading: { type: 'string' },
      items: { type: 'array', items: { type: 'object', properties: { heading: { type: 'string' }, text: { type: 'string' } } } },
    },
    supports: { html: false, anchor: true },
  });
  assert.equal(out.files[1].content, readFileSync(join(FIX, 'golden', 'native', 'stats.blade.php'), 'utf8'));
  assert.deepEqual(out.commands, []);
  assert.match(out.notes.join('\n'), /register_block_type\(.*resources\/blocks\/stats/);
  assert.match(out.notes.join('\n'), /editor/);
  for (const f of out.files) assert.deepEqual(lintSource(f.content, f.path), [], f.path);
});

test('the scaffolded block reads back into the catalog with the same fields', () => {
  const out = scaffoldNative(stack, specs[3], { theme, catalog });
  const json = JSON.parse(out.files[0].content);
  assert.deepEqual(Object.keys(json.attributes), out.block.fields.map((f) => f.name));
  assert.deepEqual(out.block.fields[1].subFields.map((f) => f.type), ['text', 'text']);
});
