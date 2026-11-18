import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildInventory } from '../../plugins/kivo-rebuild/scripts/build-inventory.mjs';
import { readJson, run, tmpProject } from './helpers.mjs';

test('joins signals, adds search-only paths, keeps previous decisions', () => {
  const urls = { items: [{ path: '/', origin: 'sitemap', type: 'page', lastmod: null, live: { status: 200 }, staging: { status: 200 } }, { path: '/tag/a/', origin: 'sitemap', type: 'post_tag', lastmod: null, staging: { status: 404 } }] };
  const signals = { items: [{ path: '/', clicks: 5, impressions: 50 }, { path: '/gone-page/', clicks: 2, impressions: 9 }, { path: '/zero/', clicks: 0, impressions: 3 }], sources: { gsc: { period: 'p', path: 'csv', rows: 3 }, ga4: null } };
  const previous = { items: [{ path: '/tag/a/', type: 'post_tag', proposed: 'gone', reason: 'x', rule_id: 'R13', final: 'gone', decided_by: 'owner' }] };
  const items = buildInventory({ urls, signals, config: { staging: 'https://s.test', rules: { tag_types: ['post_tag'] } }, redirectsCsv: '', previous });
  const by = Object.fromEntries(items.map((i) => [i.path, i]));
  assert.equal(by['/'].clicks, 5);
  assert.equal(by['/gone-page/'].origin, 'search');
  assert.equal(by['/zero/'], undefined);
  assert.equal(by['/tag/a/'].final, 'gone');
  assert.equal(by['/tag/a/'].decided_by, 'owner');
  assert.equal(by['/tag/a/'].proposed, 'gone');
});

test('without signals tag rules propose review', () => {
  const urls = { items: [{ path: '/tag/a/', origin: 'sitemap', type: 'post_tag', lastmod: null, staging: { status: 404 } }] };
  const items = buildInventory({ urls, signals: null, config: { staging: 'https://s.test', rules: { tag_types: ['post_tag'] } }, redirectsCsv: '', previous: null });
  assert.equal(items[0].proposed, 'review');
  assert.equal(items[0].clicks, null);
});

test('only approved redirect rows apply, and paths are normalised', () => {
  const urls = { items: [{ path: '/old/', origin: 'sitemap', type: 'page', staging: { status: 200 } }, { path: '/café/', origin: 'sitemap', type: 'page', staging: { status: 200 } }, { path: '/b/', origin: 'sitemap', type: 'page', staging: { status: 200 } }] };
  const redirectsCsv = 'source,target,approved\nhttps://example.test/old,/new,yes\n/caf%C3%A9,/cafe/,x\n/b/,/c/,\n';
  const items = buildInventory({ urls, signals: null, config: { live: 'https://example.test', staging: 'https://s.test' }, redirectsCsv, previous: null });
  const by = Object.fromEntries(items.map((i) => [i.path, i]));
  assert.deepEqual([by['/old/'].proposed, by['/old/'].rule_id, by['/old/'].target], ['redirect', 'R01', '/new/']);
  assert.equal(by['/café/'].rule_id, 'R01');
  assert.equal(by['/b/'].rule_id, 'R14');
});

test('a redirects csv without the expected columns is an error', () => {
  const urls = { items: [{ path: '/a/', origin: 'sitemap', type: 'page', staging: { status: 200 } }] };
  assert.throws(() => buildInventory({ urls, signals: null, config: { staging: 'https://s.test' }, redirectsCsv: 'from,to\n/a/,/b/\n', previous: null }), /source, target, approved/);
});

test('a final decision keeps its own target over the proposed one', () => {
  const urls = { items: [{ path: '/a/', origin: 'sitemap', type: 'page', staging: { status: 301, location: '/auto/' } }] };
  const previous = { items: [{ path: '/a/', final: 'redirect', target: '/chosen/' }] };
  const [row] = buildInventory({ urls, signals: null, config: { staging: 'https://s.test' }, redirectsCsv: '', previous });
  assert.equal(row.target, '/chosen/');
  assert.equal(row.final, 'redirect');
});

test('cli writes a schema-valid inventory, prints counts and keeps decisions on a rerun', () => {
  const project = tmpProject();
  const runId = '2026-11-18-acme';
  const rd = join(project, '.rebuild', 'runs', runId);
  mkdirSync(rd, { recursive: true });
  writeFileSync(join(project, 'redirects.csv'), 'source,target,approved\n/old/,/new/,yes\n');
  writeFileSync(join(project, '.rebuild', 'config.json'), JSON.stringify({ schema_version: 1, kind: 'config', live: 'https://example.test', staging: 'https://staging.example.test', redirects_csv: 'redirects.csv' }));
  const urls = { schema_version: 1, kind: 'urls', run_id: runId, generated_at: 't', items: [
    { path: '/', origin: 'sitemap', type: 'page', staging: { status: 200, location: '', ms: 5 } },
    { path: '/old/', origin: 'sitemap', type: 'page', staging: { status: 404, location: '', ms: 5 } },
  ] };
  writeFileSync(join(rd, 'urls.json'), JSON.stringify(urls));
  const first = run('build-inventory.mjs', [`--project=${project}`]);
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /2 rows/);
  assert.match(first.stdout, /page\tkeep/);
  const inv = readJson(join(rd, 'inventory.json'));
  assert.equal(inv.run_id, runId);
  assert.equal(inv.items.find((i) => i.path === '/old/').proposed, 'redirect');
  const home = inv.items.find((i) => i.path === '/');
  home.final = 'keep';
  home.decided_by = 'owner';
  writeFileSync(join(rd, 'inventory.json'), JSON.stringify(inv));
  const second = run('build-inventory.mjs', [`--project=${project}`, `--run=${runId}`]);
  assert.equal(second.code, 0, second.stderr);
  assert.equal(readJson(join(rd, 'inventory.json')).items.find((i) => i.path === '/').decided_by, 'owner');
});

test('cli fails clearly without a run', () => {
  const r = run('build-inventory.mjs', [`--project=${tmpProject()}`]);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /no run/);
});
