// test/rebuild/signals.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIX, readJson, run, tmpProject } from './helpers.mjs';
import { parseCsv, toCsv } from '../../plugins/kivo-rebuild/scripts/lib/csv.mjs';
import { mergeSignals } from '../../plugins/kivo-rebuild/scripts/lib/signals.mjs';
import { fromCsv, fromApi } from '../../plugins/kivo-rebuild/scripts/gsc.mjs';
import { fromApi as ga4FromApi } from '../../plugins/kivo-rebuild/scripts/ga4.mjs';

const O = 'https://www.example.test';

test('csv round trip with quotes', () => {
  assert.deepEqual(parseCsv('a,"b ""x"", y"\r\n1,2\n'), [['a', 'b "x", y'], ['1', '2']]);
  assert.equal(toCsv([{ a: 'x,y', b: 1 }], ['a', 'b']), 'a,b\n"x,y",1\n');
});

test('english and portuguese exports give the same numbers', () => {
  const en = fromCsv(readFileSync(join(FIX, 'gsc', 'pages-en.csv'), 'utf8'), O);
  const pt = fromCsv(readFileSync(join(FIX, 'gsc', 'pages-pt.csv'), 'utf8'), O);
  assert.deepEqual([...readFileSync(join(FIX, 'gsc', 'pages-pt.csv')).subarray(0, 3)], [0xef, 0xbb, 0xbf], 'fixture keeps its BOM');
  assert.deepEqual(en.get('/'), { clicks: 1204, impressions: 40100, ctr: 0.03, position: 4.2 });
  assert.deepEqual(pt.get('/'), en.get('/'));
  assert.equal(en.get('/product/café/').clicks, 10);
});

test('an unknown header is refused with the header named', () => {
  assert.throws(() => fromCsv('Foo,Bar\n1,2\n', O), /unrecognised Search Console export header: Foo, Bar/);
});

test('api pages until a short page', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.startRow);
    const rows = body.startRow === 0 ? Array.from({ length: 25000 }, (_, i) => ({ keys: [`${O}/p${i}/`], clicks: 1, impressions: 2, ctr: 0.5, position: 3 })) : [{ keys: [`${O}/last/`], clicks: 0, impressions: 1, ctr: 0, position: 9 }];
    return new Response(JSON.stringify({ rows }), { status: 200 });
  };
  const m = await fromApi({ property: 'sc-domain:example.test', token: 't', start: '2025-01-01', end: '2026-01-01', fetchImpl, origin: O });
  assert.deepEqual(calls, [0, 25000]);
  assert.equal(m.size, 25001);
  assert.equal(m.get('/last/').impressions, 1);
});

test('ga4 pages and maps keyEvents to conversions', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ rowCount: 1, rows: [{ dimensionValues: [{ value: '/a' }], metricValues: [{ value: '10' }, { value: '2' }] }] }), { status: 200 });
  const m = await ga4FromApi({ propertyId: '1', token: 't', start: '2025-01-01', end: '2026-01-01', fetchImpl });
  assert.deepEqual(m.get('/a/'), { sessions: 10, conversions: 2 });
});

test('each source replaces only its own fields and sources entry', () => {
  const dir = join(tmpProject(), 'run');
  mkdirSync(dir, { recursive: true });
  mergeSignals(dir, 'r1', 'gsc', new Map([['/a/', { clicks: 5, impressions: 9, ctr: 0.5, position: 2 }], ['/b/', { clicks: 1, impressions: 1, ctr: 1, position: 1 }]]), { period: 'p', path: 'csv', rows: 2 });
  mergeSignals(dir, 'r1', 'ga4', new Map([['/a/', { sessions: 3, conversions: 1 }]]), { period: 'p', path: 'api', rows: 1 });
  mergeSignals(dir, 'r1', 'gsc', new Map([['/a/', { clicks: 7, impressions: 9, ctr: 0.7, position: 2 }]]), { period: 'q', path: 'mcp', rows: 1 });
  const doc = readJson(join(dir, 'signals.json'));
  assert.deepEqual(doc.items, [{ path: '/a/', sessions: 3, conversions: 1, clicks: 7, impressions: 9, ctr: 0.7, position: 2 }]);
  assert.equal(doc.sources.gsc.path, 'mcp');
  assert.equal(doc.sources.ga4.path, 'api');
});

test('gsc cli reads a csv export into signals.json', () => {
  const project = tmpProject();
  mkdirSync(join(project, '.rebuild'), { recursive: true });
  writeFileSync(join(project, '.rebuild', 'config.json'), JSON.stringify({ schema_version: 1, kind: 'config', live: O }));
  const r = run('gsc.mjs', [`--project=${project}`, '--run=2026-01-01-acme', `--csv=${join(FIX, 'gsc', 'pages-en.csv')}`]);
  assert.equal(r.code, 0, r.stderr);
  const doc = readJson(join(project, '.rebuild', 'runs', '2026-01-01-acme', 'signals.json'));
  assert.equal(doc.sources.gsc.path, 'csv');
  assert.equal(doc.items.find((i) => i.path === '/product/café/').clicks, 10);
});
