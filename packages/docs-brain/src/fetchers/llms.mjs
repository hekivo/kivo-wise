// llms.txt sources: conditional GET on the index, include globs over its links, markdown pages.
import { conditionalHeaders } from '../http.mjs';
import { isIncluded, sha256, urlToCorpusPath } from '../util.mjs';
import * as git from './git.mjs';
import { fetchPage, pageRecordExtras } from './page.mjs';

/** Links of an llms.txt file, resolved against its URL, in document order. */
export function parseLlmsLinks(text, baseUrl) {
  const out = [];
  const seen = new Set();
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    let url;
    try {
      url = new URL(m[2], baseUrl).href;
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title: m[1].trim(), url });
  }
  return out;
}

async function viaFallbackGit(source, resolved, prev, ctx, reason) {
  const fb = source.fallback_git;
  const gitSource = {
    ...source,
    type: 'git',
    repos: [{ repo: fb.repo, name: git.isRemoteUrl(fb.repo) ? fb.repo.split('/').pop() : null, ref: fb.ref ?? 'HEAD', root: fb.root ?? '', include: fb.include ?? [], exclude: fb.exclude ?? [], convert: fb.convert ?? null, single: true }],
  };
  const r = await git.fetchSource({ source: gitSource, resolved: { ...resolved, ref: fb.ref ?? 'HEAD' }, prev, ctx });
  return { ...r, notes: [`${source.id}: ${reason}; using fallback_git ${fb.repo}`, ...(r.notes ?? [])] };
}

export async function fetchSource({ source, resolved, prev, ctx }) {
  const notes = [];
  const usable = prev && Object.keys(prev.pages ?? {}).length > 0 && !ctx.force;
  let res;
  try {
    res = await ctx.http.get(source.url, { accept: 'text/plain, text/markdown;q=0.9, */*;q=0.5', headers: usable ? conditionalHeaders(prev.upstream) : {} });
  } catch (e) {
    if (source.fallback_git) return viaFallbackGit(source, resolved, prev, ctx, e.message);
    return { ok: false, notes: [`${source.id}: ${e.message}`] };
  }
  if (res.status === 304 && usable) return { ok: true, unchanged: true, upstream: prev.upstream, notes };
  if (res.status >= 400) {
    if (source.fallback_git) return viaFallbackGit(source, resolved, prev, ctx, `llms.txt HTTP ${res.status}`);
    return { ok: false, notes: [`${source.id}: ${source.url} HTTP ${res.status}`] };
  }
  const upstream = { etag: res.headers.etag ?? null, last_modified: res.headers['last-modified'] ?? null, sha256: sha256(res.text) };
  if (usable && prev.upstream?.sha256 === upstream.sha256 && !upstream.etag) return { ok: true, unchanged: true, upstream: prev.upstream, notes };
  const links = parseLlmsLinks(res.text, source.url).filter((l) => isIncluded(l.url, source.include, source.exclude));
  const limited = source.max_pages ? links.slice(0, source.max_pages) : links;
  const prevPages = prev?.pages ?? {};
  const pages = [];
  const current = new Set();
  for (const link of limited) {
    const path = urlToCorpusPath(link.url);
    current.add(path);
    const r = await fetchPage(ctx.http, link.url, { source, prev: usable ? prevPages[path] : null });
    if (r.notModified) continue;
    if (!r.ok) {
      notes.push(`${source.id}: ${link.url} HTTP ${r.status}`);
      continue;
    }
    pages.push({
      path,
      title: r.title ?? link.title,
      body: r.body,
      url: link.url,
      upstream_modified: r.last_modified ?? null,
      markdown_negotiated: r.negotiated,
      extra: r.description ? { description: r.description } : {},
      lock: pageRecordExtras(r),
    });
  }
  const removed = Object.keys(prevPages).filter((p) => !current.has(p));
  return { ok: true, partial: true, removed, pages, upstream, notes };
}

export async function checkUpstream({ source, entry, ctx }) {
  if (entry?.upstream?.repos) return git.checkUpstream({ source: { ...source, repos: [{ repo: source.fallback_git.repo, ref: source.fallback_git.ref ?? 'HEAD', single: true }] }, resolved: { ref: source.fallback_git.ref ?? 'HEAD' }, entry, ctx });
  const res = await ctx.http.get(source.url, { headers: conditionalHeaders(entry?.upstream) });
  if (res.status === 304) return { checked: true, drift: false, detail: 'not modified (304)' };
  if (res.status >= 400) return { checked: false, detail: `HTTP ${res.status}` };
  const same = sha256(res.text) === entry?.upstream?.sha256;
  return { checked: true, drift: !same, detail: same ? 'up to date' : 'llms.txt changed' };
}
