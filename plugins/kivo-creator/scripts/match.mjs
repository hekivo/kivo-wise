#!/usr/bin/env node
// plugins/kivo-creator/scripts/match.mjs
/**
 * match.mjs: build or check the match plan of a run.
 *   node scripts/match.mjs --catalog [--project=.] [--stack=<detector.json>]   print the block catalog
 *   node scripts/match.mjs --run=.creator/<run> [--project=.] [--force]        write match-plan.json/.md
 *   node scripts/match.mjs --run=.creator/<run> --check [--project=.]          validate decisions, refresh .md
 * --blocks=acf|native: the person's answer when the project's block type for new
 * blocks is not decided (mixed or no blocks; see adapters/shared/block-type.mjs).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadContext } from './lib/context.mjs';
import { buildPlan, checkPlan, formatPlan } from './lib/match.mjs';
import { readSpecs, checkSpec } from './lib/spec.mjs';
import { readJson, runPaths, writeJson } from './lib/run.mjs';

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', stack: '', blocks: '', check: false, catalog: false, force: false });
  const ctx = await loadContext(o);
  if (o.catalog) { console.log(JSON.stringify(ctx.catalog, null, 2)); return; }
  if (!o.run) throw new Error('usage: match.mjs --run=<.creator/run> [--check] [--force] [--project=.] | --catalog');
  const runDir = resolve(o.run);
  const paths = runPaths(runDir);
  if (o.check) {
    const plan = { ...readJson(paths.plan), blockType: ctx.blockType };
    writeJson(paths.plan, plan);
    writeFileSync(paths.planMd, formatPlan(plan));
    const errors = checkPlan(plan, ctx.catalog, { allowsGeneratedBlocks: ctx.adapter.allowsGeneratedBlocks, blockType: ctx.blockType });
    if (errors.length) { for (const e of errors) console.error(e); process.exitCode = 1; return; }
    console.log(`match plan ok: ${plan.sections.length} sections`);
    return;
  }
  if (existsSync(paths.plan) && !o.force) throw new Error(`${relative(process.cwd(), paths.plan)} exists; edit it and run --check, or pass --force to rebuild it`);
  const specs = readSpecs(paths.specs);
  if (!specs.length) throw new Error(`no specs in ${relative(process.cwd(), paths.specs)}`);
  for (const spec of specs) {
    const errors = checkSpec(spec);
    if (errors.length) throw new Error(`invalid spec ${spec.id}: ${errors.join('; ')}`);
  }
  const plan = buildPlan({ run: basename(runDir), adapter: ctx.adapter.name, specs, catalog: ctx.catalog, allowsGeneratedBlocks: ctx.adapter.allowsGeneratedBlocks, blockType: ctx.blockType });
  writeJson(paths.plan, plan);
  writeFileSync(paths.planMd, formatPlan(plan));
  console.log(JSON.stringify({ plan: relative(process.cwd(), paths.plan), judge: plan.sections.filter((s) => !s.decision).map((s) => s.spec), blockType: ctx.blockType }, null, 2));
}

runCli(import.meta.url, main);
