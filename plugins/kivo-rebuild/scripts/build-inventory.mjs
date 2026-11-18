#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/build-inventory.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Counter } from './lib/counter.mjs';
import { parseOptions, runCli } from './lib/args.mjs';
import { parseCsv } from './lib/csv.mjs';
import { normalizePath } from './lib/paths.mjs';
import { propose } from './lib/rules.mjs';
import { latestRun, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';

const CARRY = ['final', 'decided_by', 'note', 'issue'];
const REDIRECT_COLUMNS = ['source', 'target', 'approved'];

/** Approved rows only. A missing column is an error: skipping it silently would drop every redirect. */
function redirectsFrom(csvText, origin) {
  const map = new Map();
  if (!csvText) return map;
  const [head = [], ...rows] = parseCsv(csvText);
  const names = head.map((h) => h.trim().toLowerCase());
  const i = Object.fromEntries(REDIRECT_COLUMNS.map((k) => [k, names.indexOf(k)]));
  if (Object.values(i).some((n) => n < 0)) throw new Error(`redirects csv needs the columns ${REDIRECT_COLUMNS.join(', ')}; found: ${head.join(', ')}`);
  for (const r of rows) {
    if (!r[i.source] || !r[i.target] || !r[i.approved]?.trim()) continue;
    map.set(normalizePath(r[i.source], origin), normalizePath(r[i.target], origin));
  }
  return map;
}

export function buildInventory({ urls, signals, config, redirectsCsv, previous }) {
  const rules = config.rules ?? {};
  const sig = new Map((signals?.items ?? []).map((s) => [s.path, s]));
  const prev = new Map((previous?.items ?? []).map((p) => [p.path, p]));
  const ctx = {
    redirects: redirectsFrom(redirectsCsv, config.live),
    importDate: config.import_date ?? null,
    junkPrefixes: rules.junk_prefixes ?? [],
    tagTypes: rules.tag_types ?? ['post_tag'],
    fileExt: rules.file_ext ?? ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip'],
    hasSignals: Boolean(signals?.sources?.gsc),
    hasStaging: Boolean(config.staging),
    origins: [config.live, config.staging],
    disabled: new Set(rules.disable ?? []),
  };
  const rows = urls.items.map((u) => ({ ...u }));
  const seen = new Set(rows.map((r) => r.path));
  for (const s of sig.values()) {
    if (!seen.has(s.path) && (s.clicks ?? 0) > 0) rows.push({ path: s.path, origin: 'search', type: 'search', lastmod: null, live: null, staging: null });
  }
  return rows.map((r) => {
    const s = sig.get(r.path);
    if (s && r.origin === 'sitemap') r.origin = 'both';
    const row = {
      ...r,
      clicks: s?.clicks ?? (ctx.hasSignals ? 0 : null),
      impressions: s?.impressions ?? (ctx.hasSignals ? 0 : null),
      position: s?.position ?? null,
      sessions: s?.sessions ?? null,
    };
    const p = propose(row, ctx);
    const old = prev.get(r.path) ?? {};
    const carried = Object.fromEntries(CARRY.filter((k) => old[k] !== undefined && old[k] !== null).map((k) => [k, old[k]]));
    return { ...row, ...p, ...(old.target && old.final ? { target: old.target } : {}), ...carried };
  });
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '' });
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: run crawl-sitemap.mjs first');
  const dir = runDir(o.project, runId);
  const urls = readDoc(join(dir, 'urls.json'));
  if (!urls) throw new Error(`${join(dir, 'urls.json')} not found: run crawl-sitemap.mjs first`);
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const csvPath = config.redirects_csv ? resolve(o.project, config.redirects_csv) : '';
  const items = buildInventory({
    urls,
    signals: readDoc(join(dir, 'signals.json')),
    config,
    redirectsCsv: csvPath && existsSync(csvPath) ? readFileSync(csvPath, 'utf8') : '',
    previous: readDoc(join(dir, 'inventory.json')),
  });
  writeDoc(join(dir, 'inventory.json'), 'inventory', { items }, { runId });
  const c = new Counter();
  for (const i of items) c.add(`${i.type}\t${i.proposed}`);
  console.log(`${items.length} rows`);
  for (const [k, n] of c.sorted()) console.log(`${String(n).padStart(6)} ${k}`);
}

runCli(import.meta.url, main);
