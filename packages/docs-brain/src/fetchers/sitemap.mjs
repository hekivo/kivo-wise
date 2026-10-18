// sitemap sources: (index ->) urlset, include/exclude on URLs, lastmod-based incremental fetch.
import { XMLParser } from 'fast-xml-parser';
import { isIncluded, urlToCorpusPath } from '../util.mjs';
import { fetchPage, pageRecordExtras } from './page.mjs';

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });
const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Collect { loc, lastmod } from a sitemap or sitemap index (bounded recursion). */
export async function collectSitemap(http, url, { children = [], depth = 0, notes = [] } = {}) {
  if (depth > 3) return [];
  const res = await http.get(url, { accept: 'application/xml, text/xml;q=0.9, */*;q=0.5' });
  if (res.status >= 400) {
    notes.push(`sitemap ${url}: HTTP ${res.status}`);
    return [];
  }
  let doc;
  try {
    doc = parser.parse(res.text);
  } catch (e) {
    notes.push(`sitemap ${url}: invalid XML (${e.message})`);
    return [];
  }
  if (doc.sitemapindex) {
    const out = [];
    for (const sm of list(doc.sitemapindex.sitemap)) {
      const loc = String(sm.loc ?? '');
      if (!loc) continue;
      if (children.length && !children.some((c) => loc.endsWith('/' + c) || loc.endsWith(c))) continue;
      out.push(...(await collectSitemap(http, loc, { children: [], depth: depth + 1, notes })));
    }
    return out;
  }
  return list(doc.urlset?.url)
    .map((u) => ({ loc: String(u.loc ?? ''), lastmod: u.lastmod ? String(u.lastmod) : null }))
    .filter((u) => u.loc);
}

async function listUrls(source, http, notes) {
  let urls = await collectSitemap(http, source.sitemap, { children: source.children, notes });
  urls = urls.filter((u) => isIncluded(u.loc, source.include, source.exclude));
  if (source.max_pages) urls = urls.slice(0, source.max_pages);
  return urls;
}

export async function fetchSource({ source, prev, ctx }) {
  const notes = [];
  const urls = await listUrls(source, ctx.http, notes);
  if (urls.length === 0) return { ok: false, notes: [...notes, `${source.id}: no URLs matched in ${source.sitemap}`] };
  const prevPages = prev?.pages ?? {};
  const pages = [];
  const current = new Set();
  let maxLastmod = null;
  for (const u of urls) {
    const path = urlToCorpusPath(u.loc);
    current.add(path);
    if (u.lastmod && (!maxLastmod || u.lastmod > maxLastmod)) maxLastmod = u.lastmod;
    const old = prevPages[path];
    if (old && !ctx.force && u.lastmod && old.lastmod === u.lastmod) continue;
    const r = await fetchPage(ctx.http, u.loc, { source, prev: old && !ctx.force ? old : null, query: source.fetch?.query });
    if (r.notModified) continue;
    if (!r.ok) {
      notes.push(`${source.id}: ${u.loc} HTTP ${r.status}`);
      continue;
    }
    if (r.note) notes.push(`${source.id}: ${u.loc}: ${r.note}`);
    pages.push({
      path,
      title: r.title,
      body: r.body,
      url: u.loc,
      upstream_modified: u.lastmod,
      markdown_negotiated: r.negotiated,
      extra: r.description ? { description: r.description } : {},
      lock: { ...pageRecordExtras(r), ...(u.lastmod ? { lastmod: u.lastmod } : {}) },
    });
  }
  const removed = Object.keys(prevPages).filter((p) => !current.has(p));
  return { ok: true, partial: true, removed, pages, upstream: { sitemap: source.sitemap, url_count: urls.length, max_lastmod: maxLastmod }, notes };
}

export async function checkUpstream({ source, entry, ctx }) {
  const notes = [];
  const urls = await listUrls(source, ctx.http, notes);
  const byUrl = new Map(Object.values(entry.pages ?? {}).map((p) => [p.url, p]));
  let changed = 0;
  let added = 0;
  for (const u of urls) {
    const p = byUrl.get(u.loc);
    if (!p) added++;
    else if (u.lastmod && p.lastmod !== u.lastmod) changed++;
  }
  const removed = Math.max(0, byUrl.size - (urls.length - added));
  const drift = changed + added + removed > 0;
  return { checked: urls.length > 0, drift, detail: drift ? `${added} new, ${changed} lastmod changed, ${removed} gone` : 'up to date', notes };
}
