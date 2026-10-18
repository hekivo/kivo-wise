// Corpus indexes: per-source SUMMARY.md, global INDEX.md, llms.txt and export-llms.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLock, stateDirFor } from './lock.mjs';
import { ensureParent } from './util.mjs';

function orderedPages(entry, order = entry.order) {
  const paths = Object.keys(entry.pages ?? {});
  const rank = new Map();
  (order ?? []).forEach((p, i) => {
    if (!rank.has(p)) rank.set(p, i);
  });
  return paths.sort((a, b) => {
    const ra = rank.has(a) ? rank.get(a) : Infinity;
    const rb = rank.has(b) ? rank.get(b) : Infinity;
    if (ra !== rb) return ra - rb;
    const da = a.split('/').length;
    const db = b.split('/').length;
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
}

export function writeSourceSummary(corpusDir, id, entry) {
  const lines = [`# ${id} ${entry.version}`, ''];
  lines.push(`> Source: ${entry.type}${entry.ref ? ` ${entry.ref}` : ''}${entry.upstream?.sha ? ` @ ${entry.upstream.sha.slice(0, 12)}` : ''} · licence: ${entry.license} · redistribute: ${entry.redistribute !== false}`);
  lines.push('');
  let lastDir = null;
  for (const p of orderedPages(entry)) {
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    if (dir !== lastDir && dir) {
      lines.push('', `## ${dir}`, '');
    }
    lastDir = dir;
    lines.push(`- [${entry.pages[p].title}](${p})`);
  }
  const file = join(corpusDir, id, entry.version, 'SUMMARY.md');
  writeFileSync(ensureParent(file), lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
}

export function indexLines(lock) {
  const lines = [];
  for (const id of Object.keys(lock.sources).sort()) {
    const entry = lock.sources[id];
    for (const p of orderedPages(entry)) {
      const page = entry.pages[p];
      lines.push(`${id}/${entry.version}/${p} | ${page.title} | ${page.url ?? '-'} | ${page.upstream_modified ?? '-'}`);
    }
  }
  return lines;
}

export function writeGlobalIndex(corpusDir, lock) {
  const lines = ['# Corpus index', '', '<!-- one line per page: path | title | upstream url | upstream modified -->', '', ...indexLines(lock)];
  writeFileSync(ensureParent(join(corpusDir, 'INDEX.md')), lines.join('\n') + '\n');
}

/** llms.txt for one or more locks; redistribute: false sources are always skipped. */
export function buildLlmsTxt(locks, { title = 'docs-brain corpus' } = {}) {
  const lines = [`# ${title}`, '', '> Versioned documentation pages (markdown). Only redistributable sources are listed.', ''];
  const seen = new Set();
  for (const lock of locks) {
    for (const id of Object.keys(lock.sources).sort()) {
      if (seen.has(id)) continue;
      const entry = lock.sources[id];
      if (entry.redistribute === false) continue;
      seen.add(id);
      lines.push(`## ${id} ${entry.version} (${entry.license})`, '');
      for (const p of orderedPages(entry)) {
        const page = entry.pages[p];
        lines.push(`- [${page.title}](${id}/${entry.version}/${p})${page.url ? `: ${page.url}` : ''}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function writeLlmsTxt(corpusDir, lock) {
  writeFileSync(ensureParent(join(corpusDir, 'llms.txt')), buildLlmsTxt([lock]));
}

export function runExportLlms(ctx) {
  if (ctx.roots.length === 0) {
    console.error('note: no corpus roots (pass --corpus or set roots[] in .docs-brain.json)');
    return 1;
  }
  const locks = ctx.roots.map((r) => readLock(stateDirFor(r, ctx.manifest)));
  const text = buildLlmsTxt(locks);
  if (ctx.opts.out) {
    writeFileSync(ensureParent(ctx.opts.out), text);
    console.log(`wrote ${ctx.opts.out}`);
  } else {
    process.stdout.write(text);
  }
  return 0;
}
