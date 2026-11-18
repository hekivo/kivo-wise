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
