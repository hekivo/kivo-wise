#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/setup-apply.mjs
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { googleToken, GOOGLE_SCOPES } from './lib/credentials.mjs';
import { latestRun, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';
import { PROVIDERS, planHash } from './setup-plan.mjs';

export function checkApproval(plan, approved) {
  if (approved !== plan.hash) throw new Error(`approved hash ${approved} does not match the plan hash ${plan.hash}`);
  if (planHash(plan.actions) !== plan.hash) throw new Error('plan changed after approval: re-run setup-plan.mjs and approve again');
}

// A param may be {"$from": "A1.field"}: the value comes from an earlier action's result at apply time
// (a property created in A1, then a stream inside it). The plan hash covers the reference, not the value.
export function resolveRefs(value, results) {
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, results));
  if (value && typeof value === 'object') {
    if (typeof value.$from === 'string' && Object.keys(value).length === 1) {
      const [id, ...path] = value.$from.split('.');
      if (!results.has(id)) throw new Error(`$from ${value.$from}: action ${id} has not been applied before this one`);
      const out = path.reduce((v, k) => v?.[k], results.get(id));
      if (out === undefined || out === null || out === '') throw new Error(`$from ${value.$from}: no such value in the result of ${id}`);
      return out;
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, results)]));
  }
  return value;
}

export async function applyPlan(plan, { providers = PROVIDERS, token, fetchImpl = fetch, env = process.env, exec } = {}) {
  const undo = [];
  const results = new Map();
  for (const a of plan.actions) {
    if (a.status === 'applied') { undo.unshift(a.undo); results.set(a.id, a.result); continue; }
    try {
      const params = resolveRefs(a.params, results);
      a.result = await providers[a.provider].actions[a.op].apply(params, { token, fetchImpl, env, ...(exec ? { exec } : {}) });
      results.set(a.id, a.result);
      a.status = 'applied';
      undo.unshift(a.undo);
    } catch (e) {
      a.status = 'failed';
      a.result = { error: String(e.message).slice(0, 200) };
      return { failed: a.id, error: a.result.error, undo };
    }
  }
  return { failed: null, undo };
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', approved: '' });
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: run setup-plan.mjs first');
  const file = join(runDir(o.project, runId), 'setup-plan.json');
  const doc = readDoc(file);
  if (!doc) throw new Error(`${file} not found: run setup-plan.mjs first`);
  const { schema_version, kind, run_id, generated_at, ...plan } = doc;
  checkApproval(plan, o.approved);
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const google = plan.actions.some((a) => ['ga4', 'gtm', 'gsc'].includes(a.provider) && a.status !== 'applied');
  const token = google ? await googleToken(config.setup?.service_account ?? config.gsc?.service_account, GOOGLE_SCOPES.write) : '';
  const out = await applyPlan(plan, { token });
  writeDoc(file, 'setup-plan', plan, { runId });
  for (const a of plan.actions) console.log(`${a.id} ${a.status}`);
  if (out.failed) {
    console.error(`failed ${out.failed}: ${out.error}`);
    if (out.undo.length) console.error(`to undo what was applied:\n${out.undo.map((u) => `  - ${u}`).join('\n')}`);
    process.exitCode = 1;
  }
}

runCli(import.meta.url, main);
