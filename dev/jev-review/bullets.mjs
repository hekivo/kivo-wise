#!/usr/bin/env node
/**
 * Per-bullet judgment of eval answers: one Jev Noul per expectation bullet
 * (evals/<case>/graders/expectations.md) with the case's latest final answer as state.
 * Latest = the newest results file that contains the case (run-3b-*.json, run-3.json, run-2.json).
 *
 *   node dev/jev-review/bullets.mjs --label before [--only case1,case2] [--dry-run]
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, argValue, ask, pool, requireKey, writeResult } from './lib.mjs';

const label = argValue('--label', 'run');
const only = argValue('--only');
const dryRun = process.argv.includes('--dry-run');
const RESULT_FILES = ['run-3b-testing-wp.json', 'run-3.json', 'run-2.json'];
const FAIL = 0.5;
const BORDER = [0.35, 0.65];

function cases() {
  const evals = join(ROOT, 'evals');
  const out = [];
  for (const d of readdirSync(evals, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name === 'results') continue;
    if (d.name === 'agents') {
      for (const a of readdirSync(join(evals, 'agents'), { withFileTypes: true })) {
        if (a.isDirectory()) out.push({ name: `agent-${a.name}`, dir: join(evals, 'agents', a.name) });
      }
    } else out.push({ name: d.name, dir: join(evals, d.name) });
  }
  return out.filter((c) => existsSync(join(c.dir, 'graders', 'expectations.md')));
}

function parseExpectations(file) {
  const body = readFileSync(file, 'utf8').replace(/^---[\s\S]*?---\n/, '');
  const bullets = body.split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2).trim());
  const preamble = body.split('\n').filter((l) => l.trim() && !/^- /.test(l) && !/^(PASS|FAIL) /.test(l) && !/^Judge the substance/.test(l)).join(' ').trim();
  return { bullets, preamble };
}

const resultSets = RESULT_FILES.map((f) => join(ROOT, 'evals', 'results', f)).filter(existsSync).map((f) => ({ file: f, data: JSON.parse(readFileSync(f, 'utf8')) }));

function latestAnswer(name) {
  for (const { file, data } of resultSets) {
    const c = data.cases.find((x) => x.name === name);
    const arm = c?.arms?.with?.[0];
    const g = arm?.graders?.find((x) => x.name === 'expectations');
    if (g && g.evidence) return { file: file.split('/').pop(), prompt: c.promptMarkdown, answer: g.evidence, judge: g.explanation, passed: g.passed };
  }
  return null;
}

let list = cases();
if (only) list = list.filter((c) => only.split(',').includes(c.name));

const jobs = list.map((c) => ({ ...c, ...parseExpectations(join(c.dir, 'graders', 'expectations.md')), latest: latestAnswer(c.name) })).filter((c) => c.latest);

function questionsFor(job) {
  return Object.fromEntries(
    job.bullets.map((b, i) => [
      `b${i}`,
      {
        type: 'noul',
        instructions: {
          context: job.preamble || 'The assistant answered the request in `request`; its final answer is `answer`.',
          if_rule: 'If the expectation starts with "if", it is satisfied when its condition does not apply to the project described in `answer`.',
          question: `Does \`answer\` satisfy this expectation: "${b}"?`,
        },
        criteria: {
          true: 'The answer does what the expectation asks, in substance (wording may differ), or the expectation is conditional and its condition does not apply.',
          false: 'The answer leaves out what the expectation asks, or does the opposite.',
        },
      },
    ]),
  );
}

if (dryRun) {
  const j = jobs[0];
  console.log(JSON.stringify({ state: { request: j.latest.prompt, answer: `${j.latest.answer.slice(0, 200)}…` }, questions: questionsFor(j) }, null, 2));
  process.exit(0);
}
requireKey();

const rows = await pool(jobs, 4, async (job) => {
  const res = await ask({ request: job.latest.prompt, answer: job.latest.answer }, questionsFor(job), { tag: `bullets-${label}` });
  const bullets = job.bullets.map((b, i) => {
    const p = res.answers[`b${i}`].noul;
    return { bullet: b, p: Number(p.toFixed(3)), fails: p < FAIL, borderline: p >= BORDER[0] && p <= BORDER[1] };
  });
  return { case: job.name, source: job.latest.file, judge: job.latest.judge, judge_passed: job.latest.passed, failing: bullets.filter((b) => b.fails).length, bullets };
});

rows.sort((a, b) => b.failing - a.failing || a.case.localeCompare(b.case));
writeResult(`bullets-${label}.json`, rows);
for (const r of rows) {
  console.log(`\n${r.case} [${r.source}] judge=${r.judge_passed ? 'PASS' : 'FAIL'} (${r.judge}) failing=${r.failing}`);
  for (const b of r.bullets) if (b.fails || b.borderline) console.log(`  ${b.fails ? 'FAIL' : 'BORD'} ${b.p.toFixed(2)}  ${b.bullet}`);
}
