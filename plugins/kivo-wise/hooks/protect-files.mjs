#!/usr/bin/env node
/**
 * PreToolUse hook on Write | Edit | MultiEdit | NotebookEdit: protects secrets and managed folders.
 *
 * Generic (every profile): .env* (except .env.example), auth.json, .lando.local.yml, wp-config.php,
 * the WordPress core dir, vendor/, node_modules/, Composer-installed plugins and themes, uploads/,
 * build output (public/build/). Radicle adds its scaffolding (public/index.php, public/wp-config.php,
 * 00-acorn-boot.php, bedrock-autoloader.php, the theme stub files) and asks before touching
 * bedrock/environments/*.php (that is the real wp-config).
 *
 * Deny: stdout {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",…}} + exit 2.
 * Ask: same shape with "ask", exit 0. Paths outside the project (cwd from stdin) are ignored.
 */

import { basename, join } from 'node:path';
import { detect, loadJson, log, out, projectDir, projectRelative, runHook, appPath } from './lib.mjs';

const CONTENT_DIRS = '(?:wp-content|app|content)';
const INSTALLABLE_RE = new RegExp(`(?:^|/)${CONTENT_DIRS}/(plugins|mu-plugins|themes)/([^/]+)/`);
const UPLOADS_RE = new RegExp(`(?:^|/)${CONTENT_DIRS}/uploads/`);
const RADICLE_ENV_RE = /^bedrock\/environments\/([^/]+)\.php$/;
const RADICLE_THEME_STUB_RE = /^public\/content\/themes\/[^/]+\/(functions\.php|index\.php|style\.css)$/;
const RADICLE_FIXED = new Set(['public/index.php', 'public/wp-config.php', 'public/content/mu-plugins/00-acorn-boot.php']);

function lastSegment(packageName) {
  const idx = packageName.lastIndexOf('/');
  return idx === -1 ? packageName : packageName.slice(idx + 1);
}

/** Folder names of the packages the root composer.json / composer.lock install. */
export function composerFolders(cwd) {
  const folders = new Set();
  const composer = loadJson(join(cwd, 'composer.json'));
  for (const section of ['require', 'require-dev']) {
    const deps = composer && composer[section];
    if (deps && typeof deps === 'object') for (const name of Object.keys(deps)) folders.add(lastSegment(name));
  }
  const lock = loadJson(join(cwd, 'composer.lock'));
  for (const section of ['packages', 'packages-dev']) {
    const list = lock && lock[section];
    if (Array.isArray(list)) for (const pkg of list) if (pkg && typeof pkg.name === 'string') folders.add(lastSegment(pkg.name));
  }
  return folders;
}

function isRadicle(detection) {
  if (!detection) return false;
  if (detection.layout === 'radicle') return true;
  return Array.isArray(detection.apps) && detection.apps.some((a) => a && a.kind === 'radicle-app');
}

function coreDirOf(detection) {
  const core = detection && typeof detection.coreDir === 'string' ? detection.coreDir.replace(/^\.\/+/, '').replace(/\/+$/, '') : '';
  return core;
}

function underCore(rel, core) {
  if (core === '.') {
    return /^(wp-admin|wp-includes)\//.test(rel) || (/^wp-[a-z-]+\.php$/.test(rel) && rel !== 'wp-config.php');
  }
  return core !== '' && (rel === core || rel.startsWith(`${core}/`));
}

function appFolders(detection) {
  const set = new Set();
  const apps = detection && Array.isArray(detection.apps) ? detection.apps : [];
  for (const app of apps) {
    const p = appPath(app);
    if (p) set.add(p);
  }
  return set;
}

/**
 * Decide for a project-relative path. Returns { decision: 'deny'|'ask', reason } or null to allow.
 * ctx: { detection, composerFolders: Set<string> }
 */
export function decide(rel, ctx) {
  const { detection } = ctx;
  const base = basename(rel);
  const prefix = `kivo-wise: ${rel}`;

  if (base === '.env.example') return null;
  if (base === '.env' || base.startsWith('.env.')) {
    return { decision: 'deny', reason: `${prefix} holds secrets; edit .env.example and set the values in the environment instead.` };
  }
  if (base === 'auth.json') {
    return { decision: 'deny', reason: `${prefix} holds Composer credentials; use the COMPOSER_AUTH environment variable instead.` };
  }
  if (base === '.lando.local.yml') {
    return { decision: 'deny', reason: `${prefix} is the developer's unversioned Lando override; change .lando.yml instead.` };
  }

  if (isRadicle(detection)) {
    const env = RADICLE_ENV_RE.exec(rel);
    if (env) {
      return { decision: 'ask', reason: `${prefix} is the real wp-config for the ${env[1]} environment in Radicle; confirm the change is intended.` };
    }
    if (RADICLE_FIXED.has(rel) || base === 'bedrock-autoloader.php' || RADICLE_THEME_STUB_RE.test(rel)) {
      return { decision: 'deny', reason: `${prefix} is scaffolding managed by Radicle; the upstream update overwrites it.` };
    }
  }

  if (base === 'wp-config.php') {
    return { decision: 'deny', reason: `${prefix} is generated for the environment (Lando, Bedrock or Radicle); configure through .env or config/ instead.` };
  }

  const core = coreDirOf(detection);
  if (underCore(rel, core)) {
    const label = core === '.' ? 'the project root' : `${core}/`;
    return { decision: 'deny', reason: `${prefix} is WordPress core (${label}) installed by Composer; the change is lost on the next install.` };
  }

  const segments = rel.split('/');
  if (segments.includes('vendor')) {
    return { decision: 'deny', reason: `${prefix} is inside vendor/, regenerated by Composer; change the dependency or the code that uses it.` };
  }
  if (segments.includes('node_modules')) {
    return { decision: 'deny', reason: `${prefix} is inside node_modules/, regenerated by npm/yarn; change the dependency or the code that uses it.` };
  }

  if (UPLOADS_RE.test(rel)) {
    return { decision: 'deny', reason: `${prefix} is under uploads/, which holds user media, not code.` };
  }
  if (/(?:^|\/)public\/build\//.test(rel)) {
    return { decision: 'deny', reason: `${prefix} is build output (public/build/); edit the source under resources/ and rebuild.` };
  }

  const installable = INSTALLABLE_RE.exec(rel);
  if (installable) {
    const [, kind, folder] = installable;
    const folderPath = rel.slice(0, installable.index + installable[0].length - 1);
    const apps = appFolders(detection);
    const isApp = [...apps].some((p) => folderPath === p || folderPath.endsWith(`/${p}`) || p.endsWith(`/${folderPath}`));
    if (!isApp && ctx.composerFolders.has(folder)) {
      const noun = kind === 'themes' ? 'theme' : 'plugin';
      return { decision: 'deny', reason: `${prefix} belongs to the Composer-installed ${noun} ${folder}; the change is lost on the next install. Hook or filter it from the active app instead.` };
    }
  }

  return null;
}

export function targetPath(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return null;
  for (const key of ['file_path', 'notebook_path', 'path']) {
    if (typeof toolInput[key] === 'string' && toolInput[key].trim()) return toolInput[key];
  }
  return null;
}

await runHook('protect-files', (input) => {
  const cwd = projectDir(input);
  const target = targetPath(input.tool_input);
  const rel = projectRelative(cwd, target);
  if (!rel) {
    log('INFO', `no project path to check (${target || 'none'}); silent`);
    return 0;
  }

  const verdict = decide(rel, { detection: detect(cwd), composerFolders: composerFolders(cwd) });
  if (!verdict) return 0;

  out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: verdict.decision, permissionDecisionReason: verdict.reason } });
  log('INFO', `${verdict.decision}: ${rel}`);
  if (verdict.decision === 'deny') {
    process.stderr.write(`${verdict.reason}\n`);
    return 2;
  }
  return 0;
});
