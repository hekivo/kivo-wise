import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAll, parseHead } from '../../plugins/kivo-rebuild/scripts/check-http.mjs';

const page = (t) => `<html><head><title>${t}</title><link rel="canonical" href="https://x.test/a/"><meta name="robots" content="noindex"></head><body><h1> ${t} </h1></body></html>`;

test('parseHead', () => {
  assert.deepEqual(parseHead(page('Hi')), { title: 'Hi', h1: 'Hi', canonical: 'https://x.test/a/', robots: 'noindex' });
});

test('records status, location and head; skips done paths', async () => {
  const fetchImpl = async (url) => url.endsWith('/old/')
    ? new Response('', { status: 301, headers: { location: '/new/' } })
    : new Response(page('P'), { status: 200 });
  const { results, aborted } = await checkAll({ origin: 'https://s.test', paths: ['/a/', '/old/', '/done/'], done: new Set(['/done/']), fetchImpl });
  assert.equal(aborted, null);
  assert.equal(results.get('/a/').status, 200);
  assert.equal(results.get('/a/').title, 'P');
  assert.equal(results.get('/old/').location, '/new/');
  assert.equal(results.has('/done/'), false);
});

test('detects an access gate and aborts', async () => {
  const paths = Array.from({ length: 80 }, (_, i) => `/p${i}/`);
  const fetchImpl = async () => new Response('', { status: 302, headers: { location: 'https://login.example.test/' } });
  const { aborted } = await checkAll({ origin: 'https://s.test', paths, fetchImpl, concurrency: 4 });
  assert.match(aborted, /access gate: \d+ of 50 answered redirect to https:\/\/login\.example\.test\//);
});

test('detects a gate whose login redirect carries the requested path in the query', async () => {
  const paths = Array.from({ length: 80 }, (_, i) => `/p${i}/`);
  const fetchImpl = async (url) => new Response('', { status: 302, headers: { location: `https://login.example.test/login?redirect_url=${new URL(url).pathname}` } });
  const { aborted } = await checkAll({ origin: 'https://s.test', paths, fetchImpl, concurrency: 4 });
  assert.match(aborted, /access gate: \d+ of 50 answered redirect to https:\/\/login\.example\.test\/login/);
});

test('detects a 403 gate', async () => {
  const paths = Array.from({ length: 80 }, (_, i) => `/p${i}/`);
  const fetchImpl = async () => new Response('', { status: 403 });
  const { aborted } = await checkAll({ origin: 'https://s.test', paths, fetchImpl, concurrency: 4 });
  assert.match(aborted, /access gate: \d+ of 50 answered 403/);
});

test('does not hand gate answers to onRow, so a resumed run rechecks them', async () => {
  const paths = Array.from({ length: 80 }, (_, i) => `/p${i}/`);
  const fetchImpl = async () => new Response('', { status: 302, headers: { location: 'https://login.example.test/' } });
  const rows = [];
  const { aborted } = await checkAll({ origin: 'https://s.test', paths, fetchImpl, concurrency: 4, onRow: (p) => rows.push(p) });
  assert.ok(aborted);
  assert.equal(rows.length, 0);
});

test('hands every row to onRow when the run is under the gate window', async () => {
  const fetchImpl = async () => new Response(page('P'), { status: 200 });
  const rows = [];
  await checkAll({ origin: 'https://s.test', paths: ['/a/', '/b/'], fetchImpl, onRow: (p) => rows.push(p) });
  assert.deepEqual(rows.sort(), ['/a/', '/b/']);
});

test('does not mistake a normal site for a gate', async () => {
  const paths = Array.from({ length: 80 }, (_, i) => `/p${i}/`);
  const fetchImpl = async () => new Response(page('P'), { status: 200 });
  const { aborted, results } = await checkAll({ origin: 'https://s.test', paths, fetchImpl, concurrency: 4 });
  assert.equal(aborted, null);
  assert.equal(results.size, 80);
});

test('stops when the error rate passes the limit', async () => {
  const paths = Array.from({ length: 200 }, (_, i) => `/p${i}/`);
  let n = 0;
  const fetchImpl = async () => (n++ % 2 ? new Response(page('x'), { status: 200 }) : new Response('', { status: 503 }));
  const { results, aborted } = await checkAll({ origin: 'https://s.test', paths, fetchImpl, concurrency: 2 });
  assert.match(aborted, /error rate/);
  assert.ok(results.size < 200);
});

test('cli also checks search-only paths with clicks once signals.json exists', async () => {
  const { createServer } = await import('node:http');
  const { spawn } = await import('node:child_process');
  const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { PLUGIN, tmpProject } = await import('./helpers.mjs');
  const hits = [];
  const server = createServer((req, res) => { hits.push(req.url); if (req.url === '/old-file.pdf') { res.writeHead(301, { location: '/files/new.pdf' }); res.end(); } else { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<title>T</title>'); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const project = tmpProject();
  const rd = join(project, '.rebuild', 'runs', '2026-01-02-acme');
  mkdirSync(rd, { recursive: true });
  writeFileSync(join(project, '.rebuild', 'config.json'), JSON.stringify({ schema_version: 1, kind: 'config', live: origin }));
  writeFileSync(join(rd, 'urls.json'), JSON.stringify({ schema_version: 1, kind: 'urls', run_id: '2026-01-02-acme', generated_at: '', items: [{ path: '/', origin: 'sitemap', type: 'page', lastmod: null }] }));
  writeFileSync(join(rd, 'signals.json'), JSON.stringify({ schema_version: 1, kind: 'signals', run_id: '2026-01-02-acme', generated_at: '', sources: {}, items: [{ path: '/old-file.pdf', clicks: 3 }, { path: '/no-clicks/', clicks: 0 }, { path: '/', clicks: 9 }] }));
  const code = await new Promise((r) => spawn(process.execPath, [join(PLUGIN, 'scripts', 'check-http.mjs'), `--project=${project}`, '--target=live'], { stdio: 'ignore' }).on('exit', r));
  server.close();
  assert.equal(code, 0);
  assert.deepEqual(hits.sort(), ['/', '/old-file.pdf']);
  const items = JSON.parse(readFileSync(join(rd, 'urls.json'), 'utf8')).items;
  const pdf = items.find((i) => i.path === '/old-file.pdf');
  assert.equal(pdf.origin, 'search');
  assert.deepEqual(pdf.live, { status: 301, location: '/files/new.pdf', ms: pdf.live.ms });
});
