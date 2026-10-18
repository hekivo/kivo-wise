#!/usr/bin/env node
/**
 * detect-roots-project.mjs — classify a WordPress checkout on the Roots stack.
 *
 * Prints one JSON document (contract C1, schema in
 * skills/roots-triage/references/triage.schema.json) describing:
 *   - layout:  radicle | bedrock | composer-wordpress | plain-wordpress | unknown
 *   - apps[]:  every Acorn application (sage-theme, acorn-theme, acorn-mu-plugin,
 *              acorn-plugin, radicle-app, acorn-unknown) with namespace, boot,
 *              providers, blocks, post types and locked versions
 *   - runtime: Lando (merged .lando*.yml) or DDEV, with derived runner commands
 *   - flag:    .roots-stack.json or composer.json extra.roots-stack (wins over heuristics)
 *
 * Usage:
 *   node scripts/detect-roots-project.mjs [--path=<dir>] [--format=json|text]
 *
 * Zero dependencies. Never throws, never exits non-zero: anything that cannot
 * be read becomes null plus an entry in `notes`. The walk is bounded (depth 4,
 * 5,000 files) and reports `truncated: true` when the bound is hit.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TOOL = { name: 'detect-roots-project', version: '3.0.0' };

const MAX_FILES = 5000;
const MAX_DEPTH = 4;
const MAX_APP_PHP = 400;
const MAX_FILE_BYTES = 256 * 1024;
const SKIP_DIRS = new Set([
  'vendor', 'node_modules', '.git', 'storage', 'build', 'dist', 'uploads', 'cache',
  'languages', 'upgrade', '.worktrees', 'wp-includes', 'wp-admin',
]);
const APP_PACKAGES = [
  'roots/acorn', 'livewire/livewire', 'log1x/acf-composer', 'log1x/poet',
  'roots/acorn-post-types', 'johnbillion/extended-cpts', 'roots/acorn-ai',
  'wordpress/mcp-adapter', 'log1x/navi', 'log1x/sage-directives',
];
const SITE_PACKAGES = [
  'roots/wordpress', 'johnpbloch/wordpress', 'wpengine/advanced-custom-fields-pro',
  'wpackagist-plugin/advanced-custom-fields', 'wpackagist-plugin/advanced-custom-fields-pro',
];
const PROFILES = ['sage-theme', 'acorn-mu-plugin', 'radicle-app'];
const KIND_PRECEDENCE = ['acorn-mu-plugin', 'radicle-app', 'sage-theme', 'acorn-theme', 'acorn-plugin', 'acorn-unknown'];
const LANDO_FILES = ['.lando.base.yml', '.lando.dist.yml', '.lando.upstream.yml', '.lando.yml', '.lando.local.yml'];

// ---------------------------------------------------------------------------
// Small filesystem helpers (all swallow errors; absence is a value here)
// ---------------------------------------------------------------------------

const toPosix = (p) => p.split(sep).join('/');
const rel = (root, p) => toPosix(relative(root, p)) || '.';

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function readText(p) {
  try {
    if (statSync(p).size > MAX_FILE_BYTES) return readFileSync(p, 'utf8').slice(0, MAX_FILE_BYTES);
    return readFileSync(p, 'utf8');
  } catch { return null; }
}

function readJson(p, notes, root) {
  let text;
  try { text = readFileSync(p, 'utf8'); } catch { return null; }
  if (text === null) return null;
  try { return JSON.parse(text); } catch (e) {
    notes?.push(`invalid JSON in ${rel(root, p)}: ${e.message}`);
    return null;
  }
}

function listPhp(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.php'))
      .slice(0, 40)
      .map((e) => ({ path: join(dir, e.name), name: e.name, text: readText(join(dir, e.name)) ?? '' }));
  } catch { return []; }
}

function walkPhp(dir, max = MAX_APP_PHP) {
  const out = [];
  const queue = [dir];
  while (queue.length && out.length < max) {
    const d = queue.shift();
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) queue.push(join(d, e.name)); continue; }
      if (e.isFile() && e.name.endsWith('.php')) {
        out.push({ path: join(d, e.name), name: e.name, text: readText(join(d, e.name)) ?? '' });
        if (out.length >= max) break;
      }
    }
  }
  return out;
}

function stripV(v) { return typeof v === 'string' ? v.replace(/^v(?=\d)/, '') : v; }

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(v ?? ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

function semverLt(a, b) {
  const x = parseSemver(a); const y = parseSemver(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
}

// ---------------------------------------------------------------------------
// YAML subset parser (enough for landofiles and wp-cli.yml)
//   top-level keys, nested maps by indentation, scalars, `- item` lists,
//   lists of single-key maps, quoted strings, `|`/`>` block scalars kept as
//   opaque strings, `#` comments. Anchors, flow collections and multi-document
//   streams are not supported: callers catch the error and add a note.
// ---------------------------------------------------------------------------

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function scalar(raw) {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
    return v.slice(1, -1);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((s) => scalar(s));
  }
  return v;
}

function splitKey(text) {
  const quoted = /^(['"])(.*?)\1\s*:\s*(.*)$/.exec(text);
  if (quoted) return { key: quoted[2], value: quoted[3].trim() };
  const idx = text.indexOf(': ');
  if (idx !== -1) return { key: text.slice(0, idx).trim(), value: text.slice(idx + 2).trim() };
  if (text.endsWith(':')) return { key: text.slice(0, -1).trim(), value: '' };
  throw new Error(`cannot parse "${text}" as key: value`);
}

function looksLikeKey(text) {
  if (/^['"]/.test(text)) return /^(['"]).*?\1\s*:(\s|$)/.test(text);
  if (/^[\[{]/.test(text)) return false;
  return text.includes(': ') || text.endsWith(':');
}

export function parseYamlSubset(text) {
  const raw = String(text ?? '').split(/\r?\n/);
  let pos = 0;
  const indentOf = (line) => line.search(/\S/);
  const isBlank = (line) => stripComment(line).trim() === '';

  function next() {
    while (pos < raw.length && isBlank(raw[pos])) pos++;
    return pos < raw.length ? raw[pos] : null;
  }

  function parseBlock() {
    const line = next();
    if (line === null) return null;
    const indent = indentOf(line);
    const text = stripComment(line).trim();
    return text === '-' || text.startsWith('- ') ? parseList(indent) : parseMap(indent);
  }

  function parseMap(indent) {
    const obj = {};
    for (;;) {
      const line = next();
      if (line === null) break;
      const li = indentOf(line);
      if (li < indent) break;
      if (li > indent) throw new Error(`unexpected indentation at line ${pos + 1}`);
      const text = stripComment(line).trim();
      if (text === '-' || text.startsWith('- ')) break;
      const { key, value } = splitKey(text);
      pos++;
      obj[key] = parseValue(value, indent);
    }
    return obj;
  }

  function parseValue(value, indent) {
    if (value === '') {
      const line = next();
      if (line === null) return null;
      const li = indentOf(line);
      const text = stripComment(line).trim();
      if (li > indent) return parseBlock();
      if (li === indent && (text === '-' || text.startsWith('- '))) return parseList(li);
      return null;
    }
    if (/^[|>][-+]?$/.test(value)) return parseBlockScalar(indent);
    return scalar(value);
  }

  function parseBlockScalar(indent) {
    const parts = [];
    while (pos < raw.length) {
      const line = raw[pos];
      if (line.trim() === '') { pos++; continue; }
      if (indentOf(line) <= indent) break;
      parts.push(line.trim());
      pos++;
    }
    return parts.join(' ');
  }

  function parseList(indent) {
    const arr = [];
    for (;;) {
      const line = next();
      if (line === null) break;
      if (indentOf(line) !== indent) break;
      const text = stripComment(line).trim();
      if (!(text === '-' || text.startsWith('- '))) break;
      const rest = text.slice(1).trim();
      pos++;
      if (rest === '') { arr.push(parseBlock()); continue; }
      if (!looksLikeKey(rest)) { arr.push(scalar(rest)); continue; }
      const keyIndent = indent + 2;
      const { key, value } = splitKey(rest);
      const item = { [key]: parseValue(value, keyIndent) };
      for (;;) {
        const more = next();
        if (more === null || indentOf(more) !== keyIndent) break;
        const t = stripComment(more).trim();
        if (t === '-' || t.startsWith('- ')) break;
        const kv = splitKey(t);
        pos++;
        item[kv.key] = parseValue(kv.value, keyIndent);
      }
      arr.push(item);
    }
    return arr;
  }

  const doc = parseBlock();
  if (next() !== null) throw new Error(`unparsed content at line ${pos + 1}`);
  return doc && typeof doc === 'object' && !Array.isArray(doc) ? doc : {};
}

function deepMerge(base, extra) {
  if (Array.isArray(base) && Array.isArray(extra)) return [...new Set([...base, ...extra])];
  if (base && extra && typeof base === 'object' && typeof extra === 'object' && !Array.isArray(base) && !Array.isArray(extra)) {
    const out = { ...base };
    for (const [k, v] of Object.entries(extra)) out[k] = k in out ? deepMerge(out[k], v) : v;
    return out;
  }
  return extra === undefined ? base : extra;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const ACORN_BASEPATH_RE = /define\(\s*['"]ACORN_BASEPATH['"]/;

function requires(composer, pkg) {
  return composer?.require?.[pkg] ?? composer?.['require-dev']?.[pkg] ?? null;
}

function contentDirFromInstallerPaths(composer) {
  const paths = composer?.extra?.['installer-paths'] ?? {};
  for (const [path, types] of Object.entries(paths)) {
    if ([].concat(types).includes('type:wordpress-theme')) {
      const m = /^(.*?)\/themes\//.exec(path);
      if (m) return m[1];
    }
  }
  return null;
}

function detectLayout(root, composer) {
  const installDir = typeof composer?.extra?.['wordpress-install-dir'] === 'string' ? composer.extra['wordpress-install-dir'] : null;
  const bedrockApp = readText(join(root, 'bedrock', 'application.php'));
  if (bedrockApp && ACORN_BASEPATH_RE.test(bedrockApp)) {
    const publicConfig = readText(join(root, 'public', 'wp-config.php')) ?? '';
    if (publicConfig.includes('bedrock/application.php') || (installDir && installDir.startsWith('public/'))) {
      return { layout: 'radicle', coreDir: installDir ?? 'public/wp', contentDir: 'public/content', bedrockApp };
    }
  }
  const webConfig = readText(join(root, 'web', 'wp-config.php'));
  if (existsSync(join(root, 'config', 'application.php')) && webConfig && webConfig.includes('config/application.php')) {
    return { layout: 'bedrock', coreDir: installDir ?? 'web/wp', contentDir: contentDirFromInstallerPaths(composer) ?? 'web/app', bedrockApp: null };
  }
  if (composer && (requires(composer, 'roots/wordpress') || requires(composer, 'johnpbloch/wordpress') || installDir)) {
    return { layout: 'composer-wordpress', coreDir: installDir, contentDir: contentDirFromInstallerPaths(composer) ?? 'wp-content', bedrockApp: null };
  }
  const wpConfig = readText(join(root, 'wp-config.php'));
  if (wpConfig && /DB_NAME/.test(wpConfig) && existsSync(join(root, 'wp-includes', 'version.php'))) {
    return { layout: 'plain-wordpress', coreDir: '.', contentDir: 'wp-content', bedrockApp: null };
  }
  return { layout: 'unknown', coreDir: null, contentDir: null, bedrockApp: null };
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

function lockedVersions(dir, composer, packages, notes, root) {
  const lockPath = join(dir, 'composer.lock');
  const lock = existsSync(lockPath) ? readJson(lockPath, notes, root) : null;
  const installed = new Map();
  for (const pkg of [...(lock?.packages ?? []), ...(lock?.['packages-dev'] ?? [])]) {
    if (pkg?.name && pkg?.version) installed.set(pkg.name, stripV(pkg.version));
  }
  const versions = {};
  for (const name of packages) {
    const v = installed.get(name) ?? requires(composer, name);
    if (typeof v === 'string') versions[name] = v;
  }
  return { versions, hasLock: Boolean(lock) };
}

function wordPressCoreVersion(root, coreDir) {
  if (!coreDir) return null;
  const text = readText(join(root, coreDir, 'wp-includes', 'version.php'));
  const m = text && /\$wp_version\s*=\s*['"]([^'"]+)['"]/.exec(text);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Acorn applications
// ---------------------------------------------------------------------------

function findComposerFiles(root, skipRel) {
  const results = [];
  let files = 0;
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || skipRel.has(rel(root, full))) continue;
        if (depth < MAX_DEPTH) queue.push({ dir: full, depth: depth + 1 });
        continue;
      }
      files++;
      if (files > MAX_FILES) return { results, truncated: true };
      if (e.name === 'composer.json') results.push(full);
    }
  }
  return { results, truncated: false };
}

function psr4Namespace(composer) {
  const psr4 = composer?.autoload?.['psr-4'];
  if (!psr4 || typeof psr4 !== 'object') return null;
  const entries = Object.entries(psr4);
  const app = entries.find(([, target]) => [].concat(target).some((t) => /^app\/?$/.test(String(t))));
  return (app ?? entries[0])?.[0] ?? null;
}

const BOOT_CALL_RE = /\b\w+::configure\(|->boot\(\)|\bbootloader\(\)/;

function findBoot(text) {
  const bootIdx = text.search(BOOT_CALL_RE);
  if (bootIdx === -1) return null;
  const before = text.slice(0, bootIdx);
  let start = 0;
  const boundary = /;\s*\n(?=\S)/g;
  let m;
  while ((m = boundary.exec(before)) !== null) start = m.index + m[0].length;
  const statement = before.slice(start);
  const hook = /add_action\(\s*['"]([\w\/-]+)['"]/.exec(statement);
  if (!hook) return { hook: null, priority: null };
  const prio = /\}\s*,\s*(\d+)\s*,?\s*\)/.exec(text.slice(bootIdx));
  return { hook: hook[1], priority: prio ? Number(prio[1]) : 10 };
}

// Classes imported (`use A\\B\\C;`) by the top-level PHP files, mapped to files through PSR-4.
function resolveImports(dir, composer, files) {
  const psr4 = composer?.autoload?.['psr-4'] ?? {};
  const out = [];
  for (const f of files) {
    for (const m of f.text.matchAll(/^use\s+([\w\\]+)\s*;/gm)) {
      const cls = m[1];
      for (const [prefix, target] of Object.entries(psr4)) {
        if (!cls.startsWith(prefix)) continue;
        for (const t of [].concat(target)) {
          const p = join(dir, String(t), `${cls.slice(prefix.length).split('\\').join('/')}.php`);
          const text = existsSync(p) ? readText(p) : null;
          if (text !== null) out.push({ path: p, name: p.split(/[\\/]/).pop(), text });
        }
      }
    }
  }
  return out;
}

function themeDirsWithComposer(root, contentDir) {
  if (!contentDir) return [];
  const themes = join(root, contentDir, 'themes');
  try {
    return readdirSync(themes, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(themes, e.name, 'composer.json')))
      .map((e) => e.name);
  } catch { return []; }
}

function analyzeApp(root, composerPath, ctx) {
  const { layout, contentDir, bedrockApp, notes } = ctx;
  const dir = dirname(composerPath);
  const composer = readJson(composerPath, notes, root);
  if (!composer) return null;
  const topPhp = listPhp(dir);
  const requiresAcorn = requires(composer, 'roots/acorn');
  const refsAcorn = topPhp.some((f) => /Roots\\Acorn\\Application/.test(f.text));
  if (!requiresAcorn && !refsAcorn) return null;

  const path = rel(root, dir);
  const segments = path.split('/');
  const styleCss = readText(join(dir, 'style.css'));
  const isTheme = Boolean(styleCss && /^\s*\*?\s*Theme Name\s*:/m.test(styleCss));
  const mainPlugin = topPhp.find((f) => /^\s*\*?\s*Plugin Name\s*:/m.test(f.text)) ?? null;
  const themeProvider = readText(join(dir, 'app', 'Providers', 'ThemeServiceProvider.php')) ?? '';

  let kind;
  if (layout === 'radicle' && path === '.') kind = 'radicle-app';
  else if (isTheme) {
    const sage = composer.name === 'roots/sage' || /SageServiceProvider/.test(themeProvider) || topPhp.some((f) => /sage\.view/.test(f.text));
    kind = sage ? 'sage-theme' : 'acorn-theme';
  } else if (segments.includes('mu-plugins') && mainPlugin) kind = 'acorn-mu-plugin';
  else if (segments.includes('plugins') && mainPlugin) kind = 'acorn-plugin';
  else kind = 'acorn-unknown';

  const appPhp = walkPhp(join(dir, 'app'));
  const known = new Set(appPhp.map((f) => f.path));
  for (const f of resolveImports(dir, composer, topPhp)) if (!known.has(f.path)) appPhp.unshift(f);
  const allPhp = [...topPhp, ...appPhp];
  const isPluginKind = kind === 'acorn-mu-plugin' || kind === 'acorn-plugin' || kind === 'acorn-unknown';

  // Base path hint
  let basePathHint = null;
  if (kind === 'radicle-app') basePathHint = bedrockApp && ACORN_BASEPATH_RE.test(bedrockApp) ? 'ACORN_BASEPATH' : 'root';
  else if (isTheme) basePathHint = 'theme-inferred';
  else if (allPhp.some((f) => ACORN_BASEPATH_RE.test(f.text))) basePathHint = 'ACORN_BASEPATH';
  else if (allPhp.some((f) => /Application::configure\(\s*[^)\s]/.test(f.text))) basePathHint = 'configure-arg';
  else if (allPhp.some((f) => /->withPaths\(/.test(f.text))) basePathHint = 'withPaths';

  // Boot file and hook
  let boot = { file: null, hook: null, priority: null };
  if (kind === 'radicle-app') {
    const muDir = join(root, contentDir ?? 'public/content', 'mu-plugins');
    const bootFile = listPhp(muDir).find((f) => /Application::configure\(/.test(f.text));
    if (bootFile) boot = { file: rel(root, bootFile.path), ...(findBoot(bootFile.text) ?? { hook: null, priority: null }) };
  } else if (isTheme) {
    const fn = topPhp.find((f) => f.name === 'functions.php');
    if (fn) boot = { file: 'functions.php', ...(findBoot(fn.text) ?? { hook: null, priority: null }) };
  } else {
    const bootFile = (mainPlugin && BOOT_CALL_RE.test(mainPlugin.text) ? mainPlugin : null)
      ?? topPhp.find((f) => BOOT_CALL_RE.test(f.text)) ?? mainPlugin;
    if (bootFile) boot = { file: bootFile.name, ...(findBoot(bootFile.text) ?? { hook: null, priority: null }) };
  }

  // Providers
  let providers = { source: null, file: null };
  const extraProviders = composer.extra?.acorn?.providers;
  const withProviders = allPhp.find((f) => /->withProviders\(/.test(f.text));
  const configApp = readText(join(dir, 'config', 'app.php'));
  if (Array.isArray(extraProviders) && extraProviders.length) providers = { source: 'composer-extra', file: 'composer.json' };
  else if (withProviders && withProviders.name === 'functions.php' && isTheme) providers = { source: 'functions.php', file: 'functions.php' };
  else if (withProviders) providers = { source: 'configurator', file: rel(dir, withProviders.path) };
  else if (configApp && /['"]providers['"]/.test(configApp)) providers = { source: 'config/app.php', file: 'config/app.php' };

  // Versions
  const { versions, hasLock } = lockedVersions(dir, composer, APP_PACKAGES, notes, root);
  if (!hasLock) notes.push(`${path}: no composer.lock, versions are the composer.json constraints`);

  // Blocks
  const usesAcfComposer = Boolean(versions['log1x/acf-composer']) || appPhp.some((f) => /Log1x\\AcfComposer\\Block/.test(f.text));
  const usesNativeBlocks = allPhp.some((f) => /register_block_type\(/.test(f.text));
  const blocks = usesAcfComposer ? 'acf-composer' : usesNativeBlocks ? 'native' : 'none';
  if (usesAcfComposer && usesNativeBlocks) notes.push(`${path}: ACF Composer and native register_block_type() both present`);

  // Post types
  const postTypeClasses = (() => { try { return readdirSync(join(dir, 'app', 'PostTypes')).some((f) => f.endsWith('.php')); } catch { return false; } })();
  const hasPoet = existsSync(join(dir, 'config', 'poet.php')) || Boolean(versions['log1x/poet']);
  const hasAcornPostTypes = existsSync(join(dir, 'config', 'post-types.php')) || Boolean(versions['roots/acorn-post-types']);
  const postTypes = postTypeClasses ? 'classes' : hasAcornPostTypes ? 'acorn-post-types' : hasPoet ? 'poet' : 'none';
  if (postTypeClasses && hasPoet) notes.push(`${path}: post types registered by app/PostTypes classes while Poet (config/poet.php) is also installed`);

  return {
    app: { kind, path, namespace: psr4Namespace(composer), basePathHint, boot, providers, blocks, postTypes, versions },
    facts: {
      dir,
      isPluginKind,
      hasViews: isDir(join(dir, 'resources', 'views')),
      wordpressRouting: allPhp.some((f) => /wordpress:\s*true/.test(f.text)),
      tailwindConfig: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs'].find((f) => existsSync(join(dir, f))) ?? null,
      packageJson: readJson(join(dir, 'package.json'), null, root),
    },
  };
}

// ---------------------------------------------------------------------------
// Runtime (Lando / DDEV) and runners
// ---------------------------------------------------------------------------

function normalizeCmd(cmd, name) {
  if (cmd === undefined || cmd === null) return { cmd: name, service: null };
  if (typeof cmd === 'string') return { cmd: cmd.trim(), service: null };
  if (Array.isArray(cmd)) {
    let service = null;
    const parts = cmd.map((item) => {
      if (item && typeof item === 'object') {
        const [svc, c] = Object.entries(item)[0] ?? [];
        service ??= svc ?? null;
        return String(c ?? '').trim();
      }
      return String(item ?? '').trim();
    }).filter(Boolean);
    return { cmd: parts.join(' && '), service };
  }
  return { cmd: String(cmd), service: null };
}

function parseLando(root, files, notes) {
  let doc = {};
  const parseErrors = [];
  for (const file of files) {
    const text = readText(join(root, file));
    if (text === null) continue;
    try { doc = deepMerge(doc, parseYamlSubset(text)); } catch (e) {
      parseErrors.push(`${file}: ${e.message}`);
      notes.push(`lando: could not parse ${file} (${e.message}); runtime facts may be incomplete`);
    }
  }
  const cfg = doc.config && typeof doc.config === 'object' ? doc.config : {};
  const via = typeof cfg.via === 'string' ? cfg.via : 'apache';
  const php = cfg.php !== undefined && cfg.php !== null ? String(cfg.php) : null;
  const rawServices = doc.services && typeof doc.services === 'object' ? doc.services : {};
  const database = typeof cfg.database === 'string' ? cfg.database : (rawServices.database?.type ?? null);

  const services = {};
  for (const [name, svc] of Object.entries(rawServices)) {
    const s = svc && typeof svc === 'object' ? svc : {};
    services[name] = {
      type: typeof s.type === 'string' ? s.type : null,
      image: typeof s.overrides?.image === 'string' ? s.overrides.image : null,
      ports: [].concat(s.ports ?? [], s.overrides?.ports ?? []).map(String),
    };
  }
  if (doc.recipe) {
    services.appserver ??= { type: php ? `php:${php}` : null, image: null, ports: [] };
    if (via.startsWith('nginx')) services.appserver_nginx ??= { type: 'nginx', image: null, ports: [] };
    services.database ??= { type: database, image: null, ports: [] };
  }

  const tooling = {};
  for (const [name, tool] of Object.entries(doc.tooling && typeof doc.tooling === 'object' ? doc.tooling : {})) {
    const t = tool && typeof tool === 'object' ? tool : {};
    const { cmd, service } = normalizeCmd(t.cmd, name);
    tooling[name] = {
      service: typeof t.service === 'string' ? t.service : (service ?? 'appserver'),
      cmd,
      dir: typeof t.dir === 'string' ? t.dir : null,
      description: typeof t.description === 'string' ? t.description : null,
    };
  }

  const envFile = doc.env_file === undefined ? [] : [].concat(doc.env_file).map(String);
  const configFiles = {};
  for (const [k, v] of Object.entries(cfg.config && typeof cfg.config === 'object' ? cfg.config : {})) if (typeof v === 'string') configFiles[k] = v;

  const lando = {
    files,
    name: typeof doc.name === 'string' ? doc.name : null,
    recipe: typeof doc.recipe === 'string' ? doc.recipe : null,
    webroot: typeof cfg.webroot === 'string' ? cfg.webroot : '.',
    php,
    via,
    database,
    xdebug: cfg.xdebug ?? false,
    composerVersion: cfg.composer_version ?? null,
    configFiles,
    webService: via.startsWith('nginx') ? 'appserver_nginx' : 'appserver',
    envFile,
    misplacedEnvFile: cfg.env_file !== undefined,
    excludes: doc.excludes === undefined ? [] : [].concat(doc.excludes).map(String),
    services,
    tooling,
    events: Object.keys(doc.events && typeof doc.events === 'object' ? doc.events : {}),
    proxy: doc.proxy && typeof doc.proxy === 'object' ? doc.proxy : {},
    parseErrors,
  };
  const installsComposer = JSON.stringify([rawServices.appserver?.build_as_root ?? [], rawServices.appserver?.build ?? []]).includes('composer');
  return { lando, installsComposer };
}

function pickTool(tooling, candidates) {
  const names = Object.keys(tooling);
  for (const c of candidates) {
    if (c instanceof RegExp) { const hit = names.find((n) => c.test(n)); if (hit) return hit; }
    else if (names.includes(c)) return c;
  }
  return null;
}

function buildRunners(runner, lando, installsComposer, hasAcorn, warnings) {
  const empty = { wp: null, acorn: null, composer: null, node: null, test: null, lint: null, cache: null, build: null, dev: null, login: null, logs: null };
  if (runner === 'lando') {
    const t = lando.tooling;
    const l = (name) => (name ? `lando ${name}` : null);
    const composer = lando.composerVersion === false && !installsComposer ? null : 'lando composer';
    if (!composer) warnings.push('lando: composer_version is false and no build step installs Composer; `lando composer` is not available');
    return {
      ...empty,
      wp: 'lando wp',
      acorn: t.acorn ? 'lando acorn' : (hasAcorn ? 'lando wp acorn' : null),
      composer,
      node: l(pickTool(t, ['yarn', 'npm', 'pnpm', 'node'])),
      test: l(pickTool(t, ['phpunit', 'pest', 'test'])),
      lint: l(pickTool(t, ['pint-check', 'pint', 'phpcs', 'mago', 'lint'])),
      cache: l(pickTool(t, ['cache-clear', 'flush', 'cache'])),
      build: l(pickTool(t, ['build', /-build$/])),
      dev: l(pickTool(t, ['dev', /-dev$/])),
      login: l(pickTool(t, ['login'])),
      logs: `lando logs -s appserver${lando.webService === 'appserver_nginx' ? ' -s appserver_nginx' : ''}`,
    };
  }
  if (runner === 'ddev') {
    return { ...empty, wp: 'ddev wp', acorn: hasAcorn ? 'ddev wp acorn' : null, composer: 'ddev composer', logs: 'ddev logs' };
  }
  warnings.push('No Lando configuration found (.lando.yml): wp, composer and node commands would run on the host');
  return { ...empty, wp: 'wp', acorn: hasAcorn ? 'wp acorn' : null, composer: 'composer' };
}

function readWpCli(root, notes) {
  const out = { path: null, docroot: null };
  for (const file of ['wp-cli.yml', 'wp-cli.local.yml']) {
    const text = readText(join(root, file));
    if (text === null) continue;
    try {
      const doc = parseYamlSubset(text);
      if (typeof doc.path === 'string') out.path = doc.path;
      if (typeof doc.server?.docroot === 'string') out.docroot = doc.server.docroot;
    } catch (e) { notes.push(`could not parse ${file}: ${e.message}`); }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Flag
// ---------------------------------------------------------------------------

function readFlag(root, composer, notes, warnings) {
  let raw = null; let file = null;
  const flagPath = join(root, '.roots-stack.json');
  if (existsSync(flagPath)) { raw = readJson(flagPath, notes, root); file = '.roots-stack.json'; }
  else if (composer?.extra?.['roots-stack'] && typeof composer.extra['roots-stack'] === 'object') { raw = composer.extra['roots-stack']; file = 'composer.json#extra.roots-stack'; }
  if (!raw || typeof raw !== 'object') return null;
  const flag = {
    file,
    profile: typeof raw.profile === 'string' ? raw.profile : null,
    app: typeof raw.app === 'string' ? toPosix(raw.app).replace(/^\.\//, '').replace(/\/+$/, '') || '.' : null,
    runner: typeof raw.runner === 'string' ? raw.runner : null,
  };
  if (Array.isArray(raw.corpus)) flag.corpus = raw.corpus.map(String);
  if (flag.profile && !PROFILES.includes(flag.profile)) warnings.push(`${file}: profile "${flag.profile}" is not one of ${PROFILES.join(', ')}`);
  return flag;
}

// ---------------------------------------------------------------------------
// Main detection
// ---------------------------------------------------------------------------

export function detect(rootInput, opts = {}) {
  const notes = [];
  const warnings = [];
  const root = resolve(rootInput ?? process.cwd());
  const result = {
    tool: TOOL,
    root,
    layout: 'unknown',
    coreDir: null,
    apps: [],
    active: null,
    site: { versions: {}, wpCli: { path: null, docroot: null } },
    runtime: { runner: 'none', lando: null, runners: {} },
    flag: null,
    warnings,
    notes,
    truncated: false,
  };

  try {
    if (!isDir(root)) {
      notes.push(`root ${root} is not a directory`);
      result.runtime.runners = buildRunners('none', null, false, false, warnings);
      return result;
    }

    const composer = readJson(join(root, 'composer.json'), notes, root);
    const { layout, coreDir, contentDir, bedrockApp } = detectLayout(root, composer);
    result.layout = layout;
    result.coreDir = coreDir;

    // Site versions and WP-CLI
    const site = lockedVersions(root, composer, SITE_PACKAGES, notes, root);
    result.site.versions = site.versions;
    const coreVersion = wordPressCoreVersion(root, coreDir);
    if (coreVersion) result.site.versions.wordpress = coreVersion;
    result.site.wpCli = readWpCli(root, notes);

    // Acorn apps
    const skipRel = new Set(['public/build']);
    if (coreDir && coreDir !== '.') skipRel.add(toPosix(coreDir));
    const { results: composerFiles, truncated } = findComposerFiles(root, skipRel);
    result.truncated = truncated;
    if (truncated) notes.push(`walk stopped after ${MAX_FILES} files; apps deeper in the tree may be missing`);
    const analyses = [];
    for (const file of composerFiles) {
      const a = analyzeApp(root, file, { layout, contentDir, bedrockApp, notes });
      if (a) analyses.push(a);
    }
    analyses.sort((a, b) => KIND_PRECEDENCE.indexOf(a.app.kind) - KIND_PRECEDENCE.indexOf(b.app.kind) || a.app.path.localeCompare(b.app.path));
    result.apps = analyses.map((a) => a.app);

    // Flag and active app
    const flag = opts.ignoreFlag ? null : readFlag(root, composer, notes, warnings);
    result.flag = flag;
    let active = -1;
    if (flag?.app) {
      active = result.apps.findIndex((a) => a.path === flag.app);
      if (active === -1) warnings.push(`${flag.file}: app "${flag.app}" was not detected as an Acorn application; falling back to heuristics`);
    }
    if (active === -1 && flag?.profile) active = result.apps.findIndex((a) => a.kind === flag.profile);
    if (active === -1) {
      const cwd = resolve(opts.cwd ?? process.cwd());
      const cwdRel = toPosix(relative(root, cwd));
      if (cwdRel && !cwdRel.startsWith('..')) {
        active = result.apps.findIndex((a) => a.path !== '.' && (cwdRel === a.path || cwdRel.startsWith(`${a.path}/`)));
      }
    }
    if (active === -1 && result.apps.length) active = 0; // apps are sorted by precedence
    result.active = active === -1 ? null : active;
    if (flag?.profile && result.active !== null && result.apps[result.active].kind !== flag.profile) {
      warnings.push(`${flag.file}: profile "${flag.profile}" differs from the detected ${result.apps[result.active].kind} at ${result.apps[result.active].path}`);
    }

    // Runtime
    const landoFiles = LANDO_FILES.filter((f) => existsSync(join(root, f)));
    let runner = 'none';
    let landoInfo = { lando: null, installsComposer: false };
    if (landoFiles.length) { runner = 'lando'; landoInfo = parseLando(root, landoFiles, notes); }
    else if (existsSync(join(root, '.ddev', 'config.yaml'))) runner = 'ddev';
    result.runtime.runner = runner;
    result.runtime.lando = landoInfo.lando;
    if (landoInfo.lando?.misplacedEnvFile) warnings.push('.lando.yml: config.env_file is ignored by Lando; env_file belongs at the top level');
    if (flag?.runner && flag.runner !== runner) warnings.push(`${flag.file}: runner "${flag.runner}" differs from the detected ${runner}`);
    result.runtime.runners = buildRunners(runner, landoInfo.lando, landoInfo.installsComposer, result.apps.length > 0, warnings);

    // Red flags
    const themesWithComposer = themeDirsWithComposer(root, contentDir);
    const wpVersion = result.site.versions['roots/wordpress'] ?? result.site.versions['johnpbloch/wordpress'] ?? result.site.versions.wordpress ?? null;
    for (const { app, facts } of analyses) {
      if (facts.isPluginKind && app.basePathHint === null) {
        if (themesWithComposer.length) {
          warnings.push(`${app.path}: Acorn boots without ACORN_BASEPATH, Application::configure($path) or withPaths() while theme ${themesWithComposer.join(', ')} has composer.json; Acorn would infer the theme as the base path`);
        } else {
          notes.push(`${app.path}: no explicit Acorn base path (ACORN_BASEPATH, configure($path) or withPaths())`);
        }
      }
      if ((facts.isPluginKind || app.kind === 'radicle-app') && facts.hasViews && app.versions['roots/acorn'] && wpVersion
        && semverLt(app.versions['roots/acorn'], '6.3.0') && !semverLt(wpVersion, '7.1.2')) {
        warnings.push(`${app.path}: resources/views outside the theme with roots/acorn ${app.versions['roots/acorn']} and WordPress ${wpVersion}; WordPress >= 7.1.2 rejects template paths outside the theme unless Acorn restores them (6.3.0 ships that filter), verify how views are rendered`);
      }
      const tailwind = facts.packageJson?.devDependencies?.tailwindcss ?? facts.packageJson?.dependencies?.tailwindcss;
      if (facts.tailwindConfig && typeof tailwind === 'string' && /^[\^~]?4/.test(tailwind)) {
        warnings.push(`${app.path}: ${facts.tailwindConfig} present next to Tailwind ${tailwind}; Tailwind 4 is configured in CSS (@theme), the JS config is ignored unless loaded with @config`);
      }
    }
    const routingApps = analyses.filter((a) => a.facts.wordpressRouting).map((a) => a.app.path);
    if (routingApps.length > 1) warnings.push(`${routingApps.join(' and ')} both boot Acorn with wordpress: true routing; only one application should own WordPress request routing`);
  } catch (e) {
    notes.push(`detector error: ${e?.message ?? e}`);
    if (!Object.keys(result.runtime.runners).length) result.runtime.runners = buildRunners('none', null, false, false, []);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Text format (compact session table)
// ---------------------------------------------------------------------------

export function formatText(r) {
  const app = r.active !== null ? r.apps[r.active] : null;
  const lando = r.runtime.lando;
  const lines = [];
  lines.push([
    r.layout,
    app ? `${app.kind} @ ${app.path}` : 'no acorn app',
    app?.namespace ?? '-',
    app?.postTypes ?? '-',
    `${app?.blocks ?? 'none'} blocks`,
    r.runtime.runner === 'lando' ? `lando webroot ${lando?.webroot ?? '.'}` : `runner ${r.runtime.runner}`,
  ].join(' · '));
  const versions = { ...r.site.versions, ...(app?.versions ?? {}) };
  if (versions['roots/wordpress'] || versions['johnpbloch/wordpress']) delete versions.wordpress;
  const seen = new Set();
  const vParts = [];
  for (const [k, v] of Object.entries(versions)) {
    const label = k.replace(/^.*\//, '');
    const shown = seen.has(label) ? k : label;
    seen.add(label);
    vParts.push(`${shown} ${v}`);
  }
  if (vParts.length) lines.push(`versions: ${vParts.join(' · ')}`);
  const runners = Object.entries(r.runtime.runners).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`);
  if (runners.length) lines.push(`runners: ${runners.join(' · ')}`);
  if (app) {
    const boot = app.boot.file ? `${app.boot.file}${app.boot.hook ? ` on ${app.boot.hook} (${app.boot.priority})` : ' at include time'}` : 'unknown';
    lines.push(`boot: ${boot} · base path ${app.basePathHint ?? 'none'} · providers ${app.providers.source ?? 'unknown'}${app.providers.file ? ` (${app.providers.file})` : ''}`);
  }
  if (r.apps.length > 1) lines.push(`other apps: ${r.apps.filter((_, i) => i !== r.active).map((a) => `${a.kind} @ ${a.path}`).join(' · ')}`);
  lines.push(r.flag ? `flag: ${r.flag.file} → ${r.flag.profile ?? '-'} @ ${r.flag.app ?? '-'} (${r.flag.runner ?? '-'})` : 'flag: none');
  for (const w of r.warnings) lines.push(`warning: ${w}`);
  if (r.notes.length) lines.push(`notes: ${r.notes.length} (see --format=json)`);
  if (r.truncated) lines.push('truncated: the walk hit its file bound');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { path: null, format: 'json', help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--path=')) opts.path = arg.slice(7);
    else if (arg === '--path') opts.path = argv[++i] ?? null;
    else if (arg.startsWith('--format=')) opts.format = arg.slice(9);
    else if (arg === '--format') opts.format = argv[++i] ?? 'json';
  }
  return opts;
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(`${TOOL.name} ${TOOL.version}\n\nUsage: node scripts/detect-roots-project.mjs [--path=<dir>] [--format=json|text]\n\nClassifies a WordPress checkout on the Roots stack (layout, Acorn apps, Lando runtime, .roots-stack.json flag).\nExit code is always 0; failures are reported inside the JSON "notes".\n`);
    return 0;
  }
  let result;
  try {
    result = detect(opts.path ?? process.cwd());
  } catch (e) {
    result = { tool: TOOL, root: resolve(opts.path ?? process.cwd()), layout: 'unknown', coreDir: null, apps: [], active: null, site: { versions: {}, wpCli: { path: null, docroot: null } }, runtime: { runner: 'none', lando: null, runners: {} }, flag: null, warnings: [], notes: [`detector crashed: ${e?.message ?? e}`], truncated: false };
  }
  process.stdout.write(opts.format === 'text' ? `${formatText(result)}\n` : `${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

const invokedDirectly = (() => {
  try { return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href; } catch { return false; }
})();
if (invokedDirectly) process.exit(main());
