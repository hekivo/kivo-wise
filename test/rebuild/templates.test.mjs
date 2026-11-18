import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapTemplates, DEFAULT_GROUPS } from '../../plugins/kivo-rebuild/scripts/map-templates.mjs';
import { readJson, run, tmpProject } from './helpers.mjs';

test('groups by first matching rule with click-ranked samples', () => {
  const items = [
    { path: '/', type: 'page', clicks: 100 },
    { path: '/product/a/', type: 'product', clicks: 1 },
    { path: '/product/b/', type: 'product', clicks: 9 },
    { path: '/product/c/', type: 'product', clicks: null },
    { path: '/product/d/', type: 'product', clicks: 0 },
    { path: '/about/', type: 'page', clicks: 3 },
    { path: '/weird/', type: 'landing', clicks: 0 },
  ];
  const groups = mapTemplates({ items, groups: DEFAULT_GROUPS });
  const by = Object.fromEntries(groups.map((g) => [g.group, g]));
  assert.equal(by.home.count, 1);
  assert.equal(by.page.count, 1);
  assert.equal(by.product.count, 4);
  assert.equal(by.product.clicks, 10);
  assert.deepEqual(by.product.samples, ['/product/b/', '/product/a/', '/product/c/']);
  assert.equal(by.unmapped.count, 1);
  assert.equal(by.post, undefined);
  assert.equal(by.product.status, 'todo');
});

test('prefix and regex conditions must all hold, and the first matching group wins', () => {
  const groups = [
    { group: 'docs', label: 'Docs', template: 'docs.blade.php', match: { type: 'page', prefix: '/docs/' } },
    { group: 'page', label: 'Page', template: 'page.blade.php', match: { type: 'page' } },
    { group: 'numbered', label: 'Numbered', template: 'n.blade.php', match: { regex: '^/n\\d+/$' } },
  ];
  const items = [
    { path: '/docs/a/', type: 'page', clicks: 0 },
    { path: '/docs/b/', type: 'post', clicks: 0 },
    { path: '/about/', type: 'page', clicks: 0 },
    { path: '/n42/', type: 'post', clicks: 0 },
  ];
  const by = Object.fromEntries(mapTemplates({ items, groups }).map((g) => [g.group, g]));
  assert.equal(by.docs.count, 1);
  assert.equal(by.page.count, 1);
  assert.equal(by.numbered.count, 1);
  assert.equal(by.unmapped.count, 1);
  assert.deepEqual(by.unmapped.samples, ['/docs/b/']);
});

test('a group with a blocks list keeps it and an empty input gives no groups', () => {
  const groups = [{ group: 'page', label: 'Page', template: 'page.blade.php', blocks: ['hero'], match: { type: 'page' } }];
  const [g] = mapTemplates({ items: [{ path: '/a/', type: 'page', clicks: 2 }], groups });
  assert.deepEqual(g.blocks, ['hero']);
  assert.deepEqual(mapTemplates({ items: [], groups }), []);
});

function seed(project, runId, { config, items }) {
  const rd = join(project, '.rebuild', 'runs', runId);
  mkdirSync(rd, { recursive: true });
  if (config) writeFileSync(join(project, '.rebuild', 'config.json'), JSON.stringify({ schema_version: 1, kind: 'config', ...config }));
  writeFileSync(join(rd, 'inventory.json'), JSON.stringify({ schema_version: 1, kind: 'inventory', run_id: runId, generated_at: 't', items }));
  return rd;
}

const row = (path, type, clicks) => ({ path, type, clicks, proposed: 'keep', reason: 'test', rule_id: 'R01' });

test('cli writes a schema-valid templates.json, prints counts and keeps reviewed status on a rerun', () => {
  const project = tmpProject();
  const runId = '2026-11-18-acme';
  const rd = seed(project, runId, { items: [row('/', 'page', 5), row('/shop/a/', 'product', 7), row('/shop/b/', 'product', 1)] });
  const first = run('map-templates.mjs', [`--project=${project}`]);
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /2 product ->/);
  const doc = readJson(join(rd, 'templates.json'));
  assert.equal(doc.run_id, runId);
  assert.deepEqual(doc.items.map((t) => t.group), ['home', 'product']);

  doc.items.find((t) => t.group === 'product').status = 'ok';
  doc.items.find((t) => t.group === 'product').note = 'checked with the owner';
  writeFileSync(join(rd, 'templates.json'), JSON.stringify(doc));
  const second = run('map-templates.mjs', [`--project=${project}`, `--run=${runId}`]);
  assert.equal(second.code, 0, second.stderr);
  const product = readJson(join(rd, 'templates.json')).items.find((t) => t.group === 'product');
  assert.equal(product.status, 'ok');
  assert.equal(product.note, 'checked with the owner');
});

test('cli uses config.templates instead of the defaults when present', () => {
  const project = tmpProject();
  const rd = seed(project, '2026-11-18-acme', {
    config: { templates: [{ group: 'shop', label: 'Shop', template: 'shop.blade.php', blocks: ['product-grid'], match: { prefix: '/shop/' } }] },
    items: [row('/shop/a/', 'product', 1), row('/about/', 'page', 1)],
  });
  const r = run('map-templates.mjs', [`--project=${project}`]);
  assert.equal(r.code, 0, r.stderr);
  const items = readJson(join(rd, 'templates.json')).items;
  assert.deepEqual(items.map((t) => t.group), ['shop', 'unmapped']);
  assert.deepEqual(items[0].blocks, ['product-grid']);
  const v = run('validate.mjs', [`--project=${project}`]);
  assert.equal(v.code, 0, v.stderr);
});

test('cli fails clearly without a run or without an inventory', () => {
  const none = run('map-templates.mjs', [`--project=${tmpProject()}`]);
  assert.notEqual(none.code, 0);
  assert.match(none.stderr, /no run/);

  const project = tmpProject();
  mkdirSync(join(project, '.rebuild', 'runs', '2026-11-18-acme'), { recursive: true });
  const missing = run('map-templates.mjs', [`--project=${project}`]);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /inventory\.json not found/);
});

test('a config group named unmapped is rejected', () => {
  assert.throws(() => mapTemplates({ items: [], groups: [{ group: 'unmapped', label: 'x', template: 'x', match: {} }] }), /reserved/);
});
