#!/usr/bin/env node
/**
 * PreToolUse hook on Bash: surfaces the project's "no AI attribution" rule before a git commit.
 *
 * When the command contains `git commit` and AGENTS.md or CLAUDE.md in the cwd (or up to three
 * parent directories) forbids AI attribution, injects additionalContext naming the file. Silent
 * otherwise. Never blocks.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { log, out, projectDir, runHook } from './lib.mjs';

export const ATTRIBUTION_RULE = /no ai attribution|Co-Authored-By.*AI|never add ai attribution/i;
const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md'];
const MAX_PARENTS = 3;

export function isGitCommit(command) {
  return typeof command === 'string' && /\bgit\s+commit\b/.test(command);
}

/** Name of the first instruction file (cwd first, then up to three parents) that carries the rule, or null. */
export function findRule(cwd) {
  let dir = resolve(cwd);
  for (let level = 0; level <= MAX_PARENTS; level += 1) {
    for (const name of INSTRUCTION_FILES) {
      const file = join(dir, name);
      if (!existsSync(file)) continue;
      try {
        if (ATTRIBUTION_RULE.test(readFileSync(file, 'utf8'))) return name;
      } catch {
        /* unreadable file: keep looking */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function message(file) {
  return `This repository forbids AI attribution in commits (${file}). Do not add Co-Authored-By or Generated-with lines.`;
}

await runHook('pre-commit-attribution', (input) => {
  if (input.tool_name !== 'Bash') return 0;
  const command = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input.command : null;
  if (!isGitCommit(command)) return 0;

  const file = findRule(projectDir(input));
  if (!file) {
    log('INFO', 'no attribution rule found; silent');
    return 0;
  }
  out({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: message(file) } });
  return 0;
});
