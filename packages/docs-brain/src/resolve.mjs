// Project config (.docs-brain.json), lock-file reading and the version resolver.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { compareVersions, expandHome, formatTable, renderTemplate, resolveFrom, semverParts, walkFiles } from './util.mjs';

export const PROJECT_CONFIG = '.docs-brain.json';

/** Read .docs-brain.json from the project dir (absent -> defaults). */
export function loadProjectConfig(projectDir) {
  const dir = resolve(expandHome(projectDir || process.cwd()));
  const file = join(dir, PROJECT_CONFIG);
  let raw = {};
  const notes = [];
  if (existsSync(file)) {
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      notes.push(`${PROJECT_CONFIG}: invalid JSON (${e.message}); using defaults`);
    }
  } else {
    notes.push(`${PROJECT_CONFIG} not found in ${dir}; discovering lock files`);
  }
  const roots = (Array.isArray(raw.roots) ? raw.roots : raw.corpus ? [raw.corpus] : []).map((r) => resolveFrom(dir, r));
  return {
    dir,
    file: existsSync(file) ? file : null,
    roots,
    manifest: raw.manifest ? resolveFrom(dir, raw.manifest) : null,
    locks: Array.isArray(raw.locks) ? raw.locks : [],
    sources: Array.isArray(raw.sources) ? raw.sources : null,
    notes,
  };
}

const LOCK_NAMES = new Set(['composer.lock', 'package.json']);

/** Find composer.lock / package.json candidates when .docs-brain.json has no locks[]. */
export function discoverLocks(projectDir) {
  const found = [];
  for (const rel of walkFiles(projectDir, { maxDepth: 4 })) {
    const name = basename(rel);
    if (!LOCK_NAMES.has(name)) continue;
    if (/(^|\/)(wp|web\/wp|public\/wp)\//.test(rel)) continue;
    found.push(rel);
  }
  return found;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function readComposerLock(file) {
  const lock = readJson(file);
  const out = {};
  if (!lock) return out;
  for (const pkg of [...(lock.packages ?? []), ...(lock['packages-dev'] ?? [])]) {
    if (pkg && pkg.name && pkg.version) out[pkg.name] = String(pkg.version);
  }
  return out;
}

/** yarn.lock v1: `name@range, name@range2:` blocks with `  version "x"`. */
export function readYarnLockV1(text) {
  const out = {};
  const blocks = text.split(/\n(?=\S)/);
  for (const block of blocks) {
    const header = block.split('\n')[0];
    if (!header || header.startsWith('#') || !header.endsWith(':')) continue;
    const ver = /\n\s+version\s+"?([^"\n]+)"?/.exec(block);
    if (!ver) continue;
    for (let key of header.slice(0, -1).split(',')) {
      key = key.trim().replace(/^"|"$/g, '');
      const at = key.lastIndexOf('@');
      if (at <= 0) continue;
      const name = key.slice(0, at);
      if (!out[name]) out[name] = ver[1];
    }
  }
  return out;
}

export function readPackageLock(file) {
  const lock = readJson(file);
  const out = {};
  if (!lock) return out;
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    if (!key || !entry?.version) continue;
    const name = key.replace(/^.*node_modules\//, '');
    if (!out[name]) out[name] = entry.version;
  }
  for (const [name, entry] of Object.entries(lock.dependencies ?? {})) {
    if (entry?.version && !out[name]) out[name] = entry.version;
  }
  return out;
}

/** package.json ranges, overridden by yarn.lock / package-lock.json next to it. */
export function readNpmVersions(packageJsonFile) {
  const pkg = readJson(packageJsonFile) ?? {};
  const dir = dirname(packageJsonFile);
  const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const out = {};
  for (const [name, range] of Object.entries(declared)) {
    const m = /\d+(\.\d+)*([-+][\w.]+)?/.exec(String(range));
    if (m) out[name] = m[0];
  }
  let locked = {};
  if (existsSync(join(dir, 'yarn.lock'))) locked = readYarnLockV1(readFileSync(join(dir, 'yarn.lock'), 'utf8'));
  else if (existsSync(join(dir, 'package-lock.json'))) locked = readPackageLock(join(dir, 'package-lock.json'));
  for (const name of Object.keys(declared)) if (locked[name]) out[name] = locked[name];
  return out;
}

/** Collect installed versions: { composer: {name: version}, npm: {name: version}, files: [...] }. */
export function readProjectVersions(projectDir, cfg = {}) {
  const dir = resolve(expandHome(projectDir || process.cwd()));
  const rels = cfg.locks && cfg.locks.length ? cfg.locks : discoverLocks(dir);
  const result = { composer: {}, npm: {}, files: [], missing: [] };
  for (const rel of rels) {
    const file = resolveFrom(dir, rel);
    if (!existsSync(file)) {
      result.missing.push(rel);
      continue;
    }
    result.files.push(file);
    const name = basename(file);
    if (name === 'composer.lock') Object.assign(result.composer, readComposerLock(file));
    else if (name === 'package.json') Object.assign(result.npm, readNpmVersions(file));
    else if (name === 'yarn.lock') Object.assign(result.npm, readYarnLockV1(readFileSync(file, 'utf8')));
    else if (name === 'package-lock.json') Object.assign(result.npm, readPackageLock(file));
  }
  return result;
}

function lookupInstalled(versions, from, pkg) {
  const table = /package\.json|yarn\.lock|package-lock\.json/.test(from || '') ? versions.npm : versions.composer;
  return table?.[pkg] ?? null;
}

/**
 * Resolve the version label and the git ref of one source.
 * Returns { id, type, package, from, installed, strategy, map, version, ref, note }.
 */
export function resolveSource(source, versions) {
  const out = {
    id: source.id,
    type: source.type,
    package: null,
    from: null,
    installed: null,
    strategy: null,
    map: null,
    version: null,
    ref: null,
    note: null,
  };
  const refSpec = source.ref;
  const verSpec = source.version;

  // 1. ref: string or { from, package, map }
  if (typeof refSpec === 'string') {
    out.ref = refSpec;
  } else if (refSpec && typeof refSpec === 'object') {
    out.package = refSpec.package;
    out.from = refSpec.from;
    out.map = refSpec.map;
    out.installed = lookupInstalled(versions, refSpec.from, refSpec.package);
    if (out.installed) {
      const parts = semverParts(out.installed);
      out.ref = renderTemplate(refSpec.map ?? '{version}', parts);
      out.version = out.ref.replace(/^v(?=\d)/, '');
    } else {
      out.note = `package ${refSpec.package} not found in ${refSpec.from}; ref cannot be resolved`;
    }
  } else if (source.type === 'git' && source.repos?.length) {
    out.ref = source.repos[0].ref ?? 'main';
  } else if (source.type === 'local-git') {
    out.ref = 'HEAD';
  }

  // 2. version: { fixed } | { from, package, strategy }
  if (verSpec && typeof verSpec === 'object') {
    if (verSpec.fixed !== undefined) {
      out.strategy = 'fixed';
      out.version = String(verSpec.fixed);
    } else if (verSpec.strategy) {
      out.strategy = verSpec.strategy;
      out.package = verSpec.package ?? out.package;
      out.from = verSpec.from ?? out.from;
      out.installed = lookupInstalled(versions, verSpec.from, verSpec.package) ?? out.installed;
      const parts = semverParts(out.installed);
      if (verSpec.strategy === 'record-sha') {
        out.version = null; // known after fetching
      } else if (!parts) {
        out.note = `package ${verSpec.package} not found in ${verSpec.from}; version cannot be resolved`;
      } else if (verSpec.strategy === 'major.minor') {
        out.version = `${parts.major}.${parts.minor}`;
      } else if (verSpec.strategy === 'major') {
        out.version = `${parts.major}`;
      } else if (verSpec.strategy === 'exact' || verSpec.strategy === 'version') {
        out.version = parts.version;
      } else {
        out.note = `unknown version strategy "${verSpec.strategy}"`;
      }
    }
  } else if (typeof verSpec === 'string') {
    out.strategy = 'fixed';
    out.version = verSpec;
  }

  // 3. fallbacks: the ref is the version; HTTP sources without a version are "current".
  if (out.version === null && out.strategy !== 'record-sha' && !out.note) {
    if (out.ref) out.version = out.ref.replace(/^v(?=\d)/, '');
    else if (['rest', 'sitemap', 'llms', 'negotiate'].includes(source.type)) out.version = 'current';
  }
  if (['rest', 'sitemap', 'llms', 'negotiate'].includes(source.type)) out.ref = null;
  return out;
}

export function resolveSources(manifest, versions) {
  return manifest.sources.map((s) => resolveSource(s, versions));
}

export function formatResolveTable(resolved) {
  const rows = resolved.map((r) => [
    r.id,
    r.package ?? '-',
    r.installed ?? '-',
    r.strategy ?? (r.map ? `map ${r.map}` : '-'),
    r.version ?? (r.strategy === 'record-sha' ? '<sha>' : '-'),
    r.ref ?? '-',
    r.note ?? '',
  ]);
  return formatTable(['source', 'package', 'installed', 'strategy', 'version', 'ref', 'note'], rows);
}

/** Pick the nearest lower tag when the wanted tag is missing (semver-ish). */
export function nearestLowerTag(wanted, tags) {
  const w = wanted.replace(/^v/, '');
  const candidates = tags
    .map((t) => ({ raw: t, norm: t.replace(/^v/, '') }))
    .filter((t) => /^\d+(\.\d+)*$/.test(t.norm) && compareVersions(t.norm, w) <= 0)
    .filter((t) => semverParts(t.norm).major === semverParts(w).major)
    .sort((a, b) => compareVersions(b.norm, a.norm));
  return candidates[0]?.raw ?? null;
}
