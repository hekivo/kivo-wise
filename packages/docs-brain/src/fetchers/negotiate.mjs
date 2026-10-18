// negotiate sources: seed URLs fetched with Accept: text/markdown, optional link following.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conditionalHeaders, MARKDOWN_ACCEPT } from '../http.mjs';
import { globToRegExp, sha256, urlToCorpusPath } from '../util.mjs';
import { fetchPage, pageRecordExtras } from './page.mjs';

function linksIn(markdown, baseUrl, follow) {
  if (!follow) return [];
  const base = new URL(baseUrl);
  const re = /[*?]/.test(follow) ? globToRegExp(follow) : null;
  const out = [];
  for (const m of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
    let u;
    try {
      u = new URL(m[1], baseUrl);
    } catch {
      continue;
    }
    if (u.host !== base.host) continue;
    u.hash = '';
    const ok = re ? re.test(u.pathname) : u.pathname.includes(follow);
    if (ok) out.push(u.href);
  }
  return out;
}

export async function fetchSource({ source, prev, ctx }) {
  const notes = [];
  if (source.seeds.length === 0) return { ok: false, notes: [`${source.id}: negotiate source without seeds`] };
  const max = source.max_pages ?? 50;
  const prevPages = prev?.pages ?? {};
  const usable = Object.keys(prevPages).length > 0 && !ctx.force;
  const queue = [...source.seeds];
  const visited = new Set();
  const pages = [];
  const current = new Set();
  while (queue.length && visited.size < max) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    const path = urlToCorpusPath(url);
    current.add(path);
    const r = await fetchPage(ctx.http, url, { source, prev: usable ? prevPages[path] : null });
    let markdown = null;
    if (r.notModified) {
      const file = ctx.versionDir ? join(ctx.versionDir, path) : null;
      markdown = file && existsSync(file) ? readFileSync(file, 'utf8') : '';
    } else if (!r.ok) {
      notes.push(`${source.id}: ${url} HTTP ${r.status}`);
      continue;
    } else {
      markdown = r.body;
      pages.push({
        path,
        title: r.title,
        body: r.body,
        url,
        upstream_modified: r.last_modified ?? null,
        markdown_negotiated: r.negotiated,
        extra: r.description ? { description: r.description } : {},
        lock: pageRecordExtras(r),
      });
    }
    for (const next of linksIn(markdown, url, source.follow)) if (!visited.has(next)) queue.push(next);
  }
  if (queue.length && visited.size >= max) notes.push(`${source.id}: stopped at max_pages ${max}`);
  const removed = Object.keys(prevPages).filter((p) => !current.has(p));
  return { ok: true, partial: true, removed, pages, upstream: { seeds: source.seeds, visited: visited.size }, notes };
}

export async function checkUpstream({ source, entry, ctx }) {
  const changed = [];
  for (const seed of source.seeds) {
    const page = entry?.pages?.[urlToCorpusPath(seed)];
    const res = await ctx.http.get(seed, { accept: MARKDOWN_ACCEPT, headers: conditionalHeaders(page) });
    if (res.status === 304) continue;
    if (res.status >= 400) return { checked: false, detail: `${seed}: HTTP ${res.status}` };
    if (!page || page.raw_sha256 !== sha256(res.text)) changed.push(seed);
  }
  return { checked: true, drift: changed.length > 0, detail: changed.length ? `${changed.length} seed page(s) changed` : 'up to date' };
}
