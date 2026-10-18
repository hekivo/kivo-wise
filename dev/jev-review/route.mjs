#!/usr/bin/env node
/**
 * Routing review: one Jev Choice per request in prompts.json. Options are the plugin's skills
 * (criteria = each skill's current `description`) plus `none`. Also replays the same requests
 * through the UserPromptSubmit keyword router (hooks/user-prompt-router.mjs) for comparison.
 *
 *   node dev/jev-review/route.mjs --label before [--only id1,id2] [--dry-run] [--keywords-only]
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, ROOT, argValue, ask, loadSkills, pool, requireKey, seededShuffle, writeResult } from './lib.mjs';

const label = argValue('--label', 'run');
const only = argValue('--only');
const dryRun = process.argv.includes('--dry-run');
const keywordsOnly = process.argv.includes('--keywords-only');
const LOW_CONFIDENCE = 0.5;

const NONE_CRITERION =
  'No skill applies: the request is not about a WordPress project on the Roots stack (Sage, Acorn, Bedrock, Radicle) or its local tooling - for example generic PHP or shell questions, other frameworks, infrastructure unrelated to WordPress, or non-technical writing.';

const INSTRUCTIONS = {
  question:
    'A coding assistant has the skills listed in the options. Which ONE skill should it open first to handle `request`? Use `project_profile` as context when it is set. Choose `none` when no skill covers the request.',
  rule: 'Match the task the developer wants done, not words that merely appear in the request.',
};

function keywordRouter(prompt) {
  const env = { ...process.env };
  delete env.TYPESAFE_API_KEY;
  delete env.KIVO_WISE_HOOK_DEBUG;
  const r = spawnSync(process.execPath, [join(ROOT, 'hooks', 'user-prompt-router.mjs')], {
    input: JSON.stringify({ prompt }),
    encoding: 'utf8',
    env,
    cwd: HERE,
  });
  const m = (r.stdout || '').match(/Skill hint: ([\w-]+)/);
  return m ? m[1] : 'none';
}

const skills = loadSkills();
const criteria = Object.fromEntries(skills.map((s) => [s.name, s.description]));
criteria.none = NONE_CRITERION;
let prompts = JSON.parse(readFileSync(join(HERE, 'prompts.json'), 'utf8')).prompts;
if (only) prompts = prompts.filter((p) => only.split(',').includes(p.id));

if (dryRun) {
  const p = prompts[0];
  const options = seededShuffle(Object.keys(criteria), p.id);
  console.log(JSON.stringify({ state: { request: p.text, project_profile: p.profile ?? 'unknown' }, questions: { skill: { type: 'choice', instructions: INSTRUCTIONS, criteria: Object.fromEntries(options.map((o) => [o, criteria[o]])) } } }, null, 2));
  process.exit(0);
}
if (keywordsOnly) {
  // Offline: score only the UserPromptSubmit keyword router (no TypeSafe calls).
  const kw = prompts.map((p) => ({ id: p.id, expected: p.expected, keyword: keywordRouter(p.text) }));
  const ok = kw.filter((r) => r.keyword === r.expected).length;
  const wrong = kw.filter((r) => r.keyword !== 'none' && r.keyword !== r.expected);
  const silent = kw.filter((r) => r.keyword === 'none' && r.expected !== 'none');
  writeResult(`keywords-${label}.json`, kw);
  console.log(JSON.stringify({ accuracy: ok / kw.length, wrong_hint: wrong.length, silent_on_skill_requests: silent.length, wrong, silent: silent.map((r) => r.id) }, null, 2));
  process.exit(0);
}
requireKey();

const rows = await pool(prompts, 4, async (p) => {
  const options = seededShuffle(Object.keys(criteria), p.id);
  const question = { type: 'choice', instructions: INSTRUCTIONS, criteria: Object.fromEntries(options.map((o) => [o, criteria[o]])) };
  const res = await ask({ request: p.text, project_profile: p.profile ?? 'unknown' }, { skill: question }, { tag: `route-${label}` });
  const a = res.answers.skill;
  const ranked = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1]);
  return {
    id: p.id,
    expected: p.expected,
    choice: a.choice,
    confidence: a.confidence,
    top2: ranked.slice(0, 2).map(([k, v]) => ({ skill: k, p: Number(v.toFixed(3)) })),
    p_expected: Number((a.probabilities[p.expected] ?? 0).toFixed(3)),
    keyword: keywordRouter(p.text),
    text: p.text,
  };
});

// ---- metrics (all in code) ----
const n = rows.length;
const correct = rows.filter((r) => r.choice === r.expected);
const top2 = rows.filter((r) => r.top2.some((t) => t.skill === r.expected));
const kwCorrect = rows.filter((r) => r.keyword === r.expected);
const kwSilent = rows.filter((r) => r.keyword === 'none' && r.expected !== 'none');
const confusion = {};
for (const r of rows) {
  confusion[r.expected] ??= {};
  confusion[r.expected][r.choice] = (confusion[r.expected][r.choice] || 0) + 1;
}
// Confusable pairs: probability mass the expected skill loses to each other skill, summed over requests.
const pairMass = {};
for (const r of rows) {
  for (const t of r.top2) {
    if (t.skill === r.expected) continue;
    const key = [r.expected, t.skill].sort().join(' <-> ');
    pairMass[key] = (pairMass[key] || 0) + t.p;
  }
}
const pairs = Object.entries(pairMass).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([pair, mass]) => ({ pair, mass: Number(mass.toFixed(2)) }));
const misroutes = rows.filter((r) => r.choice !== r.expected);
const lowConf = rows.filter((r) => r.confidence < LOW_CONFIDENCE);

const summary = {
  label,
  n,
  jev: { accuracy: correct.length / n, top2: top2.length / n, low_confidence: lowConf.length },
  keyword_router: { accuracy: kwCorrect.length / n, silent_on_skill_requests: kwSilent.length, wrong_hint: rows.filter((r) => r.keyword !== 'none' && r.keyword !== r.expected).length },
  pairs,
  misroutes: misroutes.map(({ id, expected, choice, confidence, p_expected }) => ({ id, expected, choice, confidence: Number(confidence.toFixed(2)), p_expected })),
  low_confidence: lowConf.map(({ id, expected, choice, confidence, top2 }) => ({ id, expected, choice, confidence: Number(confidence.toFixed(2)), top2 })),
  keyword_misses: rows.filter((r) => r.keyword !== r.expected).map(({ id, expected, keyword }) => ({ id, expected, keyword })),
  confusion,
};
writeResult(`route-${label}.json`, { summary, rows });
console.log(JSON.stringify({ ...summary, confusion: undefined }, null, 2));
