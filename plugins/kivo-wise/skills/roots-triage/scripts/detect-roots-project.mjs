#!/usr/bin/env node
/**
 * Wrapper so the detector can be invoked by a path relative to this skill
 * folder. The real implementation lives once at the plugin root
 * (scripts/detect-roots-project.mjs) because hooks and commands share it.
 * Two layouts are supported:
 *   - project copy made by scripts/sync-project-skills.mjs: the plugin root is
 *     the hidden `.kivo-wise/` folder beside the skill folders;
 *   - installed plugin: the plugin root is three levels above this file.
 * Arguments are passed through unchanged; stdout/stderr are inherited.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(here, '..', '..', '.kivo-wise', 'scripts', 'detect-roots-project.mjs'),
  resolve(here, '..', '..', '..', 'scripts', 'detect-roots-project.mjs'),
];
const target = candidates.find((p) => existsSync(p));

if (!target) {
  console.log(
    JSON.stringify({
      tool: { name: 'detect-roots-project', version: '0.0.0' },
      error: `detector not found at ${candidates.join(' or ')}; run it from the plugin root`,
    }),
  );
  process.exit(0);
}

const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 0);
