#!/usr/bin/env node
/**
 * SessionStart hook (startup, resume, clear, compact).
 *
 * Runs the detector on the project and, when a Roots profile is found, injects a compact
 * factual summary (≤ 1,500 chars): profile, namespace, versions, runner commands, the
 * reading-order rules, the command-writing rule, the skill routing table and the detector
 * warnings. Silent when the project is not a Roots stack, when stdin is unusable or when
 * the detector fails.
 */

import { join } from 'node:path';
import { PLUGIN_ROOT, activeApp, detect, loadJson, log, out, projectDir, runHook, runners } from './lib.mjs';

export const MAX_CONTEXT_CHARS = 1500;
const ROUTING_FILE = join(PLUGIN_ROOT, 'skills', 'roots-router', 'references', 'routing.json');

const VERSION_LABELS = [
  ['roots/acorn', 'Acorn'],
  ['livewire/livewire', 'Livewire'],
  ['log1x/acf-composer', 'ACF Composer'],
  ['log1x/poet', 'Poet'],
];
const SITE_VERSION_LABELS = [
  ['roots/wordpress', 'WordPress'],
  ['johnpbloch/wordpress', 'WordPress'],
  ['wpengine/advanced-custom-fields-pro', 'ACF Pro'],
];
const RUNNER_KEYS = ['wp', 'acorn', 'composer', 'node', 'test', 'lint', 'cache', 'logs'];

function versionParts(versions, labels) {
  const parts = [];
  const seen = new Set();
  for (const [pkg, label] of labels) {
    const v = versions && versions[pkg];
    if (!v || seen.has(label)) continue;
    seen.add(label);
    parts.push(`${label} ${v}`);
  }
  return parts;
}

export function profileLine(detection) {
  const app = activeApp(detection);
  const parts = ['kivo-wise'];
  if (app) {
    parts.push(`profile ${app.kind} @ ${app.path || '.'}`);
    if (app.namespace) parts.push(`ns ${app.namespace}`);
    parts.push(...versionParts(app.versions, VERSION_LABELS));
  } else {
    parts.push(`layout ${detection.layout}`);
    if (detection.coreDir) parts.push(`core ${detection.coreDir}`);
    parts.push('no Acorn app detected');
  }
  parts.push(...versionParts(detection.site && detection.site.versions, SITE_VERSION_LABELS));
  if (app) {
    if (app.blocks) parts.push(`blocks ${app.blocks}`);
    if (app.postTypes) parts.push(`post types ${app.postTypes}`);
  }
  return parts.join(' · ');
}

export function runnerLine(detection) {
  const runner = detection.runtime && detection.runtime.runner;
  const cmds = runners(detection);
  const parts = RUNNER_KEYS.filter((k) => cmds[k]).map((k) => `${k}=${cmds[k]}`);
  if (!runner || runner === 'none') {
    return 'runner: none detected (no .lando.yml or .ddev); use the commands the project documents';
  }
  if (parts.length === 0) return `runner: ${runner}`;
  return `runner: ${runner} · ${parts.join(' · ')}`;
}

export function corpusRoots(cwd, detection) {
  const brain = loadJson(join(cwd, '.docs-brain.json'));
  if (brain && Array.isArray(brain.roots) && brain.roots.length) return brain.roots.map(String);
  const flagCorpus = detection.flag && Array.isArray(detection.flag.corpus) ? detection.flag.corpus : null;
  if (flagCorpus && flagCorpus.length) return flagCorpus.map(String);
  const flagFile = loadJson(join(cwd, '.roots-stack.json'));
  if (flagFile && Array.isArray(flagFile.corpus) && flagFile.corpus.length) return flagFile.corpus.map(String);
  return [];
}

export function rulesLine(cwd, detection) {
  const roots = corpusRoots(cwd, detection);
  const corpus = roots.length ? roots.join(', ') : 'none configured';
  const hasRunner = detection.runtime && detection.runtime.runner && detection.runtime.runner !== 'none';
  const parts = [
    `project AGENTS.md first, corpus second (${corpus}), web last`,
    'verify native source before custom code',
  ];
  return `rules: ${parts.join('; ')}`;
}

/**
 * Instruction-shaped fact about how to write commands. Answers kept writing bare `wp acorn …`
 * or "prefix with lando if you use Lando" while the runner line was in context, so the rule
 * names the runner explicitly, gives a concrete example taken from the runner commands and
 * covers commands meant for CI or a deploy host. Null when no runner was detected.
 */
export function commandsLine(detection) {
  const runner = detection.runtime && detection.runtime.runner;
  if (!runner || runner === 'none') return null;
  const cmds = runners(detection);
  const example = cmds.acorn
    ? `${cmds.acorn} optimize:clear`
    : cmds.wp
      ? `${cmds.wp} cache flush`
      : `${runner} <cmd>`;
  return (
    'commands: write every wp/acorn/composer/node/test command exactly as on the runner line ' +
    `(e.g. \`${example}\`), in examples too, never bare or "prefix if you use ${runner}"; ` +
    'CI/deploy commands that run outside the local runner go in a separate block labelled with where they run'
  );
}

/** Accepts `{ routes: [{skill, use}] }`, `[{skill, use}]` or `{ skill: "use" }`; keys starting with `_` are metadata. */
export function routingEntries(routing) {
  if (!routing) return [];
  const list = Array.isArray(routing) ? routing : Array.isArray(routing.routes) ? routing.routes : null;
  if (list) {
    return list
      .filter((r) => r && typeof r.skill === 'string')
      .map((r) => ({ skill: r.skill, use: String(r.use || r.when || r.description || '').trim() }));
  }
  if (typeof routing === 'object') {
    return Object.entries(routing)
      .filter(([k, v]) => !k.startsWith('_') && typeof v === 'string')
      .map(([skill, use]) => ({ skill, use: use.trim() }));
  }
  return [];
}

/**
 * Skill names only: the full "skill → use" table lives in roots-router and would not fit the
 * context budget once every skill is listed. Per-prompt hints come from the UserPromptSubmit router.
 */
export function skillsLine(routingFile = ROUTING_FILE) {
  const entries = routingEntries(loadJson(routingFile));
  if (entries.length === 0) return null;
  const names = entries.map((e) => e.skill).filter((s) => s !== 'roots-router');
  return `skills: start with roots-router (profile x intent); available: ${names.join(', ')}`;
}

export function warningsLine(detection) {
  const warnings = Array.isArray(detection.warnings) ? detection.warnings.filter(Boolean).map(String) : [];
  if (detection.truncated) warnings.push('detector walk truncated (file cap reached)');
  return warnings.length ? `warnings: ${warnings.join(' · ')}` : null;
}

export function clamp(text, max = MAX_CONTEXT_CHARS) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildContext(cwd, detection, routingFile = ROUTING_FILE) {
  // Warnings come before the skills list so a long list can never push them past the cap;
  // the skills line is the one that gets shortened when the budget runs out.
  const head = [
    profileLine(detection),
    runnerLine(detection),
    rulesLine(cwd, detection),
    commandsLine(detection),
    warningsLine(detection),
  ].filter(Boolean).join('\n');
  const skills = skillsLine(routingFile);
  if (!skills) return clamp(head);
  const room = MAX_CONTEXT_CHARS - head.length - 1;
  if (room < 40) return clamp(head);
  return `${head}\n${clamp(skills, room)}`;
}

export function isRootsProject(detection) {
  if (!detection) return false;
  const apps = Array.isArray(detection.apps) ? detection.apps : [];
  return !(detection.layout === 'unknown' && apps.length === 0);
}

await runHook('session-start', (input) => {
  const cwd = projectDir(input);
  const detection = detect(cwd);
  if (!isRootsProject(detection)) {
    log('INFO', `no Roots profile in ${cwd}; silent`);
    return 0;
  }
  const additionalContext = buildContext(cwd, detection);
  log('INFO', `injecting ${additionalContext.length} chars for ${cwd}`);
  out({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } });
  return 0;
});
