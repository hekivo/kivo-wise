// test/creator/acf-catalog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseBlockClass, acfCatalog } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { kebab, pascal } from '../../plugins/kivo-creator/scripts/adapters/shared/names.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX } from './helpers.mjs';

test('names', () => {
  assert.equal(kebab('Feature Grid'), 'feature-grid');
  assert.equal(kebab('FeatureGrid'), 'feature-grid');
  assert.equal(pascal('feature-grid'), 'FeatureGrid');
});

test('catalog reads every ACF Composer block with its fields and nested repeaters', () => {
  const catalog = acfCatalog(resolveStack(join(FIX, 'projects', 'acme-mu-plugin')));
  assert.deepEqual(catalog.map((b) => b.name), ['acf/cta', 'acf/faq', 'acf/feature-grid', 'acf/hero']);
  const grid = catalog.find((b) => b.name === 'acf/feature-grid');
  assert.equal(grid.title, 'Feature Grid');
  assert.equal(grid.group, 'feature-grid');
  assert.equal(grid.whenToUse, 'A grid of product features, each with an icon, a title and a short text.');
  assert.equal(grid.source, 'wp-content/mu-plugins/acme-core/app/Blocks/FeatureGrid.php');
  assert.deepEqual(grid.fields, [
    { name: 'title', type: 'text' },
    { name: 'items', type: 'repeater', min: 1, max: 6, subFields: [{ name: 'title', type: 'text' }, { name: 'text', type: 'textarea' }, { name: 'icon', type: 'image' }] },
  ]);
});

test('abstract classes and files without a block class are ignored', () => {
  assert.equal(parseBlockClass('<?php abstract class Base extends Block {}', 'Base.php'), null);
  assert.equal(parseBlockClass('<?php // helpers', 'x.php'), null);
});

test('Builder::make with a literal sets the field group name', () => {
  const block = parseBlockClass("<?php class Promo extends Block { public $name = 'Promo'; public function fields(): array { $f = Builder::make('promo_box'); $f->addTrueFalse('dark'); return $f->build(); } }", 'Promo.php');
  assert.equal(block.group, 'promo_box');
  assert.deepEqual(block.fields, [{ name: 'dark', type: 'true_false' }]);
});
