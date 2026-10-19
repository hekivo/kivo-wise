// test/creator/acorn-mu-plugin.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { assign } from '../../plugins/kivo-creator/scripts/lib/fill.mjs';
import { fieldKey } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { FIX } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-mu-plugin'));
const [hero, faq] = readSpecs(join(FIX, 'runs', 'landing', 'specs'));

test('selects the adapter and finds the theme CSS', async () => {
  const adapter = await selectAdapter(stack);
  assert.equal(adapter.name, 'acorn-mu-plugin');
  assert.equal(adapter.themeCss(stack), join(stack.appPath, 'resources', 'css', 'app.css'));
  assert.equal(adapter.catalog(stack).length, 4);
});

test('emits acf/* block markup with field keys, and lists images to import', async () => {
  const adapter = await selectAdapter(stack);
  const catalog = adapter.catalog(stack);
  const entry = (spec, name) => { const block = catalog.find((b) => b.name === name); return { block, spec, pairs: assign(spec.slots, block.fields).pairs }; };
  const { markup, media } = adapter.emitPage(stack, [entry(hero, 'acf/hero'), entry(faq, 'acf/faq')]);
  const [heroLine, faqLine] = markup.trimEnd().split('\n\n');
  assert.equal(heroLine, '<!-- wp:acf/hero {"name":"acf/hero","data":{"title":"Acme ships faster","_title":"field_hero_title","lead":"Plan, build and launch in one place.","_lead":"field_hero_lead","image":null,"_image":"field_hero_image","cta":{"url":"https://acme.test/signup","title":"Start free","target":""},"_cta":"field_hero_cta"},"mode":"preview"} /-->');
  assert.match(faqLine, /"questions":3,"_questions":"field_faq_questions","questions_0_question":"Can I cancel any time\?","_questions_0_question":"field_faq_questions_question","questions_0_answer":"Yes, from your account settings.","_questions_0_answer":"field_faq_questions_answer"/);
  assert.deepEqual(media, [{ spec: '01-hero', block: 'acf/hero', field: 'image', src: 'https://acme.test/hero.png', alt: 'Acme dashboard' }]);
});

test('field keys follow ACF Builder: spaces become _, dashes stay, lowercase', () => {
  assert.equal(fieldKey('feature-grid', ['items', 'title']), 'field_feature-grid_items_title');
  assert.equal(fieldKey('Promo Box', ['Dark']), 'field_promo_box_dark');
});
