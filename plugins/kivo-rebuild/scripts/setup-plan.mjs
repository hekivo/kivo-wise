#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/setup-plan.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { latestRun, runDir, writeDoc } from './lib/state.mjs';
import * as ga4 from './lib/providers/ga4.mjs';
import * as gtm from './lib/providers/gtm.mjs';
import * as gsc from './lib/providers/gsc.mjs';
import * as cloudflare from './lib/providers/cloudflare.mjs';

export const PROVIDERS = { ga4, gtm, gsc, cloudflare };
const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v);

export function planHash(actions) {
  const clean = actions.map(({ status, result, ...a }) => a);
  return createHash('sha256').update(JSON.stringify(stable(clean))).digest('hex').slice(0, 16);
}

export function renderPlan(plan) {
  return ['# Setup plan', '', 'Nothing is applied until this hash is approved.', '', '| id | provider | op | resource | change | undo |', '|---|---|---|---|---|---|',
    ...plan.actions.map((a) => `| ${a.id} | ${a.provider} | ${a.op} | ${a.resource} | ${a.change} | ${a.undo} |`), '', `**Hash:** \`${plan.hash}\``, ''].join('\n');
}

const refsIn = (v) => (Array.isArray(v) ? v.flatMap(refsIn) : v && typeof v === 'object' ? (typeof v.$from === 'string' ? [v.$from] : Object.values(v).flatMap(refsIn)) : []);

export function checkActions(actions) {
  const errors = [];
  const earlier = new Set();
  for (const a of actions) {
    for (const ref of refsIn(a.params)) if (!earlier.has(ref.split('.')[0])) errors.push(`${a.id}: $from ${ref} must name an earlier action`);
    earlier.add(a.id);
    const p = PROVIDERS[a.provider];
    if (!p) { errors.push(`${a.id}: unknown provider ${a.provider}`); continue; }
    const op = p.actions?.[a.op];
    if (!op) { errors.push(`${a.id}: ${a.provider} has no operation ${a.op}`); continue; }
    for (const e of op.validate(a.params)) errors.push(`${a.id}: ${e}`);
  }
  return errors;
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '' });
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: the setup-planner agent writes runs/<id>/setup-input.json first');
  const dir = runDir(o.project, runId);
  const { actions } = JSON.parse(readFileSync(join(dir, 'setup-input.json'), 'utf8'));
  const errors = checkActions(actions);
  if (errors.length) { for (const e of errors) console.error(e); process.exitCode = 1; return; }
  const plan = { hash: planHash(actions), actions: actions.map((a) => ({ ...a, status: 'planned' })) };
  writeDoc(join(dir, 'setup-plan.json'), 'setup-plan', plan, { runId });
  writeFileSync(join(dir, 'setup-plan.md'), renderPlan(plan));
  console.log(`${actions.length} actions, hash ${plan.hash}: review ${join(dir, 'setup-plan.md')}`);
}

runCli(import.meta.url, main);
