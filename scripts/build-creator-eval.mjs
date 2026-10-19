#!/usr/bin/env node
// scripts/build-creator-eval.mjs
/**
 * Stage plugins/kivo-creator for `claude plugin eval`.
 *
 * Why a staged copy:
 *  1. A declared marketplace dependency (kivo-wise) stops the plugin loading
 *     inside the eval sandbox, so the copy drops `dependencies`.
 *  2. Eval mocks only stand in for MCP servers the plugin declares, so the copy
 *     declares the official Figma server as `figma`. A case without mock files
 *     for it gets no server at all: that is the "Figma MCP missing" case.
 *  3. Runs cannot read the eval folder; scaffold scripts copy fixtures from
 *     evals/fixtures, staged here from test/fixtures/creator.
 *  4. Cases with mocks/figma/ get the recorded Figma responses in
 *     mocks/figma/fixtures. Design contexts are stored as
 *     design-context-<node id with a dash>.md: a colon is neither a portable
 *     file name nor a segment the mock's {input.nodeId} accepts, so a call
 *     with "1:10" gets a tool error and the model retries with "1-10" (both
 *     forms are valid node ids for the real server).
 *
 * Usage: node scripts/build-creator-eval.mjs [--out=.creator-eval]
 * Then:  claude plugin eval .creator-eval/kivo-creator --scaffold --allow-tools Bash Write Edit
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'plugins', 'kivo-creator');

export function stage(outBase) {
  const out = join(resolve(outBase), 'kivo-creator');
  rmSync(out, { recursive: true, force: true });
  cpSync(SOURCE, out, { recursive: true, filter: (p) => !p.includes(`${sep}evals${sep}results`) });
  const manifestPath = join(out, '.claude-plugin', 'plugin.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  delete manifest.dependencies;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(out, '.mcp.json'), `${JSON.stringify({ mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } }, null, 2)}\n`);
  cpSync(join(ROOT, 'test', 'fixtures', 'creator'), join(out, 'evals', 'fixtures'), { recursive: true });
  const figmaFixtures = join(ROOT, 'test', 'fixtures', 'creator', 'figma');
  for (const entry of readdirSync(join(out, 'evals'), { withFileTypes: true })) {
    const mocks = join(out, 'evals', entry.name, 'mocks', 'figma');
    if (!entry.isDirectory() || !existsSync(mocks)) continue;
    cpSync(figmaFixtures, join(mocks, 'fixtures'), { recursive: true });
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--out='));
  const out = stage(arg ? arg.slice(6) : join(ROOT, '.creator-eval'));
  console.log(`staged ${relative(ROOT, out)}\nrun: claude plugin eval ${relative(ROOT, out)} --scaffold --allow-tools Bash Write Edit`);
}
