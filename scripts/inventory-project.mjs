#!/usr/bin/env node
// Read-only inventory of an Acorn application (sage theme, mu-plugin or project root).
// Zero dependencies. Prints one JSON document on stdout; never writes.
//
// Usage:
//   node scripts/inventory-project.mjs --app <path-to-acorn-app>
//   node scripts/inventory-project.mjs --theme-path <path>     (legacy alias of --app)
//
// <path-to-acorn-app> is the folder that holds app/, config/, resources/ and routes/:
//   sage-theme       -> the theme folder
//   acorn-mu-plugin  -> the plugin folder (apps[].path from detect-roots-project.mjs)
//   radicle-app      -> the project root
// Without --app the current directory is used.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';

const SKIP_DIRS = new Set(['vendor', 'node_modules', '.git', 'storage', 'build', 'dist', 'cache']);
const FILE_CAP = 5000;

function parseArgs(argv) {
  const out = { app: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--app' || a === '--theme-path' || a === '--path') out.app = argv[++i] ?? null;
    else if (a.startsWith('--app=')) out.app = a.slice(6);
    else if (a.startsWith('--theme-path=')) out.app = a.slice(13);
    else if (a.startsWith('--path=')) out.app = a.slice(7);
  }
  return out;
}

const { app: appArg } = parseArgs(process.argv.slice(2));
const appPath = resolve(appArg ?? process.cwd());
const notes = [];
let visited = 0;
let truncated = false;

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function rel(file) {
  return relative(appPath, file) || '.';
}

function readJson(file) {
  const text = readText(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    notes.push(`invalid JSON: ${rel(file)}`);
    return null;
  }
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

// Bounded recursive walk. `match(name, fullPath)` selects files.
function walk(dir, match, depth = 6) {
  const found = [];
  if (depth < 0 || !isDir(dir)) return found;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (visited >= FILE_CAP) {
      truncated = true;
      return found;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...walk(full, match, depth - 1));
    } else if (entry.isFile()) {
      visited++;
      if (match(entry.name, full)) found.push(full);
    }
  }
  return found;
}

const phpFiles = (dir) => walk(dir, (n) => extname(n) === '.php');

function classNameOf(file) {
  const src = readText(file);
  if (!src) return null;
  const ns = src.match(/^\s*namespace\s+([\w\\]+)\s*;/m);
  const cls = src.match(/^\s*(?:abstract\s+|final\s+)*(?:class|trait|interface)\s+(\w+)/m);
  if (!cls) return null;
  return ns ? `${ns[1]}\\${cls[1]}` : cls[1];
}

function classesIn(dir) {
  return phpFiles(join(appPath, dir)).map(classNameOf).filter(Boolean).sort();
}

// composer.json of the app, or the nearest parent (up to 3 levels up).
function findComposer() {
  let dir = appPath;
  for (let i = 0; i < 4; i++) {
    const file = join(dir, 'composer.json');
    if (existsSync(file)) return { file, json: readJson(file) };
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { file: null, json: null };
}

function namespaceOf(composer) {
  const psr4 = composer?.autoload?.['psr-4'];
  if (!psr4) return null;
  for (const [ns, target] of Object.entries(psr4)) {
    const targets = Array.isArray(target) ? target : [target];
    if (targets.some((t) => String(t).replace(/\/$/, '') === 'app')) return ns;
  }
  return Object.keys(psr4)[0] ?? null;
}

// FQCNs written as Foo\Bar::class (leading backslash allowed).
function classRefs(text) {
  const refs = [];
  for (const m of text.matchAll(/\\?([A-Za-z_][\w\\]*)::class/g)) refs.push(m[1]);
  return [...new Set(refs)];
}

// Text inside the first bracket that follows `marker`, balanced on [] and ().
function balancedAfter(text, marker) {
  const at = text.indexOf(marker);
  if (at === -1) return null;
  const rest = text.slice(at + marker.length);
  const open = rest.search(/[[(]/);
  if (open === -1) return null;
  const start = at + marker.length + open;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') {
      depth--;
      if (depth === 0) return text.slice(start + 1, i);
    }
  }
  return text.slice(start + 1);
}

function findProviders(composer, composerFile) {
  const sources = [];

  // 1. composer.json extra.acorn.providers (package discovery; usual on a project-root app)
  const extra = composer?.extra?.acorn?.providers;
  if (Array.isArray(extra) && extra.length) {
    sources.push({ source: 'composer-extra', file: composerFile ? rel(composerFile) : 'composer.json', list: extra });
  }

  // 2. config/app.php 'providers' => [...]
  const configApp = join(appPath, 'config', 'app.php');
  const configText = readText(configApp);
  if (configText) {
    const body = balancedAfter(configText, "'providers'") ?? balancedAfter(configText, '"providers"');
    const list = body ? classRefs(body) : [];
    if (list.length) sources.push({ source: 'config/app.php', file: rel(configApp), list });
  }

  // 3. A configurator or entry file calling ->withProviders([...])
  const candidates = [
    ...phpFiles(join(appPath, 'app')),
    ...phpFiles(join(appPath, 'bootstrap')),
    ...readdirSafe(appPath).filter((n) => extname(n) === '.php').map((n) => join(appPath, n)),
  ];
  for (const file of candidates) {
    const text = readText(file);
    if (!text || !text.includes('withProviders')) continue;
    const body = balancedAfter(text, 'withProviders');
    const list = body ? classRefs(body) : [];
    if (list.length) {
      const name = rel(file);
      sources.push({ source: name === 'functions.php' ? 'functions.php' : 'configurator', file: name, list });
    }
  }

  const onDisk = classesIn('app/Providers').filter((c) => /Provider$/.test(c));
  const registered = [...new Set(sources.flatMap((s) => s.list))];
  const short = (c) => c.split('\\').pop();
  const registeredShort = new Set(registered.map(short));

  return {
    source: sources[0]?.source ?? (onDisk.length ? 'disk-only' : 'none'),
    sources: sources.map(({ source, file, list }) => ({ source, file, count: list.length })),
    registered,
    onDisk,
    unregisteredOnDisk: sources.length ? onDisk.filter((c) => !registeredShort.has(short(c))) : onDisk,
  };
}

// Top-level keys under 'post' (poet) / 'post_types' (acorn-post-types) and 'taxonomy' / 'taxonomies'.
function parsePostTypeConfig(file) {
  const text = readText(file);
  const postTypes = [];
  const taxonomies = [];
  if (!text) return null;
  let mode = null;
  for (const line of text.split('\n')) {
    if (/['"](?:post|post_types)['"]\s*=>/.test(line)) { mode = 'post'; continue; }
    if (/['"](?:taxonomy|taxonomies)['"]\s*=>/.test(line)) { mode = 'taxonomy'; continue; }
    if (/['"](?:admin_sidebar|block_category|block_pattern|block)['"]\s*=>/.test(line)) { mode = null; continue; }
    const key = line.match(/^(?: {8}|\t{2})['"]([\w-]+)['"]\s*=>/);
    if (key && mode === 'post') postTypes.push(key[1]);
    if (key && mode === 'taxonomy') taxonomies.push(key[1]);
  }
  return { file: rel(file), postTypes, taxonomies };
}

function postTypes() {
  const poet = parsePostTypeConfig(join(appPath, 'config', 'poet.php'));
  const acornPostTypes = parsePostTypeConfig(join(appPath, 'config', 'post-types.php'));
  const postTypeClasses = classesIn('app/PostTypes');
  const taxonomyClasses = classesIn('app/Taxonomies');
  const has = (c) => c && (c.postTypes.length || c.taxonomies.length);
  let mechanism = 'none';
  if (has(acornPostTypes)) mechanism = 'acorn-post-types';
  else if (has(poet)) mechanism = 'poet';
  else if (postTypeClasses.length || taxonomyClasses.length) mechanism = 'classes';
  return { mechanism, poet, acornPostTypes, postTypeClasses, taxonomyClasses };
}

function blocks(composer) {
  const req = { ...(composer?.require ?? {}) };
  const acfComposerClasses = classesIn('app/Blocks');
  const nativeBlockJson = walk(appPath, (n) => n === 'block.json').map((f) => ({
    file: rel(f),
    name: readJson(f)?.name ?? null,
  }));
  const bladeDir = join(appPath, 'resources', 'views', 'blocks');
  const bladeBlockViews = walk(bladeDir, (n) => n.endsWith('.blade.php')).length;
  let mechanism = 'none';
  if (req['log1x/acf-composer'] && acfComposerClasses.length) mechanism = 'acf-composer';
  else if (nativeBlockJson.length) mechanism = 'native';
  else if (acfComposerClasses.length) mechanism = 'classes-unknown-base';
  return { mechanism, acfComposerClasses, nativeBlockJson, bladeBlockViews };
}

function routes() {
  const count = (name) => {
    const text = readText(join(appPath, 'routes', name));
    return text === null ? null : (text.match(/Route::/g) || []).length;
  };
  return { web: count('web.php'), api: count('api.php'), files: readdirSafe(join(appPath, 'routes')) };
}

function views() {
  const dir = join(appPath, 'resources', 'views');
  const all = walk(dir, (n) => n.endsWith('.blade.php'));
  const tally = { total: all.length, layouts: 0, partials: 0, components: 0, blocks: 0, other: 0 };
  for (const v of all) {
    const r = relative(dir, v);
    if (r.startsWith('layouts')) tally.layouts++;
    else if (r.startsWith('partials') || r.includes('/_')) tally.partials++;
    else if (r.startsWith('components')) tally.components++;
    else if (r.startsWith('blocks')) tally.blocks++;
    else tally.other++;
  }
  return tally;
}

const KEY_PACKAGES = [
  'roots/acorn', 'roots/acorn-post-types', 'roots/acorn-ai', 'roots/wordpress', 'log1x/acf-composer', 'log1x/poet',
  'livewire/livewire', 'laravel/ai', 'wordpress/mcp-adapter', 'pestphp/pest', 'phpunit/phpunit', 'laravel/pint',
  'carthage-software/mago', 'phpstan/phpstan',
];

function packages(composer) {
  const all = { ...(composer?.require ?? {}), ...(composer?.['require-dev'] ?? {}) };
  const out = {};
  for (const name of KEY_PACKAGES) if (all[name]) out[name] = all[name];
  return out;
}

if (!isDir(appPath)) {
  console.log(JSON.stringify({ app: appPath, error: 'app path is not a directory', notes: [`not a directory: ${appPath}`] }, null, 2));
  process.exit(0);
}

const { file: composerFile, json: composer } = findComposer();

const inventory = {
  tool: { name: 'inventory-project', version: '3.0.0' },
  app: appPath,
  composerJson: composerFile ? relative(appPath, composerFile) || 'composer.json' : null,
  namespace: namespaceOf(composer),
  packages: packages(composer),
  providers: findProviders(composer, composerFile),
  blocks: blocks(composer),
  postTypes: postTypes(),
  fields: classesIn('app/Fields'),
  options: classesIn('app/Options'),
  components: classesIn('app/View/Components'),
  composers: classesIn('app/View/Composers'),
  livewire: classesIn('app/Livewire'),
  commands: classesIn('app/Console/Commands'),
  models: classesIn('app/Models'),
  routes: routes(),
  views: views(),
  migrations: walk(join(appPath, 'database', 'migrations'), (n) => extname(n) === '.php').length,
  notes,
  truncated,
};

console.log(JSON.stringify(inventory, null, 2));
