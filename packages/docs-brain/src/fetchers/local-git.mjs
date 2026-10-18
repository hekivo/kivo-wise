// local-git sources: a checkout on disk (e.g. a licensed fork); refresh = `git fetch <remote>` when online.
import { existsSync } from 'node:fs';
import { collectPages, runGit } from './git.mjs';
import { expandHome } from '../util.mjs';

function resolveRef(dir, ref, { offline, notes, id }) {
  const remote = ref.includes('/') ? ref.split('/')[0] : null;
  if (remote && !offline) {
    const f = runGit(['fetch', '-q', remote], { cwd: dir });
    if (!f.ok) notes.push(`${id}: git fetch ${remote} failed (${f.stderr.trim().split('\n').pop()}); using the local ref`);
  }
  const r = runGit(['rev-parse', '--verify', `${ref}^{commit}`], { cwd: dir });
  return r.ok ? r.stdout.trim() : null;
}

export async function fetchSource({ source, resolved, prev, ctx }) {
  const notes = [];
  const repoCfg = source.repos?.[0];
  const dir = expandHome(source.path ?? repoCfg?.path ?? '');
  if (!dir || !existsSync(dir)) return { ok: false, notes: [`${source.id}: local path ${source.path} not found; skipped`] };
  const ref = typeof source.ref === 'string' ? source.ref : resolved.ref ?? 'HEAD';
  const sha = resolveRef(dir, ref, { offline: ctx.offline, notes, id: source.id });
  if (!sha) return { ok: false, notes: [...notes, `${source.id}: ref ${ref} not found in ${dir}`] };
  if (prev?.upstream?.sha === sha && !ctx.force && Object.keys(prev.pages ?? {}).length > 0) {
    return { ok: true, unchanged: true, upstream: prev.upstream, notes };
  }
  const date = runGit(['log', '-1', '--format=%cI', sha], { cwd: dir });
  const got = collectPages({
    gitDir: dir,
    sha,
    repoCfg: { ...repoCfg, repo: null, name: null, single: true },
    source,
    multi: false,
    commitDate: date.ok ? date.stdout.trim() : null,
    notes,
  });
  return { ok: true, pages: got.pages, order: got.order, upstream: { sha, ref, repos: { _: { sha, ref } } }, notes };
}

export async function checkUpstream({ source, resolved, entry, ctx }) {
  const dir = expandHome(source.path ?? '');
  if (!dir || !existsSync(dir)) return { checked: false, detail: `path ${source.path} not found` };
  const notes = [];
  const ref = typeof source.ref === 'string' ? source.ref : resolved.ref ?? 'HEAD';
  const sha = resolveRef(dir, ref, { offline: ctx.offline, notes, id: source.id });
  if (!sha) return { checked: false, detail: `ref ${ref} not found` };
  const was = entry?.upstream?.sha;
  return { checked: true, drift: was !== sha, detail: was === sha ? 'up to date' : `${(was ?? 'none').slice(0, 7)} -> ${sha.slice(0, 7)}`, notes };
}
