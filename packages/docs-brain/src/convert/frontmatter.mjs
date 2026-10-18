// YAML frontmatter parsing/serialisation and the corpus page builder.
import YAML from 'yaml';
import { sha256 } from '../util.mjs';

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Split a markdown document into { data, body }.
 * options.stripHeadings removes `## <heading>` sections (until the next heading of the same or higher level).
 */
export function parseFrontmatter(text, options = {}) {
  let data = {};
  let body = text ?? '';
  const m = FM_RE.exec(body);
  if (m) {
    try {
      const parsed = YAML.parse(m[1]);
      if (parsed && typeof parsed === 'object') data = parsed;
    } catch {
      data = {};
    }
    body = body.slice(m[0].length);
  }
  body = body.replace(/^\s*\n/, '');
  for (const heading of options.stripHeadings || []) {
    body = stripSection(body, heading);
  }
  return { data, body };
}

export function stripSection(body, heading) {
  const lines = body.split('\n');
  const out = [];
  let skipping = 0;
  for (const line of lines) {
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = h[1].length;
      if (skipping && level <= skipping) skipping = 0;
      if (!skipping && h[2].trim().toLowerCase() === String(heading).trim().toLowerCase()) {
        skipping = level;
        continue;
      }
    }
    if (!skipping) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Serialize frontmatter with a stable key order (insertion order of the object). */
export function serializeFrontmatter(data) {
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    clean[k] = v;
  }
  const yaml = YAML.stringify(clean, { lineWidth: 0, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' });
  return `---\n${yaml}---\n`;
}

export function firstH1(body) {
  const m = /^#\s+(.+?)\s*#*\s*$/m.exec(body);
  return m ? m[1].trim() : null;
}

export function titleFromPath(relPath) {
  const base = relPath.split('/').pop().replace(/\.[^.]+$/, '');
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the final corpus page text.
 * meta keys are written in the contract order: title, source, version, url, upstream_modified,
 * fetched_at, sha256, license, redistribute, then extras (markdown_negotiated, description, ...).
 */
export function buildPage({ body, title, meta = {}, extra = {} }) {
  let text = (body ?? '').replace(/\r\n/g, '\n').trim() + '\n';
  const h1 = firstH1(text);
  const finalTitle = title || h1 || 'Untitled';
  if (!h1) text = `# ${finalTitle}\n\n${text}`;
  const hash = sha256(text);
  const fm = {
    title: finalTitle,
    source: meta.source,
    version: meta.version === undefined || meta.version === null ? undefined : String(meta.version),
    url: meta.url ?? null,
    upstream_modified: meta.upstream_modified ?? null,
    fetched_at: meta.fetched_at,
    sha256: hash,
    license: meta.license ?? 'unspecified',
    redistribute: meta.redistribute !== false,
    ...extra,
  };
  return { text: serializeFrontmatter(fm) + '\n' + text, sha256: hash, title: finalTitle };
}
