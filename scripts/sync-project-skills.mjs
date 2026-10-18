#!/usr/bin/env node
/**
 * sync-project-skills.mjs
 *
 * Copies the plugin skills into a project so assistants that do not load Claude Code plugins
 * (Cursor, Codex, Copilot) can read them from the repository.
 *
 *   node scripts/sync-project-skills.mjs [--to <dir>] [--include-gpl] [--check]
 *
 *   --to <dir>      target directory (default: .agents/skills in the current directory)
 *   --include-gpl   also copy third-party/ skills (GPL-2.0-or-later)
 *   --check         write nothing; exit 1 and list the differences when the target is stale
 *
 * The target gets a GENERATED.md that records the plugin version, the date, the skill list and
 * every copied file. Files in the target that GENERATED.md does not list are never deleted.
 * Top-level folders that are neither plugin skills nor listed in GENERATED.md are the project's own
 * skills: they are ignored by sync and --check (one `note: foreign skill kept: <name>` line each).
 */

import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERATED = 'GENERATED.md';
const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.DS_Store', '.git']);

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

/** Map of relative path -> Buffer for everything the plugin would install. */
export function collectSource(pluginRoot, includeGpl) {
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
  return { files, skills };
}

export function pluginVersion(pluginRoot) {
  const manifest = join(pluginRoot, '.claude-plugin', 'plugin.json');
  return JSON.parse(readFileSync(manifest, 'utf8')).version;
}

export function renderGenerated({ version, date, skills, files, includeGpl }) {
  const lines = [
    '# Generated skills',
    '',
    'Do not edit these files. They are copies of the kivo-wise plugin skills; regenerate them with:',
    '',
    '```bash',
    `node <kivo-wise>/scripts/sync-project-skills.mjs --to <this directory>${includeGpl ? ' --include-gpl' : ''}`,
    '```',
    '',
    `- Source plugin version: ${version}`,
    `- Generated: ${date}`,
    `- Include GPL: ${includeGpl ? 'yes' : 'no'}`,
    '',
    '## Skills',
    '',
    ...skills.map((s) => `- ${s.name}${s.kind === 'gpl' ? ' (GPL-2.0-or-later)' : ''}`),
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
  const genPath = join(targetDir, GENERATED);
  const hasGenerated = existsSync(genPath);
  const listed = new Set(hasGenerated ? parseGenerated(readFileSync(genPath, 'utf8')).files : []);
  if (!hasGenerated) missing.push(GENERATED);
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
      if (rel !== GENERATED && !source.files.has(rel)) extra.push({ path: rel, listed: listed.has(rel) });
    }
  }
  return { missing, changed, extra, foreign: [...foreign].sort(), listed, hasGenerated };
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

export function sync({ pluginRoot = PLUGIN_ROOT, to, includeGpl = false, check = false, now = new Date() }) {
  const targetDir = resolve(to);
  let gpl = includeGpl;
  const genPath = join(targetDir, GENERATED);
  if (check && !includeGpl && existsSync(genPath)) gpl = parseGenerated(readFileSync(genPath, 'utf8')).includeGpl;

  const source = collectSource(pluginRoot, gpl);
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
    version: pluginVersion(pluginRoot),
    date: now.toISOString().slice(0, 10),
    skills: source.skills,
    files: [...source.files.keys()],
    includeGpl: gpl,
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
  const opts = { to: join(process.cwd(), '.agents', 'skills'), includeGpl: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--to') opts.to = argv[++i];
    else if (a.startsWith('--to=')) opts.to = a.slice(5);
    else if (a === '--include-gpl') opts.includeGpl = true;
    else if (a === '--check') opts.check = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!opts.to) throw new Error('--to needs a directory');
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
        console.error('Regenerate with: node scripts/sync-project-skills.mjs --to <dir>');
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
