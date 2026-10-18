// Small shared helpers: glob matching, templates, paths, hashing, time.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, posix, resolve } from 'node:path';

const GLOB_CACHE = new Map();

/** Convert a gitignore-style glob (`**`, `*`, `?`) to a RegExp. `*` never crosses `/`. */
export function globToRegExp(glob) {
  if (GLOB_CACHE.has(glob)) return GLOB_CACHE.get(glob);
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  re += '$';
  const out = new RegExp(re);
  GLOB_CACHE.set(glob, out);
  return out;
}

export function matchesAny(value, globs) {
  if (!globs || globs.length === 0) return false;
  return globs.some((g) => globToRegExp(g).test(value));
}

/** include/exclude filter; an empty include list means "everything". */
export function isIncluded(value, include, exclude) {
  if (include && include.length > 0 && !matchesAny(value, include)) return false;
  if (exclude && exclude.length > 0 && matchesAny(value, exclude)) return false;
  return true;
}

/** `v13.26.1` -> { version: '13.26.1', major: '13', minor: '26', patch: '1' } */
export function semverParts(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)$/);
  if (!m) return { version: String(raw).replace(/^v/, ''), major: null, minor: null, patch: null };
  const version = [m[1], m[2] ?? '0', m[3] ?? '0'].join('.') + (m[4] || '');
  return { version, major: m[1], minor: m[2] ?? '0', patch: m[3] ?? '0' };
}

/** Replace `{key}` placeholders; unknown keys stay literal so the caller can spot them. */
export function renderTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (all, key) =>
    vars && vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : all,
  );
}

/** Map a URL to a relative corpus path ending in .md. */
export function urlToCorpusPath(url) {
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = String(url);
  }
  pathname = decodeURIComponent(pathname).replace(/\/+$/, '').replace(/^\/+/, '');
  if (!pathname) return 'index.md';
  pathname = pathname.replace(/\.(md|html?)$/i, '');
  const safe = pathname
    .split('/')
    .map((seg) => seg.replace(/[^A-Za-z0-9._@-]+/g, '-').replace(/^\.+/, '_'))
    .filter(Boolean)
    .join('/');
  return `${safe || 'index'}.md`;
}

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function expandHome(p) {
  if (!p) return p;
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

export function resolveFrom(base, p) {
  const expanded = expandHome(p);
  return isAbsolute(expanded) ? expanded : resolve(base, expanded);
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureParent(file) {
  ensureDir(dirname(file));
  return file;
}

export function exists(p) {
  return existsSync(p);
}

export const SKIP_DIRS = new Set(['vendor', 'node_modules', '.git', 'storage', 'build', 'dist', '.worktrees', 'cache']);

/** Walk a directory recursively (bounded), yielding relative POSIX paths of files. */
export function* walkFiles(root, { maxDepth = 12, skipDirs = SKIP_DIRS, maxFiles = 200000 } = {}) {
  let count = 0;
  const stack = [{ dir: root, depth: 0, rel: '' }];
  while (stack.length) {
    const { dir, depth, rel } = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const relPath = rel ? posix.join(rel, e.name) : e.name;
      if (e.isDirectory()) {
        if (skipDirs.has(e.name) || depth >= maxDepth) continue;
        stack.push({ dir: join(dir, e.name), depth: depth + 1, rel: relPath });
      } else if (e.isFile()) {
        if (++count > maxFiles) return;
        yield relPath;
      }
    }
  }
}

export function fileSize(p) {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
}

export function sleep(ms) {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

export function uniq(arr) {
  return [...new Set(arr)];
}

/** Compare two dotted versions numerically; returns -1/0/1. Non-numeric parts compare as strings. */
export function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/);
  const pb = String(b).replace(/^v/, '').split(/[.-]/);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? '0';
    const y = pb[i] ?? '0';
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
      if (nx !== ny) return nx < ny ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/** Format a plain-text table from rows of strings. */
export function formatTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)));
  const line = (cells) => cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' | ').trimEnd();
  return [line(headers), widths.map((w) => '-'.repeat(w)).join('-|-'), ...rows.map(line)].join('\n');
}
