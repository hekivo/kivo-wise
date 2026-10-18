// git sources: shallow fetch of one ref per repo, SHA compare, pages read straight from the commit.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { firstH1, parseFrontmatter, titleFromPath } from '../convert/frontmatter.mjs';
import { stripMdx } from '../convert/mdx-strip.mjs';
import { convertRst } from '../convert/pandoc-rst.mjs';
import { stripVitepress } from '../convert/vitepress.mjs';
import { nearestLowerTag } from '../resolve.mjs';
import { ensureDir, globToRegExp, isIncluded, renderTemplate } from '../util.mjs';

const DOC_EXT = /\.(md|mdx|markdown|rst)$/i;
const LOOPBACK = /^(https?|git|ssh):\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/;

export function runGit(args, { cwd, input, encoding = 'utf8' } = {}) {
  const r = spawnSync('git', args, {
    cwd,
    input,
    encoding,
    maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' },
  });
  return { ok: !r.error && r.status === 0, stdout: r.stdout, stderr: r.error ? r.error.message : String(r.stderr || '') };
}

export function isRemoteUrl(url) {
  return /^(https?|git|ssh):\/\//.test(url) || /^[\w.-]+@[\w.-]+:/.test(url);
}

export function networkAllowed(url, offline) {
  if (!offline) return true;
  return !isRemoteUrl(url) || LOOPBACK.test(url);
}

/** Resolve a ref on a remote without fetching: exact branch, peeled tag, tag, or a raw SHA. */
export function lsRemote(url, ref) {
  if (/^[0-9a-f]{40}$/.test(ref)) return { sha: ref, ref };
  const r = runGit(['ls-remote', url, ref, `${ref}^{}`]);
  if (!r.ok) return { sha: null, error: r.stderr.trim().split('\n').pop() };
  const lines = r.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));
  const pick = (name) => lines.find(([, n]) => n === name)?.[0];
  const sha = pick(`refs/heads/${ref}`) ?? pick(`refs/tags/${ref}^{}`) ?? pick(`refs/tags/${ref}`) ?? pick(ref) ?? null;
  return { sha, ref };
}

export function listTags(url) {
  const r = runGit(['ls-remote', '--tags', '--refs', url]);
  if (!r.ok) return [];
  return r.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t')[1].replace('refs/tags/', ''));
}

/** Shallow-fetch `ref` of `url` into a cache repo; returns the commit SHA. */
export function shallowFetch(url, ref, cacheDir) {
  ensureDir(cacheDir);
  if (!existsSync(join(cacheDir, '.git')) && !existsSync(join(cacheDir, 'HEAD'))) {
    const init = runGit(['init', '-q', '--bare', cacheDir]);
    if (!init.ok) return { sha: null, error: init.stderr };
  }
  const f = runGit(['fetch', '-q', '--depth', '1', '--no-tags', url, ref], { cwd: cacheDir });
  if (!f.ok) return { sha: null, error: f.stderr.trim().split('\n').pop() };
  const sha = runGit(['rev-parse', 'FETCH_HEAD^{commit}'], { cwd: cacheDir });
  return sha.ok ? { sha: sha.stdout.trim() } : { sha: null, error: sha.stderr };
}

/** Read many blobs at once through `git cat-file --batch`. Returns Map(path -> string). */
export function readBlobs(gitDir, sha, paths) {
  const out = new Map();
  if (paths.length === 0) return out;
  const r = spawnSync('git', ['cat-file', '--batch'], {
    cwd: gitDir,
    input: paths.map((p) => `${sha}:${p}`).join('\n') + '\n',
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) return out;
  const buf = r.stdout;
  let pos = 0;
  for (const p of paths) {
    const nl = buf.indexOf(10, pos);
    if (nl < 0) break;
    const header = buf.subarray(pos, nl).toString('utf8');
    pos = nl + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.split(' ')[2]);
    out.set(p, buf.subarray(pos, pos + size).toString('utf8'));
    pos += size + 1;
  }
  return out;
}

function githubBlobUrl(repoUrl, sha, path) {
  const m = /github\.com[/:]([^/]+)\/([^/.]+)(\.git)?\/?$/.exec(repoUrl || '');
  return m ? `https://github.com/${m[1]}/${m[2]}/blob/${sha}/${path}` : null;
}

function langFor(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return { js: 'js', mjs: 'js', ts: 'ts', php: 'php', yml: 'yaml', yaml: 'yaml', json: 'json', ini: 'ini', tpl: 'nginx', conf: 'nginx', sh: 'bash' }[ext] || '';
}

export function mapUrl(template, vars) {
  if (!template) return null;
  let url = renderTemplate(template, vars);
  url = url.replace(/\/index\.html$/, '/').replace(/\/index\/$/, '/').replace(/([^:])\/{2,}/g, '$1/');
  if (/\/\.html$/.test(url)) url = url.replace(/\/\.html$/, '/');
  return url;
}

/** Order hints from a nav file (e.g. livewire docs/__nav.md): page stems in order of appearance. */
export function orderFromNav(text, pagePaths) {
  const stems = new Map(pagePaths.map((p) => [p.replace(/\.md$/, '').split('/').pop(), p]));
  const order = [];
  for (const m of text.matchAll(/\(([^)\s]+)\)|\b([\w-]+)\.md\b|\/([\w-]+)\/?(?=[\s"')])/g)) {
    const target = (m[1] || m[2] || m[3] || '').replace(/\.md$/, '').replace(/[#?].*$/, '').replace(/\/$/, '').split('/').pop();
    const p = stems.get(target);
    if (p && !order.includes(p)) order.push(p);
  }
  return order;
}

/** Turn files of one commit into corpus pages. */
export function collectPages({ gitDir, sha, repoCfg, source, multi, commitDate, notes }) {
  const ls = runGit(['ls-tree', '-r', '--name-only', sha], { cwd: gitDir });
  if (!ls.ok) {
    notes.push(`${source.id}: cannot list ${sha}: ${ls.stderr.trim()}`);
    return { pages: [], order: [] };
  }
  const all = ls.stdout.split('\n').filter(Boolean);
  const root = repoCfg.root ? repoCfg.root + '/' : '';
  const selected = all.filter((p) => p.startsWith(root) && DOC_EXT.test(p) && isIncluded(p.slice(root.length), repoCfg.include, repoCfg.exclude));
  const alsoGlobs = source.also_index ?? [];
  const extras = alsoGlobs.length ? all.filter((p) => alsoGlobs.some((g) => globToRegExp(g).test(p))) : [];
  const orderFile = source.order_from && all.includes(source.order_from) ? [source.order_from] : [];
  const blobs = readBlobs(gitDir, sha, [...selected, ...extras, ...orderFile]);
  const headingStrips = (source.strip || []).filter((s) => s && s.heading).map((s) => s.heading);
  const prefix = multi ? `${repoCfg.name}/` : '';
  const pages = [];
  let rstNoted = false;
  for (const full of selected) {
    let text = blobs.get(full);
    if (text === undefined) continue;
    const rel = full.slice(root.length);
    const convert = repoCfg.convert ?? (/\.mdx$/i.test(full) ? 'mdx-strip' : /\.rst$/i.test(full) ? 'pandoc-rst' : null);
    if (convert === 'pandoc-rst' || /\.rst$/i.test(full)) {
      const r = convertRst(text);
      if (r.markdown === null) {
        if (!rstNoted) notes.push(`${source.id}: ${r.note}`);
        rstNoted = true;
        continue;
      }
      text = r.markdown;
    } else if (convert === 'vitepress') {
      text = stripVitepress(text);
    } else if (convert === 'mdx-strip') {
      text = stripMdx(text);
    }
    const { data, body } = parseFrontmatter(text, { stripHeadings: headingStrips });
    const relNoExt = rel.replace(DOC_EXT, '');
    const name = posix.basename(relNoExt);
    const vars = {
      path: name === 'index' ? posix.dirname(relNoExt).replace(/^\.$/, '') + '/index' : relNoExt,
      name,
      dir: rel.includes('/') ? rel.split('/')[0] : '',
      repo: repoCfg.name,
      ref: repoCfg.ref,
      sha,
    };
    const modified = data.date_modified ?? data.last_modified ?? data.lastUpdated ?? data.updated ?? commitDate;
    pages.push({
      path: `${prefix}${relNoExt}.md`,
      title: data.title ? String(data.title) : firstH1(body) ?? titleFromPath(rel),
      body,
      url: mapUrl(repoCfg.url_map ?? source.url_map, vars) ?? githubBlobUrl(repoCfg.repo, sha, full),
      upstream_modified: modified instanceof Date ? modified.toISOString() : modified ? String(modified) : null,
      extra: { ...(data.description ? { description: String(data.description) } : {}), upstream_sha: sha, upstream_path: full },
    });
  }
  for (const full of extras) {
    const content = blobs.get(full);
    if (content === undefined) continue;
    pages.push({
      path: `${prefix}_source/${full}.md`,
      title: full,
      body: `# ${full}\n\n\`\`\`${langFor(full)}\n${content.replace(/\n$/, '')}\n\`\`\`\n`,
      url: githubBlobUrl(repoCfg.repo, sha, full),
      upstream_modified: commitDate,
      extra: { upstream_sha: sha, upstream_path: full, kind: 'source-file' },
    });
  }
  const order = orderFile.length ? orderFromNav(blobs.get(orderFile[0]) ?? '', pages.map((p) => p.path)) : [];
  return { pages, order };
}

function commitDateOf(gitDir, sha) {
  const r = runGit(['log', '-1', '--format=%cI', sha], { cwd: gitDir });
  return r.ok ? r.stdout.trim() || null : null;
}

function repoKey(repoCfg, i) {
  return repoCfg.single ? '_' : repoCfg.name ?? String(i);
}

function refFor(source, resolved, repoCfg) {
  if (repoCfg.single || (source.ref && typeof source.ref === 'object')) return resolved.ref ?? repoCfg.ref;
  return repoCfg.ref ?? resolved.ref ?? 'main';
}

/** Upstream SHA per repo without fetching (used by status and the unchanged short-cut). */
export function remoteShas(source, resolved, { offline, notes }) {
  const out = {};
  source.repos.forEach((repoCfg, i) => {
    const key = repoKey(repoCfg, i);
    const ref = refFor(source, resolved, repoCfg);
    if (!networkAllowed(repoCfg.repo, offline)) {
      out[key] = { ref, sha: null, skipped: 'offline' };
      return;
    }
    let r = lsRemote(repoCfg.repo, ref);
    let usedRef = ref;
    if (!r.sha && !r.error) {
      const lower = nearestLowerTag(ref, listTags(repoCfg.repo));
      if (lower) {
        notes.push(`${source.id}: ref ${ref} not found upstream; using nearest lower tag ${lower}`);
        r = lsRemote(repoCfg.repo, lower);
        usedRef = lower;
      }
    }
    out[key] = { ref: usedRef, sha: r.sha, error: r.error ?? (r.sha ? null : `ref ${ref} not found`) };
  });
  return out;
}

export async function fetchSource({ source, resolved, prev, ctx }) {
  const notes = [];
  if (!source.repos?.length) return { ok: false, notes: [`${source.id}: git source without repo`] };
  const remote = remoteShas(source, resolved, { offline: ctx.offline, notes });
  for (const [key, r] of Object.entries(remote)) {
    if (r.skipped) return { ok: false, notes: [...notes, `${source.id}: offline, ${source.repos.find((x, i) => repoKey(x, i) === key)?.repo} not fetched`] };
    if (!r.sha) return { ok: false, notes: [...notes, `${source.id}: ${r.error}`] };
  }
  const prevRepos = prev?.upstream?.repos ?? {};
  const same = Object.entries(remote).every(([k, r]) => prevRepos[k]?.sha === r.sha);
  if (same && !ctx.force && prev && Object.keys(prev.pages ?? {}).length > 0) {
    return { ok: true, unchanged: true, upstream: prev.upstream, notes };
  }
  const multi = source.repos.length > 1 || !source.repos[0].single;
  const pages = [];
  const order = [];
  const upstream = { repos: {} };
  for (const [i, repoCfg] of source.repos.entries()) {
    const key = repoKey(repoCfg, i);
    const cacheDir = join(ctx.stateDir, 'cache', 'git', source.id, key);
    const f = shallowFetch(repoCfg.repo, remote[key].ref, cacheDir);
    if (!f.sha) return { ok: false, notes: [...notes, `${source.id}: fetch failed: ${f.error}`] };
    const got = collectPages({ gitDir: cacheDir, sha: f.sha, repoCfg, source, multi, commitDate: commitDateOf(cacheDir, f.sha), notes });
    pages.push(...got.pages);
    order.push(...got.order);
    upstream.repos[key] = { ref: remote[key].ref, sha: f.sha };
  }
  if (upstream.repos._) upstream.sha = upstream.repos._.sha;
  return { ok: true, pages, order, upstream, notes };
}

export async function checkUpstream({ source, resolved, entry, ctx }) {
  const notes = [];
  const remote = remoteShas(source, resolved, { offline: ctx.offline, notes });
  const changed = [];
  for (const [key, r] of Object.entries(remote)) {
    if (r.skipped) return { checked: false, detail: 'offline' };
    if (!r.sha) return { checked: false, detail: r.error };
    const was = entry?.upstream?.repos?.[key]?.sha;
    if (was !== r.sha) changed.push(`${key === '_' ? '' : key + ' '}${(was ?? 'none').slice(0, 7)} -> ${r.sha.slice(0, 7)}`);
  }
  return { checked: true, drift: changed.length > 0, detail: changed.join(', ') || 'up to date', notes };
}
