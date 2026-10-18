// Loads and normalises sources.yaml (the kivo-wisdom manifest contract).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import YAML from 'yaml';

export const SOURCE_TYPES = new Set(['git', 'local-git', 'negotiate', 'rest', 'sitemap', 'llms']);
export const CONVERTERS = new Set(['turndown', 'defuddle', 'vitepress', 'mdx-strip', 'pandoc-rst']);

const DEFAULTS = {
  user_agent: 'docs-brain/0.1 (+https://github.com/hekivo/kivo-wise)',
  concurrency: 4,
  politeness_ms: 500,
  redistribute: true,
  strip: [],
};

export function repoName(repoUrl) {
  return String(repoUrl)
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .split('/')
    .pop();
}

function asList(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Normalise one source entry; returns null (and pushes a note) when it is unusable. */
export function normaliseSource(raw, defaults, notes) {
  if (!raw || typeof raw !== 'object' || !raw.id) {
    notes.push('source without id skipped');
    return null;
  }
  const id = String(raw.id);
  if (!SOURCE_TYPES.has(raw.type)) {
    notes.push(`source "${id}": unknown type "${raw.type}" skipped`);
    return null;
  }
  if (raw.convert && !CONVERTERS.has(raw.convert)) {
    notes.push(`source "${id}": unknown convert "${raw.convert}", falling back to the default converter`);
  }
  const src = {
    ...raw,
    id,
    include: asList(raw.include),
    exclude: asList(raw.exclude),
    strip: [...asList(defaults.strip), ...asList(raw.strip)],
    redistribute: raw.redistribute === undefined ? defaults.redistribute !== false : raw.redistribute !== false,
    license: raw.license ?? 'unspecified',
    politeness_ms: raw.politeness_ms ?? defaults.politeness_ms,
    user_agent: raw.user_agent ?? defaults.user_agent,
    concurrency: raw.concurrency ?? defaults.concurrency,
    convert: CONVERTERS.has(raw.convert) ? raw.convert : null,
    collections: asList(raw.collections),
    seeds: asList(raw.seeds),
    children: asList(raw.children),
    also_index: asList(raw.also_index),
    root: raw.root ? String(raw.root).replace(/^\/+|\/+$/g, '') : '',
  };
  if (Array.isArray(raw.repos)) {
    src.repos = raw.repos
      .filter((r) => r && r.repo)
      .map((r) => ({
        repo: r.repo,
        name: r.name ?? repoName(r.repo),
        ref: r.ref ?? raw.ref ?? 'main',
        root: r.root ? String(r.root).replace(/^\/+|\/+$/g, '') : src.root,
        include: asList(r.include ?? raw.include),
        exclude: asList(r.exclude ?? raw.exclude),
        convert: r.convert ?? src.convert,
        url_map: r.url_map ?? raw.url_map,
      }));
    if (src.repos.length === 0) notes.push(`source "${id}": repos list is empty`);
  } else if (raw.repo || raw.path) {
    src.repos = [
      {
        repo: raw.repo ?? null,
        path: raw.path ?? null,
        name: raw.repo ? repoName(raw.repo) : null,
        ref: raw.ref ?? 'main',
        root: src.root,
        include: src.include,
        exclude: src.exclude,
        convert: src.convert,
        url_map: raw.url_map,
        single: true,
      },
    ];
  }
  return src;
}

/** Load sources.yaml. Never throws on content problems: collects `notes`. */
export function loadManifest(file) {
  const text = readFileSync(file, 'utf8');
  const doc = YAML.parse(text) ?? {};
  const notes = [];
  const defaults = { ...DEFAULTS, ...(doc.defaults ?? {}) };
  const seen = new Set();
  const sources = [];
  for (const raw of doc.sources ?? []) {
    const src = normaliseSource(raw, defaults, notes);
    if (!src) continue;
    if (seen.has(src.id)) {
      notes.push(`duplicate id "${src.id}" skipped`);
      continue;
    }
    seen.add(src.id);
    sources.push(src);
  }
  return {
    file: resolve(file),
    dir: dirname(resolve(file)),
    version: doc.version ?? 1,
    corpusDir: doc.corpus_dir ?? 'corpus',
    defaults,
    sources,
    notes,
  };
}

export function selectSources(manifest, ids) {
  if (!ids || ids.length === 0) return manifest.sources;
  const wanted = new Set(ids);
  const found = manifest.sources.filter((s) => wanted.has(s.id));
  const missing = ids.filter((id) => !manifest.sources.some((s) => s.id === id));
  return Object.assign(found, { missing });
}
