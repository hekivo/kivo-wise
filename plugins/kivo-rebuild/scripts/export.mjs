#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/export.mjs
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { Counter } from './lib/counter.mjs';
import { toCsv } from './lib/csv.mjs';
import { latestRun, readDoc, rebuildDir, runDir } from './lib/state.mjs';

const COLS = ['type', 'path', 'origin', 'lastmod', 'live_status', 'staging_status', 'staging_location', 'title', 'h1', 'canonical', 'robots', 'clicks', 'impressions', 'position', 'sessions', 'proposed', 'reason', 'rule_id', 'final', 'target', 'decided_by', 'note', 'issue'];

// Text scraped from the live site must not run as a spreadsheet formula when the CSV is opened.
const TEXT_COLS = ['title', 'h1', 'canonical', 'robots', 'reason', 'note'];
const inert = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export function inventoryCsv(items) {
  return toCsv(items.map((i) => {
    const row = { ...i, live_status: i.live?.status, staging_status: i.staging?.status, staging_location: i.staging?.location };
    for (const k of TEXT_COLS) row[k] = inert(row[k]);
    return row;
  }), COLS);
}

// Only decisions a person made are exported; proposals are not redirects yet.
export function redirectsCsv(items) {
  return toCsv(items.filter((i) => i.final === 'redirect' && i.target).map((i) => ({ source: i.path, target: i.target, approved: i.decided_by ?? '' })), ['source', 'target', 'approved']);
}

const P = ['P0', 'P1', 'P2', 'P3'];
const C = ['missing-not-planned', 'missing-planned', 'data-only', 'partial', 'done', 'dropped'];
const md = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function parityMarkdown({ features, parity, date }) {
  const f = new Map(features.map((x) => [x.id, x]));
  const counts = new Counter();
  for (const p of parity) counts.add(p.class);
  const rows = [...parity].sort((a, b) => P.indexOf(a.priority) - P.indexOf(b.priority) || C.indexOf(a.class) - C.indexOf(b.class));
  return [`# Parity audit — ${date}`, '', '| Class | Count |', '|---|---|', ...C.filter((c) => counts.get(c)).map((c) => `| ${c} | ${counts.get(c)} |`), '',
    '| Feature | Area | Class | Priority | Where | Owner | Note |', '|---|---|---|---|---|---|---|',
    ...rows.map((p) => `| ${md(f.get(p.feature)?.name ?? p.feature)} | ${md(f.get(p.feature)?.area)} | ${p.class} | ${p.priority} | ${md(p.location)} | ${md(p.owner)} | ${md(p.note)} |`), ''].join('\n');
}

function insideRebuild(project, out) {
  const rel = relative(rebuildDir(project), out);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function load(dir, name) {
  const file = join(dir, `${name}.json`);
  if (!existsSync(file)) throw new Error(`${file} not found; run the earlier steps for this run first`);
  return readDoc(file);
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', what: '', out: '' });
  if (!['inventory', 'redirects', 'parity'].includes(o.what)) throw new Error('--what=inventory|redirects|parity');
  if (!o.out) throw new Error('--out=<path> is required');
  const out = resolve(o.out);
  if (insideRebuild(o.project, out)) throw new Error('--out must be outside .rebuild/');
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error(`no run found under ${rebuildDir(o.project)}; pass --run=<id>`);
  const dir = runDir(o.project, runId);
  let text;
  if (o.what === 'inventory') text = inventoryCsv(load(dir, 'inventory').items);
  else if (o.what === 'redirects') text = redirectsCsv(load(dir, 'inventory').items);
  else text = parityMarkdown({ features: load(dir, 'features').items, parity: load(dir, 'parity').items, date: runId.slice(0, 10) });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(out);
}

runCli(import.meta.url, main);
