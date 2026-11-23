#!/usr/bin/env node
/**
 * sync-project-skills.mjs
 *
 * Copies the plugin skills into a project so assistants that do not load Claude Code plugins
 * (Cursor, Codex, Copilot, cloud sessions without the marketplace) can read them from the
 * repository.
 *
 *   node scripts/sync-project-skills.mjs [--to <dir>] [--plugin-root <dir>] [--include-gpl] [--check]
 *
 *   --to <dir>           target directory (default: .agents/skills in the current directory)
 *   --plugin-root <dir>  plugin to copy (default: this repository's root, the kivo-wise plugin);
 *                        for example plugins/kivo-creator or plugins/kivo-rebuild
 *   --include-gpl        also copy third-party/ skills (GPL-2.0-or-later)
 *   --check              write nothing; exit 1 and list the differences when the target is stale
 *
 * Besides the skill folders, the copy gets the plugin files the skills run from the plugin root
 * (RUNTIME below) in a hidden `.<plugin name>/` folder beside them, with the same relative paths,
 * so "the plugin root" of a copied skill is that folder.
 *
 * The target gets a manifest that records the plugin version, the source commit (and release tag
 * when HEAD has one), the skill list and every copied file. It holds no date, so a refresh from the
 * same source writes the same bytes. The manifest is GENERATED.md for kivo-wise and
 * GENERATED.<plugin name>.md for any other plugin, so several plugins can share one target.
 * Files in the target that the manifest does not list are never deleted. Top-level folders that
 * are neither this plugin's skills nor listed in its manifest are the project's own skills or
 * another plugin's: they are ignored by sync and --check (one `note: foreign skill kept: <name>`
 * line each).
 */

import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERATED = 'GENERATED.md';
const PRIMARY = 'kivo-wise';
const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.DS_Store', '.git']);
const MANIFEST_NAME = /^GENERATED(\.[^/]+)?\.md$/;

// Plugin-root paths (files or folders) that copied skills run. kivo-wise keeps its development
// scripts in scripts/ as well, so only the runtime ones are listed; other plugins ship scripts/
// and the schemas/ those scripts read.
const RUNTIME = {
  [PRIMARY]: ['scripts/detect-roots-project.mjs', 'scripts/inventory-project.mjs'],
  default: ['scripts', 'schemas'],
};

/** Manifest file name of a plugin inside a target. */
export function manifestName(plugin) {
  return plugin === PRIMARY ? GENERATED : `GENERATED.${plugin}.md`;
}

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

function skillFolders(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => !SKIP.has(n) && statSync(join(dir, n)).isDirectory())
    .sort();
}

export function pluginManifest(pluginRoot) {
  const manifest = join(pluginRoot, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifest)) throw new Error(`${pluginRoot} has no .claude-plugin/plugin.json`);
  return JSON.parse(readFileSync(manifest, 'utf8'));
}

/** Map of relative path -> Buffer for everything the plugin would install. */
export function collectSource(pluginRoot, includeGpl, plugin = pluginManifest(pluginRoot).name) {
  const files = new Map();
  const skills = [];
  const add = (root, kind) => {
    for (const name of skillFolders(root)) {
      skills.push({ name, kind });
      for (const rel of walk(join(root, name))) {
        files.set(`${name}/${rel}`, readFileSync(join(root, name, rel)));
      }
    }
  };
  add(join(pluginRoot, 'skills'), 'mit');
  if (includeGpl) add(join(pluginRoot, 'third-party'), 'gpl');
  const runtime = [];
  for (const entry of RUNTIME[plugin] || RUNTIME.default) {
    const full = join(pluginRoot, entry);
    if (!existsSync(full)) continue;
    const rels = statSync(full).isDirectory() ? walk(full).map((r) => `${entry}/${r}`) : [entry];
    for (const rel of rels) {
      if (/(^|\/)(__fixtures__|test)\/|\.test\.mjs$/.test(rel)) continue;
      runtime.push(rel);
      files.set(`.${plugin}/${rel}`, readFileSync(join(pluginRoot, rel)));
    }
  }
  return { files, skills, runtime, plugin };
}

export function pluginVersion(pluginRoot) {
  return pluginManifest(pluginRoot).version;
}

function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return r.status === 0 ? r.stdout.trim() : '';
}

/** Commit of the plugin checkout and its release tag for this plugin, when there is one. */
export function sourceRef(pluginRoot, plugin) {
  const commit = git(pluginRoot, ['rev-parse', 'HEAD']);
  if (!commit) return { commit: null, tag: null };
  const tags = git(pluginRoot, ['tag', '--points-at', 'HEAD']).split('\n')
    .filter((t) => t.startsWith(`${plugin}-v`)).sort();
  return { commit, tag: tags[0] || null };
}

function regenerateCommand(pluginRoot, plugin, includeGpl) {
  let root = '';
  if (plugin !== PRIMARY) {
    const rel = relative(PLUGIN_ROOT, pluginRoot);
    root = ` --plugin-root ${rel && !rel.startsWith('..') && !isAbsolute(rel) ? `<kivo-wise>/${rel.split(sep).join('/')}` : `<${plugin}>`}`;
  }
  return `node <kivo-wise>/scripts/sync-project-skills.mjs${root} --to <this directory>${includeGpl ? ' --include-gpl' : ''}`;
}

export function renderGenerated({
  plugin = PRIMARY, version, commit = null, tag = null, skills, files, runtime = [], includeGpl,
  command = regenerateCommand(PLUGIN_ROOT, plugin, includeGpl),
}) {
  const lines = [
    '# Generated skills',
    '',
    `Do not edit these files. They are copies of the ${plugin} plugin skills; regenerate them with:`,
    '',
    '```bash',
    command,
    '```',
    '',
    `- Source plugin: ${plugin}`,
    `- Source plugin version: ${version}`,
    `- Source commit: ${commit || 'unknown (the plugin root is not a git checkout)'}`,
    ...(tag ? [`- Source tag: ${tag}`] : []),
    `- Include GPL: ${includeGpl ? 'yes' : 'no'}`,
    `- Plugin root of the copied skills: \`.${plugin}/\` in this directory`,
    '',
    '## Skills',
    '',
    ...skills.map((s) => `- ${s.name}${s.kind === 'gpl' ? ' (GPL-2.0-or-later)' : ''}`),
    '',
    '## Plugin root files',
    '',
    'The skills run these from their plugin root, which is the hidden folder named above.',
    '',
    ...(runtime.length ? runtime.map((r) => `- ${r}`) : ['- none']),
    '',
    '## Files',
    '',
    ...[...files].sort().map((f) => `- \`${f}\``),
    '',
  ];
  return lines.join('\n');
}

export function parseGenerated(text) {
  const files = [];
  let inFiles = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) inFiles = line.trim() === '## Files';
    else if (inFiles) {
      const m = line.match(/^- `(.+)`$/);
      if (m) files.push(m[1]);
    }
  }
  return { files, includeGpl: /^- Include GPL: yes$/m.test(text) };
}

/** Compare the source with the target. Never touches the disk. */
export function diffTarget(source, targetDir) {
  const missing = [];
  const changed = [];
  const extra = [];
  const foreign = new Set();
  const own = manifestName(source.plugin || PRIMARY);
  const genPath = join(targetDir, own);
  const hasGenerated = existsSync(genPath);
  const listed = new Set(hasGenerated ? parseGenerated(readFileSync(genPath, 'utf8')).files : []);
  if (!hasGenerated) missing.push(own);
  for (const [rel, buf] of source.files) {
    const p = join(targetDir, rel);
    if (!existsSync(p)) missing.push(rel);
    else if (!readFileSync(p).equals(buf)) changed.push(rel);
  }
  // Top-level folders that belong to the sync: plugin skills and anything GENERATED.md listed.
  const owned = new Set([...source.files.keys(), ...listed].filter((r) => r.includes('/')).map((r) => r.split('/')[0]));
  if (existsSync(targetDir)) {
    for (const rel of walk(targetDir)) {
      const top = rel.split('/')[0];
      if (rel.includes('/') && !owned.has(top)) {
        foreign.add(top);
        continue;
      }
      // Another plugin's manifest at the top level belongs to that plugin's sync.
      if (!rel.includes('/') && MANIFEST_NAME.test(rel)) continue;
      if (!source.files.has(rel)) extra.push({ path: rel, listed: listed.has(rel) });
    }
  }
  return { missing, changed, extra, foreign: [...foreign].sort(), listed, hasGenerated };
}

/** Skill folders of this source that another plugin's manifest in the target already lists. */
export function conflicts(source, targetDir) {
  if (!existsSync(targetDir)) return [];
  const own = manifestName(source.plugin || PRIMARY);
  const mine = new Set([...source.files.keys()].map((r) => r.split('/')[0]));
  const out = [];
  for (const name of readdirSync(targetDir).sort()) {
    if (name === own || !MANIFEST_NAME.test(name)) continue;
    const tops = new Set(parseGenerated(readFileSync(join(targetDir, name), 'utf8')).files.map((r) => r.split('/')[0]));
    for (const top of [...tops].sort()) if (mine.has(top)) out.push({ folder: top, manifest: name });
  }
  return out;
}

export function isClean(d) {
  return !d.missing.length && !d.changed.length && !d.extra.length;
}

export function formatDiff(d) {
  const out = [];
  for (const f of d.missing) out.push(`missing  ${f}`);
  for (const f of d.changed) out.push(`changed  ${f}`);
  for (const e of d.extra) out.push(`extra    ${e.path}${e.listed ? '' : ' (not listed in GENERATED.md)'}`);
  return out;
}

export function sync({ pluginRoot = PLUGIN_ROOT, to, includeGpl = false, check = false }) {
  const root = resolve(pluginRoot);
  const targetDir = resolve(to);
  const { name: plugin, version } = pluginManifest(root);
  let gpl = includeGpl;
  const genPath = join(targetDir, manifestName(plugin));
  if (check && !includeGpl && existsSync(genPath)) gpl = parseGenerated(readFileSync(genPath, 'utf8')).includeGpl;

  const source = collectSource(root, gpl, plugin);
  const clash = conflicts(source, targetDir);
  if (clash.length) {
    throw new Error(clash.map((c) => `${c.folder} is already copied by ${c.manifest}`).join('; '));
  }
  const diff = diffTarget(source, targetDir);

  if (check) return { ok: isClean(diff), diff, written: 0, removed: [], kept: [] };

  mkdirSync(targetDir, { recursive: true });
  let written = 0;
  for (const [rel, buf] of source.files) {
    const p = join(targetDir, rel);
    if (existsSync(p) && readFileSync(p).equals(buf)) continue;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, buf);
    written++;
  }
  const removed = [];
  const kept = [];
  for (const e of diff.extra) {
    if (e.listed) {
      rmSync(join(targetDir, e.path));
      removed.push(e.path);
    } else kept.push(e.path);
  }
  for (const dir of skillFolders(targetDir)) pruneEmpty(join(targetDir, dir));
  writeFileSync(genPath, renderGenerated({
    plugin,
    version,
    ...sourceRef(root, plugin),
    skills: source.skills,
    files: [...source.files.keys()],
    runtime: source.runtime,
    includeGpl: gpl,
    command: regenerateCommand(root, plugin, gpl),
  }));
  return { ok: true, diff, written, removed, kept };
}

function pruneEmpty(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pruneEmpty(full);
  }
  if (!readdirSync(dir).length) rmSync(dir, { recursive: true });
}

function parseArgs(argv) {
  const opts = { to: join(process.cwd(), '.agents', 'skills'), pluginRoot: PLUGIN_ROOT, includeGpl: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--to') opts.to = argv[++i];
    else if (a.startsWith('--to=')) opts.to = a.slice(5);
    else if (a === '--plugin-root') opts.pluginRoot = argv[++i];
    else if (a.startsWith('--plugin-root=')) opts.pluginRoot = a.slice(14);
    else if (a === '--include-gpl') opts.includeGpl = true;
    else if (a === '--check') opts.check = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!opts.to) throw new Error('--to needs a directory');
  if (!opts.pluginRoot) throw new Error('--plugin-root needs a directory');
  return opts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const res = sync(opts);
    for (const name of res.diff.foreign) console.log(`note: foreign skill kept: ${name}`);
    if (opts.check) {
      if (res.ok) console.log(`${opts.to} is in sync with the plugin`);
      else {
        console.error(`${opts.to} differs from the plugin:`);
        for (const l of formatDiff(res.diff)) console.error(`  ${l}`);
        console.error('Regenerate with: node scripts/sync-project-skills.mjs --to <dir> (add the same --plugin-root)');
        process.exit(1);
      }
    } else {
      console.log(`synced ${opts.to}: ${res.written} file(s) written, ${res.removed.length} stale removed`);
      for (const k of res.kept) console.warn(`kept ${k} (not listed in ${GENERATED}, not deleted)`);
    }
  } catch (err) {
    console.error(`sync-project-skills: ${err.message}`);
    process.exit(2);
  }
}
