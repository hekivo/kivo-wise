#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/board.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOptions, runCli } from './lib/args.mjs';
import { latestRun, readDoc, runDir, writeDoc } from './lib/state.mjs';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), 'board', 'template.html');

export function buildBoard({ run, inventory, templates, parity, features, maxUrls = 5000 }) {
  const all = inventory.items;
  const top = [...all].sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0)).slice(0, maxUrls);
  const keep = new Set(top.map((u) => u.path));
  for (const u of all) if (u.proposed === 'review') keep.add(u.path);
  const urls = all.filter((u) => keep.has(u.path)).map(({ path, type, clicks, proposed, reason, final, note }) => ({ path, type, clicks, proposed, reason, final, note }));
  const data = { run, generated: new Date().toISOString(), templates: templates?.items ?? [], urls, truncated: all.length - urls.length, parity: parity?.items ?? [], features: features?.items ?? [] };
  // "<" is escaped so data can never close the script element; the replacer
  // function keeps "$&" and "$'" inside the data from being read as patterns.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return readFileSync(TEMPLATE, 'utf8').replace('/*__DATA__*/null', () => json);
}

export function normalizeMarks(input) {
  if (input.marks) return input.marks;
  const out = { urls: {}, templates: {}, parity: {} };
  for (const d of input.decisions ?? []) { const { path, ...m } = d; out.urls[path] = m; }
  for (const d of input.templates ?? []) { const { group, ...m } = d; out.templates[group] = m; }
  for (const d of input.parity ?? []) { const { feature, ...m } = d; out.parity[feature] = m; }
  return out;
}

export function applyMarks({ inventory, templates, parity }, marks) {
  let changed = 0;
  const conflicts = [];
  const inv = new Map(inventory.items.map((i) => [i.path, i]));
  for (const [path, m] of Object.entries(marks.urls ?? {})) {
    const row = inv.get(path);
    if (!row) continue;
    // A change or a clear of someone else's decision is a conflict, never a silent overwrite.
    const touchesFinal = m.final !== undefined && (m.final || null) !== (row.final ?? null);
    if (touchesFinal && row.final && row.decided_by && row.decided_by !== m.decided_by) { conflicts.push(`conflict ${path}: ${row.final} by ${row.decided_by} vs ${m.final || 'cleared'} by ${m.decided_by ?? '?'}`); continue; }
    const before = JSON.stringify(row);
    if (m.final !== undefined) row.final = m.final || null;
    if (m.note) row.note = m.note;
    if (m.final && m.decided_by) row.decided_by = m.decided_by;
    if (m.final !== undefined && !m.final) delete row.decided_by;
    if (JSON.stringify(row) !== before) changed++;
  }
  const tpl = new Map((templates?.items ?? []).map((t) => [t.group, t]));
  for (const [group, m] of Object.entries(marks.templates ?? {})) {
    const t = tpl.get(group);
    if (!t) continue;
    const before = JSON.stringify(t);
    if (m.status) t.status = m.status;
    if (m.note) t.note = m.note;
    if (JSON.stringify(t) !== before) changed++;
  }
  const par = new Map((parity?.items ?? []).map((p) => [p.feature, p]));
  for (const [feature, m] of Object.entries(marks.parity ?? {})) {
    const p = par.get(feature);
    if (p && m.note && p.note !== m.note) { p.note = m.note; changed++; }
  }
  return { changed, conflicts };
}

const strip = ({ schema_version, kind, run_id, generated_at, ...body }) => body;

export function main(argv) {
  const [cmd, ...rest] = argv;
  if (!['build', 'import'].includes(cmd)) throw new Error('usage: board.mjs build|import --project=. [--run=id] [--file=marks.json] [--max-urls=5000]');
  const o = parseOptions(rest, { project: '.', run: '', file: '', 'max-urls': '5000' });
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: run crawl-sitemap.mjs and build-inventory.mjs first');
  const dir = runDir(o.project, runId);
  const docs = { inventory: readDoc(join(dir, 'inventory.json')), templates: readDoc(join(dir, 'templates.json')), parity: readDoc(join(dir, 'parity.json')), features: readDoc(join(dir, 'features.json')) };
  if (!docs.inventory) throw new Error(`${join(dir, 'inventory.json')} not found: run build-inventory.mjs first`);
  if (cmd === 'build') {
    const maxUrls = Number(o['max-urls']);
    if (!Number.isInteger(maxUrls) || maxUrls < 1) throw new Error('--max-urls must be a positive integer');
    const html = buildBoard({ run: runId, ...docs, maxUrls });
    mkdirSync(join(dir, 'board'), { recursive: true });
    writeFileSync(join(dir, 'board', 'index.html'), html);
    console.log(join(dir, 'board', 'index.html'));
    return;
  }
  if (!o.file) throw new Error('--file=<marks.json | db-export.json> is required');
  const marks = normalizeMarks(JSON.parse(readFileSync(o.file, 'utf8')));
  const { changed, conflicts } = applyMarks(docs, marks);
  writeDoc(join(dir, 'inventory.json'), 'inventory', strip(docs.inventory), { runId });
  if (docs.templates) writeDoc(join(dir, 'templates.json'), 'templates', strip(docs.templates), { runId });
  if (docs.parity) writeDoc(join(dir, 'parity.json'), 'parity', strip(docs.parity), { runId });
  for (const c of conflicts) console.error(c);
  console.log(`${changed} changes, ${conflicts.length} conflicts`);
}

runCli(import.meta.url, main);
