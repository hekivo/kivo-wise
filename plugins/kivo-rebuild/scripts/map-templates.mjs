#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/map-templates.mjs
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { latestRun, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';

export const DEFAULT_GROUPS = [
  { group: 'home', label: 'Home', template: 'resources/views/front-page.blade.php', match: { regex: '^/$' } },
  { group: 'product', label: 'Product page', template: 'resources/views/woocommerce/single-product.blade.php', match: { type: 'product' } },
  { group: 'product-category', label: 'Product category', template: 'resources/views/woocommerce/archive-product.blade.php', match: { type: 'product_cat' } },
  { group: 'post', label: 'Blog post', template: 'resources/views/single.blade.php', match: { type: 'post' } },
  { group: 'tag', label: 'Blog tag', template: 'resources/views/index.blade.php', match: { type: 'post_tag' } },
  { group: 'page', label: 'Page', template: 'resources/views/page.blade.php', match: { type: 'page' } },
  { group: 'search-only', label: 'URLs only in search results', template: '-', match: { type: 'search' } },
];

const matches = (m, row) => (m.type === undefined || m.type === row.type)
  && (m.prefix === undefined || row.path.startsWith(m.prefix))
  && (m.regex === undefined || new RegExp(m.regex, 'u').test(row.path));

export function mapTemplates({ items, groups }) {
  if (groups.some((g) => g.group === 'unmapped')) throw new Error('template group name "unmapped" is reserved for the catch-all bucket');
  const buckets = new Map([...groups, { group: 'unmapped', label: 'Not mapped to a template', template: '-', match: {} }].map((g) => [g.group, { ...g, rows: [] }]));
  for (const row of items) {
    const g = groups.find((x) => matches(x.match ?? {}, row));
    buckets.get(g ? g.group : 'unmapped').rows.push(row);
  }
  return [...buckets.values()].filter((b) => b.rows.length).map((b) => {
    const ranked = b.rows.map((r, i) => ({ r, i })).filter(({ r }) => (r.clicks ?? 0) > 0).sort((a, z) => z.r.clicks - a.r.clicks || a.i - z.i).map(({ r }) => r.path);
    const samples = [...ranked];
    for (const r of b.rows) { if (samples.length >= 3) break; if (!samples.includes(r.path)) samples.push(r.path); }
    return { group: b.group, label: b.label, template: b.template, ...(b.blocks ? { blocks: b.blocks } : {}), count: b.rows.length, clicks: b.rows.reduce((s, r) => s + (r.clicks ?? 0), 0), samples: samples.slice(0, 3), status: 'todo' };
  });
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '' });
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: run crawl-sitemap.mjs and build-inventory.mjs first');
  const dir = runDir(o.project, runId);
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const inv = readDoc(join(dir, 'inventory.json'));
  if (!inv) throw new Error(`${join(dir, 'inventory.json')} not found: run build-inventory.mjs first`);
  const prev = readDoc(join(dir, 'templates.json'));
  const items = mapTemplates({ items: inv.items ?? [], groups: config.templates ?? DEFAULT_GROUPS });
  const old = new Map((prev?.items ?? []).map((t) => [t.group, t]));
  for (const t of items) if (old.has(t.group)) Object.assign(t, { status: old.get(t.group).status, ...(old.get(t.group).note ? { note: old.get(t.group).note } : {}) });
  writeDoc(join(dir, 'templates.json'), 'templates', { items }, { runId });
  for (const t of items) console.log(`${String(t.count).padStart(6)} ${t.group} -> ${t.template}`);
}

runCli(import.meta.url, main);
