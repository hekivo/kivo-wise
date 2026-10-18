// `docs-brain update`: fetch, convert, write corpus pages, indexes and state/lock.json.
import { existsSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { buildPage } from './convert/frontmatter.mjs';
import { fetcherFor } from './fetchers/registry.mjs';
import { Http } from './http.mjs';
import { writeGlobalIndex, writeLlmsTxt, writeSourceSummary } from './index.mjs';
import { readLock, stateDirFor, writeLock } from './lock.mjs';
import { printNotes } from './cli.mjs';
import { ensureParent, nowIso } from './util.mjs';

export function pickSources(ctx, ids) {
  const all = ctx.manifest.sources;
  if (ids.length) {
    const missing = ids.filter((id) => !all.some((s) => s.id === id));
    for (const id of missing) ctx.notes.push(`unknown source "${id}"`);
    return all.filter((s) => ids.includes(s.id));
  }
  if (ctx.cfg.sources) return all.filter((s) => ctx.cfg.sources.includes(s.id));
  return all;
}

export function versionLabel(resolved) {
  return resolved.version ?? resolved.ref ?? 'current';
}

function pruneEmptyDirs(dir, stopAt) {
  let cur = dir;
  while (cur.startsWith(stopAt) && cur !== stopAt) {
    try {
      if (readdirSync(cur).length > 0) return;
      rmdirSync(cur);
    } catch {
      return;
    }
    cur = dirname(cur);
  }
}

function safeInside(root, target) {
  const rel = relative(root, target);
  return rel && !rel.startsWith('..') && !rel.startsWith(sep) && rel !== '';
}

/** Apply one fetch result to the corpus; returns { entry, stats }. */
export function applyResult({ corpusDir, source, resolved, result, prev, dryRun }) {
  const version = versionLabel(resolved);
  const dir = join(corpusDir, source.id, version);
  const sameVersion = prev && prev.version === version;
  const prevPages = sameVersion ? prev.pages ?? {} : {};
  const stats = { added: 0, modified: 0, removed: 0, kept: 0 };
  const fetchedAt = nowIso();
  const pages = result.partial ? { ...prevPages } : {};
  const seen = new Set();
  for (const page of result.pages ?? []) {
    if (seen.has(page.path)) continue;
    seen.add(page.path);
    const built = buildPage({
      body: page.body,
      title: page.title,
      meta: {
        source: source.id,
        version,
        url: page.url,
        upstream_modified: page.upstream_modified,
        fetched_at: fetchedAt,
        license: source.license,
        redistribute: source.redistribute,
      },
      extra: {
        ...(page.markdown_negotiated !== undefined ? { markdown_negotiated: page.markdown_negotiated } : {}),
        ...(page.extra ?? {}),
      },
    });
    const old = prevPages[page.path];
    const file = join(dir, page.path);
    const record = {
      title: built.title,
      url: page.url ?? null,
      sha256: built.sha256,
      upstream_modified: page.upstream_modified ?? null,
      ...(page.lock ?? {}),
    };
    if (old && old.sha256 === built.sha256 && existsSync(file)) {
      stats.kept++;
      pages[page.path] = { ...old, ...record };
      continue;
    }
    old ? stats.modified++ : stats.added++;
    pages[page.path] = record;
    if (!dryRun) writeFileSync(ensureParent(file), built.text);
  }
  const removals = result.partial ? (result.removed ?? []).filter((p) => prevPages[p]) : Object.keys(prevPages).filter((p) => !pages[p]);
  for (const p of removals) {
    delete pages[p];
    stats.removed++;
    const file = join(dir, p);
    if (!dryRun && existsSync(file)) {
      rmSync(file);
      pruneEmptyDirs(dirname(file), dir);
    }
  }
  // Version moved (e.g. 13.x -> 14.x): drop the old version directory of this source.
  if (prev && prev.version && prev.version !== version) {
    const oldDir = join(corpusDir, source.id, prev.version);
    stats.removed += Object.keys(prev.pages ?? {}).length;
    if (!dryRun && safeInside(join(corpusDir, source.id), oldDir) && existsSync(oldDir)) rmSync(oldDir, { recursive: true, force: true });
  }
  const entry = {
    type: source.type,
    version,
    ref: resolved.ref ?? null,
    package: resolved.package ?? null,
    installed: resolved.installed ?? null,
    strategy: resolved.strategy ?? null,
    license: source.license,
    redistribute: source.redistribute !== false,
    upstream: result.upstream ?? prev?.upstream ?? {},
    last_sync: fetchedAt,
    page_count: Object.keys(pages).length,
    pages,
    ...(result.order?.length ? { order: result.order } : {}),
    ...(result.notes?.length ? { notes: result.notes } : {}),
  };
  return { entry, stats };
}

export async function runUpdate(ctx, ids) {
  printNotes(ctx.notes);
  ctx.notes.length = 0;
  if (!ctx.manifest) return 1;
  const corpusDir = ctx.roots[0];
  if (!corpusDir) {
    console.error('note: no corpus root; pass --corpus <dir> or set roots[] in .docs-brain.json');
    return 1;
  }
  const dryRun = Boolean(ctx.opts['dry-run']);
  const stateDir = stateDirFor(corpusDir, ctx.manifest);
  const lock = readLock(stateDir);
  const sources = pickSources(ctx, ids);
  printNotes(ctx.notes);
  let failures = 0;
  let changed = 0;
  console.log(`${dryRun ? 'dry run: ' : ''}corpus ${corpusDir}`);
  for (const source of sources) {
    const resolved = ctx.resolved.find((r) => r.id === source.id);
    if (!resolved || (resolved.version === null && resolved.strategy !== 'record-sha' && resolved.note)) {
      console.log(`${source.id}: skipped (${resolved?.note ?? 'not resolved'})`);
      continue;
    }
    const fetcher = await fetcherFor(source.type);
    if (!fetcher) {
      console.log(`${source.id}: skipped (no fetcher for type ${source.type})`);
      continue;
    }
    const prev = lock.sources[source.id];
    const http = new Http({ offline: Boolean(ctx.opts.offline), userAgent: source.user_agent, politenessMs: source.politeness_ms });
    const fctx = { stateDir, versionDir: join(corpusDir, source.id, versionLabel(resolved)), offline: Boolean(ctx.opts.offline), force: Boolean(ctx.opts.force), http, dryRun };
    let result;
    try {
      result = await fetcher.fetchSource({ source, resolved, prev: prev?.version === versionLabel(resolved) ? prev : prev && { ...prev, pages: {} }, ctx: fctx });
    } catch (e) {
      result = { ok: false, notes: [`${source.id}: ${e.message}`] };
    }
    printNotes(result.notes ?? []);
    if (!result.ok) {
      failures++;
      console.log(`${source.id}: failed`);
      continue;
    }
    if (result.unchanged) {
      console.log(`${source.id}@${versionLabel(resolved)}: unchanged (${prev?.page_count ?? 0} pages)`);
      if (!dryRun) lock.sources[source.id] = { ...prev, installed: resolved.installed ?? prev.installed, last_checked: nowIso() };
      continue;
    }
    const { entry, stats } = applyResult({ corpusDir, source, resolved, result, prev, dryRun });
    console.log(`${source.id}@${entry.version}: +${stats.added} ~${stats.modified} -${stats.removed} (${entry.page_count} pages)`);
    if (stats.added + stats.modified + stats.removed > 0) changed++;
    if (!dryRun) {
      lock.sources[source.id] = entry;
      writeSourceSummary(corpusDir, source.id, entry);
    }
  }
  if (!dryRun) {
    lock.manifest = ctx.manifestFile;
    writeLock(stateDir, lock);
    writeGlobalIndex(corpusDir, lock);
    writeLlmsTxt(corpusDir, lock);
  }
  console.log(`${sources.length} source(s), ${changed} changed, ${failures} failed${dryRun ? ' (nothing written)' : ''}`);
  return failures > 0 && failures === sources.length ? 1 : 0;
}
