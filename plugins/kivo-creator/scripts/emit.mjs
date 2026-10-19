#!/usr/bin/env node
// plugins/kivo-creator/scripts/emit.mjs
/**
 * emit.mjs: turn an approved match plan into page markup and scaffolded
 * blocks. Writes ONLY under .creator/<run>/: page.html, scaffold/<project
 * paths>, emitted.json. Copying scaffold files into the project is a reviewed
 * step of the block-scaffolding-from-design skill, after the project's
 * generator ran.
 *
 * Usage: node scripts/emit.mjs --run=.creator/<run> [--project=.] [--stack=<detector.json>] [--selector=<css>]
 * emitted.json records the CSS selector of one rendered section for verify.mjs:
 * --selector when given, else the adapter default.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadContext } from './lib/context.mjs';
import { checkPlan } from './lib/match.mjs';
import { assign } from './lib/fill.mjs';
import { readSpecs } from './lib/spec.mjs';
import { readJson, runPaths, writeJson } from './lib/run.mjs';

const posix = (p) => p.split('\\').join('/');

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', stack: '', selector: '' });
  if (!o.run) throw new Error('usage: emit.mjs --run=<.creator/run> [--project=.]');
  const ctx = await loadContext(o);
  const project = resolve(o.project);
  const runDir = resolve(o.run);
  const paths = runPaths(runDir);
  const plan = readJson(paths.plan);
  const errors = checkPlan(plan, ctx.catalog, { allowsGeneratedBlocks: ctx.adapter.allowsGeneratedBlocks });
  if (errors.length) throw new Error(`the match plan is not approved yet:\n${errors.join('\n')}`);
  const specs = new Map(readSpecs(paths.specs).map((s) => [s.id, s]));
  const catalog = [...ctx.catalog];
  const entries = [];
  const out = { adapter: ctx.adapter.name, selector: o.selector || ctx.adapter.selector, page: posix(relative(project, paths.page)), files: [], commands: [], media: [], gaps: [], proposals: [], notes: [] };
  for (const section of plan.sections) {
    const spec = specs.get(section.spec);
    const d = section.decision;
    if (!spec) throw new Error(`plan names ${section.spec}, which has no spec`);
    if (d.action === 'skip') continue;
    if (d.action === 'gap') { out.gaps.push({ spec: spec.id, reason: d.reason }); continue; }
    if (d.action === 'fill') {
      const block = catalog.find((b) => b.name === d.block);
      entries.push({ block, spec, pairs: assign(spec.slots, block.fields).pairs });
      continue;
    }
    const made = ctx.adapter.scaffoldBlock(ctx.stack, spec, { theme: ctx.theme, catalog });
    if (made.gap) { out.gaps.push({ spec: spec.id, reason: made.gap }); continue; }
    catalog.push(made.block);
    entries.push({ block: made.block, spec, pairs: assign(spec.slots, made.block.fields).pairs });
    out.commands.push(...made.commands);
    out.notes.push(...made.notes);
    out.proposals.push(...made.proposals.map((p) => ({ spec: spec.id, ...p })));
    for (const file of made.files) {
      const scaffold = join(paths.scaffold, file.path);
      mkdirSync(dirname(scaffold), { recursive: true });
      writeFileSync(scaffold, file.content);
      out.files.push({ target: file.path, scaffold: posix(relative(project, scaffold)) });
    }
  }
  const { markup, media } = ctx.adapter.emitPage(ctx.stack, entries);
  writeFileSync(paths.page, markup);
  out.media = media;
  writeJson(paths.emitted, out);
  console.log(JSON.stringify({ page: out.page, blocks: entries.length, scaffolded: out.files.length, gaps: out.gaps.length, commands: out.commands }, null, 2));
}

runCli(import.meta.url, main);
