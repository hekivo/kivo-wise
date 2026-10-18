#!/usr/bin/env node
/**
 * Quality scores per skill: five Jev Score questions per SKILL.md, combined into a weighted
 * composite in code (weights below; change them without re-running inference by passing
 * --from results/scores-<label>.json).
 *
 *   node dev/jev-review/scores.mjs --label before [--only skill1,skill2] [--from file] [--dry-run]
 */

import { readFileSync } from 'node:fs';
import { argValue, ask, loadSkills, pool, requireKey, writeResult } from './lib.mjs';

const label = argValue('--label', 'run');
const only = argValue('--only');
const from = argValue('--from');
const dryRun = process.argv.includes('--dry-run');

export const WEIGHTS = { trigger: 0.25, profiles: 0.15, procedure: 0.25, runner: 0.15, native: 0.2 };

export const QUESTIONS = {
  trigger: {
    type: 'score',
    instructions: {
      question: 'How precisely does `description` tell an assistant when to open this skill and when to open a different one instead?',
      note: '`description` is the only text the assistant sees before choosing a skill.',
    },
    criteria: [
      'The description names only a broad topic (for example "WordPress performance") with no concrete function names, commands, file paths or error messages, and never names another skill to use instead.',
      'The description names a few concrete identifiers (functions, commands, files or error messages) but never names another skill to use for neighbouring requests.',
      'The description names concrete identifiers and sends one neighbouring kind of request to another named skill ("For X use skill-y").',
      'The description names concrete identifiers, quoted error messages or phrases developers type, and sends at least two neighbouring kinds of request to other named skills, so its boundary is explicit.',
    ],
  },
  profiles: {
    type: 'score',
    instructions: 'How well does `body` state the differences between the three project layouts sage-theme (a Sage theme), acorn-mu-plugin (Acorn inside a must-use plugin) and radicle-app (Acorn at the project root) at the steps where the layout changes the answer?',
    criteria: [
      'The body never mentions sage-theme, acorn-mu-plugin or radicle-app, nor any difference between a theme, a must-use plugin and a project root.',
      'The body names the layouts but gives paths, commands or registration points for only one of them.',
      'The body gives layout-specific paths, commands or registration points for some steps, but at least one step where the layout clearly changes the answer gives a single answer for all layouts.',
      'Wherever the layout changes the answer (paths, base path, registration point, installed packages, commands), the body states what differs for sage-theme, acorn-mu-plugin and radicle-app, for example in a per-layout table.',
    ],
  },
  procedure: {
    type: 'score',
    instructions: 'How directly can a developer follow the Procedure section of `body`?',
    criteria: [
      'There is no Procedure section, or it is prose advice without ordered steps.',
      'The Procedure has ordered steps, but they are abstract ("check the configuration", "apply best practices") and name no files, commands or checks.',
      'Most steps name the file to open, the command to run or the check to make, but some steps leave the reader guessing what to do or how to tell it worked.',
      'Every step names a concrete file, command or check and how to confirm the result, so a developer new to the project can follow it without guessing.',
    ],
  },
  runner: {
    type: 'score',
    instructions: 'How consistently does `body` route project commands (wp, composer, php, artisan, yarn, npm, node build tools) through the runner placeholders such as {{runner.wp}}, {{runner.composer}} or {{runner.acorn}}?',
    criteria: [
      'The body tells the reader to run wp, composer, php, yarn or npm directly on the host, with no runner placeholder.',
      'The body uses runner placeholders for some commands but also shows bare host commands for others without saying where they run.',
      'Every local project command uses a runner placeholder, but commands meant for CI, deploy, staging or production are mixed in with local commands without a label.',
      'Every local project command uses a runner placeholder, and the body either has no CI, deploy or production commands or labels each of them with where it runs.',
    ],
  },
  native: {
    type: 'score',
    instructions: 'How well does `body` name the native WordPress, ACF or Acorn mechanism for its task and say where that mechanism was verified?',
    criteria: [
      'The body never names a native WordPress, ACF or Acorn mechanism for its task and never says to look for one before writing custom code.',
      'The body says to prefer native or built-in mechanisms in general terms, without naming specific hooks, functions, classes or commands.',
      'The body names the specific native hooks, functions, classes or commands to use, but does not say where they were verified (no source file path and no version).',
      'The body names the specific native mechanism and where it was verified: a local source file path (for example wp-includes/... or vendor/...) or a "verified" note naming a file or version.',
    ],
  },
};

function composite(scores) {
  // Normalise each 0..3 Score to 0..1, weight, sum.
  let total = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) total += w * (scores[k].score / 3);
  return Number(total.toFixed(3));
}

let rows;
if (from) {
  rows = JSON.parse(readFileSync(from, 'utf8')).rows;
} else {
  let skills = loadSkills();
  if (only) skills = skills.filter((s) => only.split(',').includes(s.name));
  if (dryRun) {
    console.log(JSON.stringify({ state: { skill: skills[0].name, description: skills[0].description, body: `${skills[0].body.slice(0, 200)}…` }, questions: QUESTIONS }, null, 2));
    process.exit(0);
  }
  requireKey();
  rows = await pool(skills, 4, async (s) => {
    const res = await ask({ skill: s.name, description: s.description, body: s.body }, QUESTIONS, { tag: `scores-${label}` });
    const scores = Object.fromEntries(Object.keys(QUESTIONS).map((k) => [k, { score: Number(res.answers[k].score.toFixed(2)), confidence: Number(res.answers[k].confidence.toFixed(2)) }]));
    return { skill: s.name, scores };
  });
}
for (const r of rows) r.composite = composite(r.scores);
rows.sort((a, b) => a.composite - b.composite);
writeResult(`scores-${label}.json`, { weights: WEIGHTS, rows });
console.log('skill                      composite  trigger profiles procedure runner native');
for (const r of rows) {
  const s = r.scores;
  console.log(`${r.skill.padEnd(26)} ${r.composite.toFixed(3).padStart(8)}  ${[s.trigger, s.profiles, s.procedure, s.runner, s.native].map((x) => x.score.toFixed(2).padStart(7)).join(' ')}`);
}
