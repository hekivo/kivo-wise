#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/gsc.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { accessToken } from './lib/credentials.mjs';
import { parseCsv } from './lib/csv.mjs';
import { normalizePath } from './lib/paths.mjs';
import { queryUrl } from './lib/providers/gsc.mjs';
import { latestRun, readDoc, rebuildDir, runDir } from './lib/state.mjs';
import { mergeSignals, period } from './lib/signals.mjs';

const HEAD = {
  path: ['top pages', 'páginas principais', 'page', 'página', 'pages', 'páginas'],
  clicks: ['clicks', 'cliques'],
  impressions: ['impressions', 'impressões'],
  ctr: ['ctr'],
  position: ['position', 'posição'],
};

/** Counts: "1,204" and "1.204" are both 1204. */
export function num(v) {
  let s = String(v ?? '').trim().replace('%', '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Ratios and positions: the separator is always a decimal point or comma, never thousands. */
function dec(v) {
  const n = Number(String(v ?? '').trim().replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function fromCsv(text, origin) {
  const [header = [], ...rows] = parseCsv(text);
  const idx = {};
  for (const [k, names] of Object.entries(HEAD)) idx[k] = header.findIndex((h) => names.includes(h.trim().toLowerCase()));
  if (idx.path < 0 || idx.clicks < 0) throw new Error(`unrecognised Search Console export header: ${header.join(', ')}`);
  const out = new Map();
  for (const r of rows) {
    if (!r[idx.path]) continue;
    out.set(normalizePath(r[idx.path], origin), {
      clicks: Math.round(num(r[idx.clicks])),
      impressions: Math.round(num(r[idx.impressions])),
      ctr: Math.round(dec(r[idx.ctr]) / 100 * 10000) / 10000,
      position: dec(r[idx.position]),
    });
  }
  return out;
}

export async function fromApi({ property, token, start, end, fetchImpl = fetch, origin = '' }) {
  const out = new Map();
  for (let startRow = 0; ; startRow += 25000) {
    const res = await fetchImpl(queryUrl(property), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['page'], rowLimit: 25000, startRow }),
    });
    if (!res.ok) throw new Error(`Search Console HTTP ${res.status}`);
    const rows = (await res.json()).rows ?? [];
    for (const r of rows) out.set(normalizePath(r.keys[0], origin), { clicks: r.clicks, impressions: r.impressions, ctr: Math.round(r.ctr * 10000) / 10000, position: Math.round(r.position * 10) / 10 });
    if (rows.length < 25000) break;
  }
  return out;
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', csv: '', months: '16', via: '' });
  if (o.via && !['mcp', 'csv'].includes(o.via)) throw new Error('--via=mcp|csv');
  if (o.via === 'mcp' && !o.csv) throw new Error('--via=mcp needs --csv=<rows written from the MCP results>');
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run found: crawl the sitemap first or pass --run=<id>');
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const { start, end } = period(Number(o.months));
  if (!o.csv && !config.gsc?.property) throw new Error('config.gsc.property missing: set it, or pass --csv=<Search Console export>');
  const data = o.csv
    ? fromCsv(readFileSync(o.csv, 'utf8'), config.live)
    : await fromApi({ property: config.gsc.property, token: accessToken(config.gsc.service_account), start, end, origin: config.live });
  mergeSignals(runDir(o.project, runId), runId, 'gsc', data, { period: `${start}..${end}`, path: o.via || (o.csv ? 'csv' : 'api'), rows: data.size });
  console.log(`gsc: ${data.size} pages (${start}..${end})`);
}

runCli(import.meta.url, main);
