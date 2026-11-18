#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/crawl-sitemap.mjs
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { fetchText } from './lib/http.mjs';
import { normalizePath } from './lib/paths.mjs';
import { ensureGitignore, newRunId, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';

const tagValues = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, 'g'))].map((m) => m[1].trim());

function stemType(sitemapName, types) {
  const stem = sitemapName.replace(/\.xml$/, '').replace(/-?sitemap\d*$/, '');
  return types?.[stem] ?? (stem || 'page');
}

export async function crawl({ origin, start, fetchImpl = fetch, types = {}, headers = {} }) {
  const seen = new Set();
  const urls = new Map();
  const failures = [];
  const queue = [start];
  while (queue.length) {
    const sm = queue.shift();
    if (seen.has(sm)) continue;
    seen.add(sm);
    const name = new URL(sm).pathname.split('/').pop();
    const r = await fetchText(sm, { fetchImpl, headers });
    if (r.status !== 200) { failures.push({ sitemap: name, error: r.error ?? `HTTP ${r.status}` }); continue; }
    if (!/<(urlset|sitemapindex)[\s>]/.test(r.text)) { failures.push({ sitemap: name, error: 'not a sitemap (no urlset/sitemapindex)' }); continue; }
    if (/<sitemapindex[\s>]/.test(r.text)) { queue.push(...tagValues(r.text, 'loc')); continue; }
    const type = stemType(name, types);
    for (const block of r.text.split(/<url>/).slice(1)) {
      const loc = tagValues(block, 'loc')[0];
      if (!loc) continue;
      const path = normalizePath(loc.replace(/&amp;/g, '&'), origin);
      const lastmod = (tagValues(block, 'lastmod')[0] ?? '').slice(0, 10) || null;
      if (!urls.has(path)) urls.set(path, { path, origin: 'sitemap', sitemap: name, type, lastmod });
    }
  }
  return { urls: [...urls.values()], failures };
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', live: '', sitemap: '', run: '' });
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const live = (o.live || config.live || '').replace(/\/$/, '');
  if (!live) throw new Error('--live=<url> or config.live is required');
  const runId = o.run || newRunId(config.slug || new URL(live).hostname);
  ensureGitignore(o.project);
  const { urls, failures } = await crawl({ origin: live, start: o.sitemap || `${live}/sitemap_index.xml`, types: config.types });
  writeDoc(join(runDir(o.project, runId), 'urls.json'), 'urls', { items: urls, failures }, { runId });
  console.log(`${urls.length} urls, ${failures.length} failed sitemaps (run ${runId})`);
  for (const f of failures) console.error(`failed ${f.sitemap}: ${f.error}`);
}

runCli(import.meta.url, main);
