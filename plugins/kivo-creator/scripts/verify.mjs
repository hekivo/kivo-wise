#!/usr/bin/env node
// plugins/kivo-creator/scripts/verify.mjs
/**
 * verify.mjs: screenshot each rendered section with the target project's
 * Playwright, diff it against the reference, check exact styles at the widest
 * width, lint the generated files and write fidelity.md / fidelity.json.
 *
 * Usage:
 *   node scripts/verify.mjs --run=.creator/<run> --url=<rendered page URL>
 *        [--project=.] [--widths=390,1440] [--threshold=0.02] [--selector=[data-block]]
 * Exit: 0 pass, 1 fail or error, 3 Playwright missing in the project.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadPlaywright, NO_PLAYWRIGHT } from './lib/playwright.mjs';
import { collectSnapshot } from './lib/collect.mjs';
import { decodePng, diffImages, encodePng } from './png.mjs';
import { readSpecs } from './lib/spec.mjs';
import { readJson, runPaths, writeJson } from './lib/run.mjs';
import { styleCheck } from './lib/style-check.mjs';
import { lintFiles } from './lib/lint.mjs';
import { evaluateSection, formatFidelity, summarize } from './lib/fidelity.mjs';

export function parseVerifyArgs(argv) {
  const o = parseOptions(argv, { run: '', url: '', project: '.', widths: '390,1440', threshold: '0.02', selector: '[data-block]' });
  if (!o.run || !o.url) throw new Error('usage: verify.mjs --run=<.creator/run> --url=<rendered page> [--project=.] [--widths=390,1440] [--threshold=0.02] [--selector=[data-block]]');
  const threshold = Number(o.threshold);
  if (!(threshold > 0 && threshold < 1)) throw new Error('--threshold must be between 0 and 1');
  return { ...o, threshold, widths: String(o.widths).split(',').map(Number).filter((w) => w > 0) };
}

/** Sections that are rendered on the page, in plan order (chrome, gaps and skips are not). */
export function targetsFor(specs, plan) {
  const dropped = new Set((plan?.sections ?? []).filter((s) => ['skip', 'gap'].includes(s.decision?.action)).map((s) => s.spec));
  return specs.filter((s) => !s.chrome && !dropped.has(s.id));
}

export async function main(argv) {
  const o = parseVerifyArgs(argv);
  const runDir = resolve(o.run);
  const paths = runPaths(runDir);
  const plan = existsSync(paths.plan) ? readJson(paths.plan) : null;
  const targets = targetsFor(readSpecs(paths.specs), plan);
  const emitted = existsSync(paths.emitted) ? readJson(paths.emitted) : { files: [] };
  const pw = await loadPlaywright(o.project);
  if (!pw) { process.exitCode = 3; throw new Error(NO_PLAYWRIGHT); }
  mkdirSync(paths.verify, { recursive: true });
  const widest = Math.max(...o.widths);
  const rows = [];
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: widest, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(o.url, { waitUntil: 'networkidle' });
    for (const width of o.widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      const blocks = page.locator(o.selector);
      const count = await blocks.count();
      if (count !== targets.length) throw new Error(`found ${count} elements for ${o.selector} at ${width}px, expected ${targets.length} (one per emitted section); pass --selector for blocks that do not print data-block`);
      for (const [i, spec] of targets.entries()) {
        const shot = join(paths.verify, `${spec.id}-${width}.png`);
        await blocks.nth(i).screenshot({ path: shot, animations: 'disabled' });
        const ref = spec.refs?.[String(width)];
        let diff = null;
        if (ref && existsSync(join(runDir, ref))) {
          diff = diffImages(decodePng(readFileSync(join(runDir, ref))), decodePng(readFileSync(shot)));
          writeFileSync(join(paths.verify, `${spec.id}-${width}.diff.png`), encodePng(diff.image));
        }
        const styles = width === widest ? styleCheck(spec, await page.evaluate(collectSnapshot, { selector: o.selector, index: i })) : [];
        rows.push(evaluateSection({ spec, width, diff, styles, threshold: o.threshold }));
      }
    }
  } finally {
    await browser.close();
  }
  const project = resolve(o.project);
  const files = (emitted.files ?? []).map((f) => (existsSync(join(project, f.target)) ? f.target : f.scaffold));
  const result = summarize(rows, lintFiles(files, project));
  writeJson(paths.fidelityJson, result);
  writeFileSync(paths.fidelity, formatFidelity(result, { run: basename(runDir), threshold: o.threshold }));
  console.log(`${result.pass ? 'PASS' : 'FAIL'}: ${rows.filter((r) => r.pass).length}/${rows.length} section checks, ${result.lint.length} lint findings. Report: ${paths.fidelity}`);
  if (!result.pass) process.exitCode = 1;
}

runCli(import.meta.url, main);
