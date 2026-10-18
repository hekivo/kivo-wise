// Command-line front end: argument parsing, context resolution, dispatch.
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { loadManifest } from './manifest.mjs';
import { formatResolveTable, loadProjectConfig, readProjectVersions, resolveSources } from './resolve.mjs';
import { expandHome } from './util.mjs';
export { stateDirFor } from './lock.mjs';

const USAGE = `docs-brain <command> [options]

Commands
  resolve                 print the version table (project locks -> doc refs)
  update [id...]          fetch sources incrementally and write the corpus
  status                  project drift vs lock.json and upstream drift per source
  search <query>          grep the corpus (rg when available, JS scan otherwise)
  export-llms             print llms.txt for redistributable pages only

Options
  --project <dir>         project with .docs-brain.json / lock files (default: cwd)
  --corpus <dir>          corpus root to write/read (default: first root of .docs-brain.json)
  --manifest <file>       sources.yaml (default: <corpus>/../sources.yaml or .docs-brain.json "manifest")
  --dry-run               update: list what would change, write nothing
  --force                 update: refetch even when upstream is unchanged
  --offline               never touch the network (notes instead of fetches)
  --check                 status: exit 1 on any drift
  --source <id>           search: limit to one source
  --limit <n>             search: max hits (default 20)
  --regex                 search: treat the query as a regular expression
  --out <file>            export-llms: write to a file instead of stdout
  --json                  machine-readable output where supported
  -h, --help              this help
`;

const BOOL_FLAGS = new Set(['dry-run', 'force', 'offline', 'check', 'json', 'help', 'h', 'no-rg', 'full', 'verbose']);

export function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      opts._.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (eq > 0) opts[key] = a.slice(eq + 1);
      else if (BOOL_FLAGS.has(key)) opts[key] = true;
      else opts[key] = argv[++i];
    } else if (a === '-h') {
      opts.help = true;
    } else {
      opts._.push(a);
    }
  }
  return opts;
}

/** Locate sources.yaml for a corpus root. */
export function findManifestFile(opts, cfg, corpusDir) {
  const candidates = [];
  if (opts.manifest) candidates.push(resolve(expandHome(opts.manifest)));
  if (cfg?.manifest) candidates.push(cfg.manifest);
  if (corpusDir) {
    candidates.push(join(dirname(corpusDir), 'sources.yaml'));
    candidates.push(join(corpusDir, 'sources.yaml'));
  }
  candidates.push(resolve(process.cwd(), 'sources.yaml'));
  return candidates.find((c) => existsSync(c)) ?? null;
}

/** Build the shared context: project config, versions, roots, manifest. */
export function buildContext(opts) {
  const notes = [];
  const cfg = loadProjectConfig(opts.project);
  notes.push(...cfg.notes);
  const roots = [];
  if (opts.corpus) roots.push(resolve(expandHome(opts.corpus)));
  roots.push(...cfg.roots.filter((r) => !roots.includes(r)));
  const manifestFile = findManifestFile(opts, cfg, roots[0]);
  let manifest = null;
  if (manifestFile) {
    manifest = loadManifest(manifestFile);
    notes.push(...manifest.notes.map((n) => `sources.yaml: ${n}`));
  } else {
    notes.push('sources.yaml not found (pass --manifest or set "manifest" in .docs-brain.json)');
  }
  const versions = readProjectVersions(cfg.dir, cfg);
  if (versions.missing.length) notes.push(`lock files listed but missing: ${versions.missing.join(', ')}`);
  const resolved = manifest ? resolveSources(manifest, versions) : [];
  return { opts, cfg, roots, manifest, manifestFile, versions, resolved, notes };
}

export function printNotes(notes, stream = console.error) {
  for (const n of notes) stream(`note: ${n}`);
}

export async function main(argv) {
  const opts = parseArgs(argv);
  const [command, ...rest] = opts._;
  if (!command || opts.help || opts.h) {
    console.log(USAGE);
    return command ? 0 : 1;
  }
  switch (command) {
    case 'resolve': {
      const ctx = buildContext(opts);
      printNotes(ctx.notes);
      if (!ctx.manifest) return 1;
      if (opts.json) {
        console.log(JSON.stringify({ project: ctx.cfg.dir, lockFiles: ctx.versions.files, sources: ctx.resolved }, null, 2));
      } else {
        console.log(`project: ${ctx.cfg.dir}`);
        console.log(`locks:   ${ctx.versions.files.length ? ctx.versions.files.join(', ') : '(none found)'}`);
        console.log(`roots:   ${ctx.roots.length ? ctx.roots.join(', ') : '(none; pass --corpus)'}`);
        console.log('');
        console.log(formatResolveTable(ctx.resolved));
      }
      return 0;
    }
    case 'update': {
      const { runUpdate } = await import('./update.mjs');
      return runUpdate(buildContext(opts), rest);
    }
    case 'status': {
      const { runStatus } = await import('./status.mjs');
      return runStatus(buildContext(opts));
    }
    case 'search': {
      const { runSearch } = await import('./search.mjs');
      return runSearch(buildContext(opts), rest.join(' '));
    }
    case 'export-llms': {
      const { runExportLlms } = await import('./index.mjs');
      return runExportLlms(buildContext(opts));
    }
    default:
      console.error(`unknown command "${command}"\n`);
      console.log(USAGE);
      return 1;
  }
}
