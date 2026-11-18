#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/check-http.mjs
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { resolveHeaders } from './lib/credentials.mjs';
import { fetchText, pool } from './lib/http.mjs';
import { joinUrl } from './lib/paths.mjs';
import { latestRun, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';

const GATE_WINDOW = 50;
const clean = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);

export function parseHead(html) {
  const pick = (re) => clean(html.match(re)?.[1]);
  return {
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    h1: pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i),
    canonical: pick(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i),
    robots: pick(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)/i),
  };
}

// A login redirect often carries the requested path in its query string, so
// compare redirect targets without query or fragment.
const redirectTarget = (location) => String(location ?? '').split(/[?#]/)[0];

export function detectGate(results) {
  const first = [...results.values()].slice(0, GATE_WINDOW);
  if (first.length < GATE_WINDOW) return null;
  const keys = first.map((r) => ([401, 403, 530].includes(r.status)
    ? `answered ${r.status}`
    : r.status >= 300 && r.status < 400 ? `answered redirect to ${redirectTarget(r.location)}` : 'ok'));
  const counts = keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map());
  for (const [k, n] of counts) if (k !== 'ok' && n / first.length >= 0.8) return `access gate: ${n} of ${first.length} ${k}`;
  return null;
}

export async function checkAll({ origin, paths, headers = {}, fetchImpl = fetch, done = new Set(), concurrency = 4, maxErrorRate = 0.1, onRow = () => {} }) {
  const results = new Map();
  let aborted = null;
  let errors = 0;
  // Rows are held until the gate window has been judged, so answers from a
  // gate never reach the caller's stream and a resumed run checks them again.
  let held = [];
  let windowPassed = false;
  const todo = paths.filter((p) => !done.has(p));
  await pool(todo, async (path) => {
    const r = await fetchText(joinUrl(origin, path), { headers, fetchImpl, redirect: 'manual' });
    return { path, status: r.status, location: r.location, ms: r.ms, ...(r.status === 200 ? parseHead(r.text) : {}), ...(r.error ? { error: r.error } : {}) };
  }, {
    concurrency,
    shouldStop: () => aborted !== null,
    onResult: (path, row) => {
      if (aborted) return;
      const { path: _path, ...rest } = row;
      results.set(path, rest);
      if (windowPassed) onRow(path, rest);
      else held.push([path, rest]);
      if (rest.status === 0 || rest.status >= 500) errors++;
      if (results.size === GATE_WINDOW) {
        aborted = detectGate(results);
        if (!aborted) { windowPassed = true; for (const [p, r] of held) onRow(p, r); held = []; }
      }
      if (!aborted && results.size >= GATE_WINDOW && errors / results.size > maxErrorRate) {
        aborted = `error rate ${(errors / results.size * 100).toFixed(0)}% above ${maxErrorRate * 100}%`;
      }
    },
  });
  if (!aborted && !windowPassed) for (const [p, r] of held) onRow(p, r);
  return { results, aborted };
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', target: 'live', concurrency: '4', limit: '0' });
  if (!['live', 'staging'].includes(o.target)) throw new Error('--target must be live or staging');
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: run crawl-sitemap.mjs first');
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const origin = (o.target === 'staging' ? config.staging : config.live)?.replace(/\/$/, '');
  if (!origin) throw new Error(`config.${o.target} is not set`);
  const headers = o.target === 'staging' ? resolveHeaders(config.staging_access?.headers_ref) : {};
  const urlsFile = join(runDir(o.project, runId), 'urls.json');
  const urls = readDoc(urlsFile);
  if (!urls) throw new Error(`${urlsFile} not found: run crawl-sitemap.mjs first`);
  const stream = join(runDir(o.project, runId), `http-${o.target}.jsonl`);
  const prior = new Map();
  if (existsSync(stream)) for (const line of readFileSync(stream, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(line); prior.set(r.path, r); }
  const done = new Set([...prior.values()].filter((r) => !r.error && r.status !== 0 && r.status < 500 && r.status !== 429).map((r) => r.path));
  let paths = urls.items.map((u) => u.path).filter((p) => p.startsWith('/'));
  if (Number(o.limit)) paths = paths.slice(0, Number(o.limit));
  const { aborted } = await checkAll({
    origin,
    paths,
    headers,
    done,
    concurrency: Number(o.concurrency),
    onRow: (path, row) => { appendFileSync(stream, JSON.stringify({ path, ...row }) + '\n'); prior.set(path, { path, ...row }); },
  });
  for (const u of urls.items) {
    const r = prior.get(u.path);
    if (!r) continue;
    u[o.target] = { status: r.status, location: r.location ?? '', ms: r.ms ?? 0, ...(r.error ? { error: r.error } : {}) };
    for (const k of ['title', 'h1', 'canonical', 'robots']) if (r[k] && (o.target === 'staging' || !u[k])) u[k] = r[k];
  }
  const { schema_version: _v, kind: _k, run_id: _r, generated_at: _g, ...body } = urls;
  writeDoc(urlsFile, 'urls', body, { runId });
  console.log(`${o.target}: ${prior.size}/${paths.length} checked`);
  if (aborted) { console.error(`stopped: ${aborted}`); process.exitCode = 2; }
}

runCli(import.meta.url, main);
