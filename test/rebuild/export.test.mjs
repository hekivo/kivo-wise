// test/rebuild/export.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventoryCsv, redirectsCsv, parityMarkdown, main } from '../../plugins/kivo-rebuild/scripts/export.mjs';

const items = [
  { path: '/a/', type: 'page', origin: 'sitemap', proposed: 'redirect', target: '/b/', reason: 'r', rule_id: 'R15', staging: { status: 301, location: '/b/' } },
  { path: '/c/', type: 'page', origin: 'both', proposed: 'review', reason: 'r', rule_id: 'R99', final: 'redirect', target: '/d/', decided_by: 'owner', clicks: 4 },
];

test('redirects export only decided redirects', () => {
  assert.equal(redirectsCsv(items), 'source,target,approved\n/c/,/d/,owner\n');
});

test('inventory csv flattens http fields', () => {
  const lines = inventoryCsv(items).trim().split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^page,\/a\/,sitemap,,,301,\/b\//);
});

test('parity markdown sorts by priority', () => {
  const md = parityMarkdown({ date: '2026-01-01', features: [{ id: 'F-a', area: 'x', name: 'A' }, { id: 'F-b', area: 'y', name: 'B' }], parity: [{ feature: 'F-a', class: 'done', priority: 'P2' }, { feature: 'F-b', class: 'missing-not-planned', priority: 'P0' }] });
  assert.ok(md.indexOf('| B |') < md.indexOf('| A |'));
  assert.match(md, /\| missing-not-planned \| 1 \|/);
});

test('cli refuses --out inside .rebuild and writes elsewhere', () => {
  const project = mkdtempSync(join(tmpdir(), 'rebuild-export-'));
  const runId = '2026-01-01-acme';
  const dir = join(project, '.rebuild', 'runs', runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'inventory.json'), JSON.stringify({ items }));
  const base = [`--project=${project}`, `--run=${runId}`, '--what=redirects'];
  assert.throws(() => main([...base, `--out=${join(project, '.rebuild', 'out.csv')}`]), /outside \.rebuild/);
  const out = join(project, 'exports', 'redirects.csv');
  const log = console.log;
  console.log = () => {};
  try { main([...base, `--out=${out}`]); } finally { console.log = log; }
  assert.equal(readFileSync(out, 'utf8'), 'source,target,approved\n/c/,/d/,owner\n');
});

test('cli reports a missing run clearly', () => {
  const project = mkdtempSync(join(tmpdir(), 'rebuild-export-'));
  assert.throws(() => main([`--project=${project}`, '--what=inventory', `--out=${join(project, 'x.csv')}`]), /no run found/);
});

test('inventory csv neutralises formulas in scraped text columns', () => {
  const csv = inventoryCsv([{ path: '/a/', type: 'page', origin: 'sitemap', title: '=HYPERLINK("x")', h1: '+1 deal', reason: 'ok', proposed: 'keep' }]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+1 deal/);
  assert.match(csv, /,\/a\/,/);
});
