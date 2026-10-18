// `docs-brain status [--check]`: project drift (locks vs lock.json) and upstream drift per source.
import { fetcherFor } from './fetchers/registry.mjs';
import { Http } from './http.mjs';
import { readLock, stateDirFor } from './lock.mjs';
import { printNotes } from './cli.mjs';
import { versionLabel } from './update.mjs';
import { formatTable } from './util.mjs';

export async function runStatus(ctx) {
  printNotes(ctx.notes);
  if (!ctx.manifest) return 1;
  if (ctx.roots.length === 0) {
    console.error('note: no corpus roots (pass --corpus or set roots[] in .docs-brain.json)');
    return 1;
  }
  const offline = Boolean(ctx.opts.offline);
  let drift = 0;
  const wanted = ctx.cfg.sources;
  for (const root of ctx.roots) {
    const lock = readLock(stateDirFor(root, ctx.manifest));
    console.log(`root ${root}`);
    const rows = [];
    for (const source of ctx.manifest.sources) {
      const resolved = ctx.resolved.find((r) => r.id === source.id);
      const entry = lock.sources[source.id];
      if (!entry) {
        const counts = wanted?.includes(source.id);
        if (counts) drift++;
        if (counts || !wanted) rows.push([source.id, '-', versionLabel(resolved), 0, '-', counts ? 'missing (run update)' : 'not fetched', '']);
        continue;
      }
      const project = [];
      const want = resolved.version === null && resolved.strategy === 'record-sha' ? entry.version : versionLabel(resolved);
      if (!resolved.note && want !== entry.version) project.push(`corpus ${entry.version}, project ${want}`);
      if (resolved.installed && entry.installed && resolved.installed !== entry.installed && project.length === 0) {
        project.push(`installed ${entry.installed} -> ${resolved.installed} (same docs version)`);
      }
      const projectDrift = !resolved.note && want !== entry.version;
      if (projectDrift) drift++;
      let upstream = 'skipped (offline)';
      if (!offline) {
        const fetcher = await fetcherFor(source.type);
        const http = new Http({ offline, userAgent: source.user_agent, politenessMs: 0 });
        try {
          const r = fetcher?.checkUpstream ? await fetcher.checkUpstream({ source, resolved, entry, ctx: { offline, http } }) : { checked: false, detail: 'n/a' };
          printNotes(r.notes ?? []);
          if (r.checked && r.drift) {
            drift++;
            upstream = `upstream changed: ${r.detail}`;
          } else {
            upstream = r.checked ? r.detail : `not checked (${r.detail})`;
          }
        } catch (e) {
          upstream = `not checked (${e.message})`;
        }
      } else if (source.type === 'git' || source.type === 'local-git') {
        // git checks need no network for local repos: run them anyway.
        const fetcher = await fetcherFor(source.type);
        const r = await fetcher.checkUpstream({ source, resolved, entry, ctx: { offline } });
        if (r.checked && r.drift) {
          drift++;
          upstream = `upstream changed: ${r.detail}`;
        } else if (r.checked) {
          upstream = r.detail;
        }
      }
      rows.push([
        source.id,
        entry.version,
        want,
        entry.page_count ?? Object.keys(entry.pages ?? {}).length,
        entry.last_sync ?? '-',
        project.length ? `project: ${project.join('; ')}` : 'project ok',
        upstream,
      ]);
    }
    console.log(formatTable(['source', 'corpus', 'project', 'pages', 'last sync', 'project drift', 'upstream'], rows));
    console.log('');
  }
  console.log(drift ? `${drift} drift item(s)` : 'no drift');
  return ctx.opts.check && drift > 0 ? 1 : 0;
}
