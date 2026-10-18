#!/usr/bin/env node
/**
 * PostToolUse hook on Write | Edit: cache reminder after PHP changes in the active app.
 *
 * When a .php or .blade.php file under the active Acorn app changed, injects additionalContext
 * with the project's cache command (`runtime.runners.cache`) or `<acorn runner> optimize:clear`.
 * Never runs a command. Silent for other files, dependency folders, non-Roots projects or bad stdin.
 */

import { activeApp, appPath, detect, isUnderApp, log, out, projectDir, projectRelative, runHook, runners } from './lib.mjs';

const SKIP_SEGMENTS = new Set(['vendor', 'node_modules', 'storage']);

export function isPhp(rel) {
  return /\.php$/i.test(rel);
}

export function cacheCommand(detection) {
  const cmds = runners(detection);
  if (cmds.cache) return cmds.cache;
  const acorn = cmds.acorn || 'wp acorn';
  return `${acorn} optimize:clear`;
}

export function reminder(app, detection) {
  const label = appPath(app) || 'the project root';
  const tail = app.blocks === 'acf-composer'
    ? 'ACF Composer rebuilds its manifest on the next request; a stale manifest hides new fields and blocks.'
    : 'Acorn caches config, views and providers until the cache is cleared.';
  return `PHP changed under ${label}: run \`${cacheCommand(detection)}\` before testing. ${tail}`;
}

await runHook('post-edit-reminder', (input) => {
  const cwd = projectDir(input);
  const file = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input.file_path : null;
  const rel = projectRelative(cwd, file);
  if (!rel || !isPhp(rel) || rel.split('/').some((s) => SKIP_SEGMENTS.has(s))) return 0;

  const detection = detect(cwd);
  const app = activeApp(detection);
  if (!app || !isUnderApp(rel, app)) {
    log('INFO', `${rel} is not under the active app; silent`);
    return 0;
  }

  out({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: reminder(app, detection) } });
  return 0;
});
