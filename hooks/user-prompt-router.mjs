#!/usr/bin/env node
/**
 * UserPromptSubmit hook: keyword router.
 *
 * Reads skills/roots-router/references/keywords.json (`{ "skill": ["keyword", …] }`, keys
 * starting with `_` are metadata) and, when the prompt matches keywords of exactly one skill,
 * injects a one-line hint. `_triage` lists symptom-first skills (roots-debugging): when several
 * skills match and exactly one of them is a triage skill, it wins and the others are named as
 * follow-ups, so "Livewire errors since the deploy" opens debugging before the Livewire skill.
 * Silent on no match, an unresolved multi-match, empty prompt or bad stdin.
 */

import { join } from 'node:path';
import { PLUGIN_ROOT, loadJson, log, out, runHook } from './lib.mjs';

const KEYWORDS_FILE = join(PLUGIN_ROOT, 'skills', 'roots-router', 'references', 'keywords.json');

export function keywordMap(file = KEYWORDS_FILE) {
  const raw = loadJson(file);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return new Map();
  const map = new Map();
  for (const [skill, keywords] of Object.entries(raw)) {
    if (skill.startsWith('_') || !Array.isArray(keywords)) continue;
    const list = keywords.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.toLowerCase());
    if (list.length) map.set(skill, list);
  }
  return map;
}

/** Skills whose keyword list matches the prompt (case-insensitive substring match). */
export function matchSkills(prompt, map) {
  const text = String(prompt || '').toLowerCase();
  if (!text.trim()) return [];
  const matched = [];
  for (const [skill, keywords] of map) {
    if (keywords.some((k) => text.includes(k))) matched.push(skill);
  }
  return matched;
}

/** Symptom-first skills that win a multi-match (`_triage` in keywords.json). */
export function triageSkills(file = KEYWORDS_FILE) {
  const raw = loadJson(file);
  const list = raw && Array.isArray(raw._triage) ? raw._triage : [];
  return list.filter((s) => typeof s === 'string' && s.trim());
}

/** The skill to hint and the follow-ups, or null when the match stays ambiguous. */
export function resolveMatch(matched, triage = []) {
  if (matched.length === 1) return { skill: matched[0], then: [] };
  if (matched.length < 2) return null;
  const winners = matched.filter((s) => triage.includes(s));
  if (winners.length !== 1) return null;
  return { skill: winners[0], then: matched.filter((s) => s !== winners[0]) };
}

export function hintFor(skill, then = []) {
  const base = `Skill hint: ${skill} (kivo-wise) is relevant; open it before answering.`;
  return then.length ? `${base} Then ${then.join(', ')} if the cause lands there.` : base;
}

await runHook('user-prompt-router', (input) => {
  const matched = matchSkills(input.prompt, keywordMap());
  const pick = resolveMatch(matched, triageSkills());
  if (!pick) {
    log('INFO', `${matched.length} skill match(es); silent`);
    return 0;
  }
  log('INFO', `hint for ${pick.skill}`);
  out({ additionalContext: hintFor(pick.skill, pick.then) });
  return 0;
});
