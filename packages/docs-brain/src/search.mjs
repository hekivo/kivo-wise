// `docs-brain search`: ripgrep when installed, otherwise a JS scan over INDEX.md and pages.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { printNotes } from './cli.mjs';
import { SKIP_DIRS, walkFiles } from './util.mjs';

const SEARCH_SKIP = new Set([...SKIP_DIRS, '.state', 'state']);

export function rgAvailable() {
  const r = spawnSync('rg', ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function searchWithRg(dir, query, { regex, limit }) {
  const args = ['--line-number', '--no-heading', '--with-filename', '--smart-case', '--max-columns', '240', '--max-columns-preview', '--glob', '*.md', '--glob', '!.state/**'];
  if (!regex) args.push('--fixed-strings');
  args.push('--', query, dir);
  const r = spawnSync('rg', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return null;
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .slice(0, limit * 4)
    .map((line) => {
      const m = /^(.*?):(\d+):(.*)$/.exec(line);
      return m ? { file: m[1], line: Number(m[2]), text: m[3] } : null;
    })
    .filter(Boolean);
}

function searchWithJs(dir, query, { regex, limit }) {
  const smartCase = !regex && query === query.toLowerCase();
  const re = new RegExp(regex ? query : escapeRe(query), smartCase || !regex ? (query === query.toLowerCase() ? 'i' : '') : '');
  const hits = [];
  const files = [];
  if (existsSync(join(dir, 'INDEX.md'))) files.push('INDEX.md');
  for (const rel of walkFiles(dir, { skipDirs: SEARCH_SKIP })) if (rel.endsWith('.md') && rel !== 'INDEX.md') files.push(rel);
  for (const rel of files) {
    let text;
    try {
      text = readFileSync(join(dir, rel), 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits.push({ file: join(dir, rel), line: i + 1, text: lines[i].length > 240 ? lines[i].slice(0, 240) + '…' : lines[i] });
        if (hits.length >= limit * 4) return hits;
      }
    }
  }
  return hits;
}

export function search(dirs, query, { regex = false, limit = 20, useRg = true } = {}) {
  const rg = useRg && rgAvailable();
  const all = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const hits = (rg && searchWithRg(dir, query, { regex, limit })) || searchWithJs(dir, query, { regex, limit });
    // Pages before index lines: INDEX.md matches only repeat titles.
    hits.sort((a, b) => Number(a.file.endsWith('INDEX.md')) - Number(b.file.endsWith('INDEX.md')));
    all.push(...hits);
  }
  return { engine: rg ? 'rg' : 'js', hits: all.slice(0, limit) };
}

export function runSearch(ctx, query) {
  printNotes(ctx.notes.filter((n) => !/lock files|not found in/.test(n)));
  if (!query) {
    console.error('usage: docs-brain search <query> [--source id] [--limit n]');
    return 1;
  }
  if (ctx.roots.length === 0) {
    console.error('note: no corpus roots (pass --corpus or set roots[] in .docs-brain.json)');
    return 1;
  }
  const limit = Number(ctx.opts.limit ?? 20) || 20;
  const dirs = ctx.opts.source ? ctx.roots.map((r) => join(r, ctx.opts.source)) : ctx.roots;
  const { engine, hits } = search(dirs, query, { regex: Boolean(ctx.opts.regex), limit, useRg: !ctx.opts['no-rg'] });
  if (ctx.opts.json) {
    console.log(JSON.stringify({ engine, hits }, null, 2));
    return 0;
  }
  for (const h of hits) console.log(`${h.file}:${h.line}: ${h.text.trim()}`);
  if (hits.length === 0) console.error(`no matches for "${query}" (${engine})`);
  return 0;
}
