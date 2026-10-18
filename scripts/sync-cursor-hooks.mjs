#!/usr/bin/env node
/**
 * sync-cursor-hooks.mjs
 *
 * Generates hooks/cursor-hooks.json from hooks/hooks.json.
 *
 * Claude Code and Cursor use different hook event names and schemas. To avoid
 * drift between the two files, hooks.json is the source of truth and the
 * Cursor variant is generated mechanically from it.
 *
 * Run manually:    node scripts/sync-cursor-hooks.mjs
 * CI verification: node scripts/sync-cursor-hooks.mjs --check
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'hooks', 'hooks.json');
const DST = resolve(ROOT, 'hooks', 'cursor-hooks.json');

// Claude Code event -> Cursor event mapping
const EVENT_MAP = {
  UserPromptSubmit: 'userPromptSubmit',
  SessionStart: 'sessionStart',
  PostToolUse: {
    // PostToolUse with matcher 'Write|Edit' maps to Cursor's afterFileEdit
    matchers: {
      'Write|Edit': 'afterFileEdit',
      Write: 'afterFileEdit',
      Edit: 'afterFileEdit',
    },
  },
  PreToolUse: {
    // PreToolUse with matcher 'Bash' maps to Cursor's beforeShellExecution (needs matcher field)
    // PreToolUse on the file-editing tools maps to Cursor's beforeFileEdit
    matchers: {
      Bash: {
        event: 'beforeShellExecution',
        matcher: 'git commit', // Cursor-level matcher for the pre-commit hook
      },
      'Write|Edit': 'beforeFileEdit',
      'Write|Edit|MultiEdit|NotebookEdit': 'beforeFileEdit',
    },
  },
  PostCompact: 'preCompact',
  SubagentStop: 'subagentStop',
  Stop: 'stop',
};

/**
 * Rewrite a Claude Code command for Cursor: Claude uses ${CLAUDE_PLUGIN_ROOT}/...,
 * Cursor uses ./... (relative to plugin root). Hooks are `node "<path>.mjs"` commands.
 */
function rewriteCommand(claudeCommand) {
  return claudeCommand.replace(/\$\{CLAUDE_PLUGIN_ROOT\}\//g, './');
}

/**
 * Translate a single Claude hook entry into its Cursor equivalent.
 * Returns { event, entry } or null if no mapping exists.
 */
function translate(claudeEvent, claudeGroup) {
  const mapping = EVENT_MAP[claudeEvent];

  if (!mapping) return null;

  // Simple string mapping
  if (typeof mapping === 'string') {
    return claudeGroup.hooks.map((h) => ({
      event: mapping,
      entry: { command: rewriteCommand(h.command) },
    }));
  }

  // Matcher-dependent mapping
  if (mapping.matchers) {
    const matcher = claudeGroup.matcher || '';
    const resolved = mapping.matchers[matcher];
    if (!resolved) return null;

    if (typeof resolved === 'string') {
      return claudeGroup.hooks.map((h) => ({
        event: resolved,
        entry: { command: rewriteCommand(h.command) },
      }));
    }

    // Object form with additional fields
    return claudeGroup.hooks.map((h) => ({
      event: resolved.event,
      entry: {
        command: rewriteCommand(h.command),
        ...(resolved.matcher ? { matcher: resolved.matcher } : {}),
      },
    }));
  }

  return null;
}

function generate(claudeConfig) {
  const cursorHooks = {};

  for (const [claudeEvent, groups] of Object.entries(claudeConfig.hooks)) {
    for (const group of groups) {
      const translations = translate(claudeEvent, group);
      if (!translations) continue;

      for (const { event, entry } of translations) {
        if (!cursorHooks[event]) cursorHooks[event] = [];
        cursorHooks[event].push(entry);
      }
    }
  }

  return { hooks: cursorHooks };
}

function main() {
  const isCheck = process.argv.includes('--check');

  const claudeConfig = JSON.parse(readFileSync(SRC, 'utf8'));
  const generated = generate(claudeConfig);
  const generatedStr = JSON.stringify(generated, null, 2) + '\n';

  if (isCheck) {
    const current = readFileSync(DST, 'utf8');
    if (current !== generatedStr) {
      console.error(
        `cursor-hooks.json is out of sync with hooks.json.\n` +
          `Run: node scripts/sync-cursor-hooks.mjs`
      );
      process.exit(1);
    }
    console.log('cursor-hooks.json is in sync with hooks.json');
    return;
  }

  writeFileSync(DST, generatedStr);
  console.log(`Wrote ${DST} from ${SRC}`);
}

main();
