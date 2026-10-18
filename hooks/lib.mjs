/**
 * Shared helpers for the kivo-wise hooks (contract C4).
 *
 * Every hook: Node ESM, JSON on stdin, JSON on stdout, exit 0 (exit 2 only to block a PreToolUse).
 * Nothing here throws to the caller: a broken stdin, detector or cache yields null and the hook stays silent.
 *
 * Environment:
 *   KIVO_WISE_HOOK_DEBUG=1       enable logging
 *   KIVO_WISE_HOOK_LOG=<path>    log file (default .kivo-wise/hooks.log in the hook's cwd)
 *   KIVO_WISE_DETECTOR=<path>    detector script to run instead of scripts/detect-roots-project.mjs (tests)
 *   KIVO_WISE_NO_CACHE=1         skip the .kivo-wise/context.json cache (tests)
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS_DIR = dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = resolve(HOOKS_DIR, '..');

export const CACHE_TTL_MS = 10 * 60 * 1000;
export const CACHE_DIR = '.kivo-wise';
export const CACHE_FILE = 'context.json';

let hookName = 'hook';

/** Name used in log lines. */
export function setHookName(name) {
  hookName = name;
}

/** Append a log line when KIVO_WISE_HOOK_DEBUG=1. Never throws. */
export function log(level, message) {
  if (process.env.KIVO_WISE_HOOK_DEBUG !== '1') return;
  const file = process.env.KIVO_WISE_HOOK_LOG || join(CACHE_DIR, 'hooks.log');
  const line = `[${new Date().toISOString()}] [${hookName}] [${level}] ${message}\n`;
  try {
    mkdirSync(dirname(resolve(file)), { recursive: true });
    appendFileSync(file, line);
  } catch {
    /* logging is best effort */
  }
}

/** Read all of stdin and parse it as JSON. Returns null on empty or malformed input. */
export async function readStdin() {
  let raw = '';
  try {
    for await (const chunk of process.stdin) raw += chunk;
  } catch (error) {
    log('WARN', `stdin read failed: ${error.message}`);
    return null;
  }
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    log('WARN', `stdin is not JSON: ${error.message}`);
    return null;
  }
}

/** Write one JSON object to stdout. */
export function out(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

/** Read and parse a JSON file; returns fallback on any failure. */
export function loadJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** The project directory a hook should work on: stdin `cwd` when present, else the process cwd. */
export function projectDir(input) {
  const cwd = input && typeof input.cwd === 'string' && input.cwd.trim() ? input.cwd : process.cwd();
  return resolve(cwd);
}

/**
 * Path of `filePath` relative to `cwd` with forward slashes, or null when the file
 * lives outside the project (or no path was given).
 */
export function projectRelative(cwd, filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return null;
  const abs = isAbsolute(filePath) ? resolve(filePath) : resolve(cwd, filePath);
  const rel = relative(resolve(cwd), abs);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return rel.split(sep).join('/');
}

function detectorScript() {
  const override = process.env.KIVO_WISE_DETECTOR;
  if (override && override.trim()) return resolve(override);
  return join(PLUGIN_ROOT, 'scripts', 'detect-roots-project.mjs');
}

function readCache(cwd) {
  if (process.env.KIVO_WISE_NO_CACHE === '1') return null;
  const cached = loadJson(join(cwd, CACHE_DIR, CACHE_FILE));
  if (!cached || typeof cached !== 'object') return null;
  const { savedAt, root, detection } = cached;
  if (typeof savedAt !== 'number' || root !== cwd || !detection || typeof detection !== 'object') return null;
  if (Date.now() - savedAt > CACHE_TTL_MS) return null;
  return detection;
}

function writeCache(cwd, detection) {
  if (process.env.KIVO_WISE_NO_CACHE === '1') return;
  try {
    const dir = join(cwd, CACHE_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, CACHE_FILE), `${JSON.stringify({ savedAt: Date.now(), root: cwd, detection })}\n`);
  } catch (error) {
    log('WARN', `cache write failed: ${error.message}`);
  }
}

/**
 * Run the detector (contract C1) on `cwd` and return its JSON, cached for CACHE_TTL_MS in
 * <cwd>/.kivo-wise/context.json. Returns null when the detector is missing, fails or prints
 * something that is not a C1 object.
 */
export function detect(cwd) {
  const root = resolve(cwd);
  const cached = readCache(root);
  if (cached) {
    log('INFO', `detector cache hit for ${root}`);
    return cached;
  }

  const script = detectorScript();
  if (!existsSync(script)) {
    log('WARN', `detector not found at ${script}`);
    return null;
  }

  let result;
  try {
    result = spawnSync(process.execPath, [script, `--path=${root}`, '--format=json'], {
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
      env: process.env,
    });
  } catch (error) {
    log('WARN', `detector spawn failed: ${error.message}`);
    return null;
  }
  if (result.error) {
    log('WARN', `detector spawn error: ${result.error.message}`);
    return null;
  }

  let detection;
  try {
    detection = JSON.parse(result.stdout || '');
  } catch {
    log('WARN', `detector printed non-JSON (exit ${result.status})`);
    return null;
  }
  if (!detection || typeof detection !== 'object' || !Array.isArray(detection.apps)) {
    log('WARN', 'detector output is not a C1 object');
    return null;
  }

  writeCache(root, detection);
  return detection;
}

/** The active app from a C1 detection, or null. */
export function activeApp(detection) {
  if (!detection || !Array.isArray(detection.apps) || detection.apps.length === 0) return null;
  const index = Number.isInteger(detection.active) ? detection.active : 0;
  return detection.apps[index] || detection.apps[0] || null;
}

/**
 * Runner commands from a detection, or an empty object. The detector publishes them at
 * `runtime.runners` (present with or without Lando); `runtime.lando.runners` is the older C1 draft.
 */
export function runners(detection) {
  const runtime = detection && detection.runtime;
  if (!runtime) return {};
  const pick = (value) => (value && typeof value === 'object' ? value : null);
  return pick(runtime.runners) || pick(runtime.lando && runtime.lando.runners) || {};
}

/** Normalise an app path from the detector ('.' or '' means the project root). */
export function appPath(app) {
  const p = app && typeof app.path === 'string' ? app.path.replace(/^\.\/+/, '').replace(/\/+$/, '') : '';
  return p === '.' ? '' : p;
}

/** True when `rel` (project-relative, forward slashes) sits inside the app folder. */
export function isUnderApp(rel, app) {
  const base = appPath(app);
  if (base === '') return true;
  return rel === base || rel.startsWith(`${base}/`);
}

/**
 * Run a hook body with a guarantee: whatever it throws, the process exits 0 silently
 * (hooks must never surface stack traces to the agent).
 */
export async function runHook(name, body) {
  setHookName(name);
  try {
    const input = await readStdin();
    if (input === null) {
      log('INFO', 'no usable stdin; staying silent');
      process.exitCode = 0;
      return;
    }
    const code = await body(input);
    process.exitCode = Number.isInteger(code) ? code : 0;
  } catch (error) {
    log('ERROR', `unhandled: ${error && error.stack ? error.stack : error}`);
    process.exitCode = 0;
  }
}
