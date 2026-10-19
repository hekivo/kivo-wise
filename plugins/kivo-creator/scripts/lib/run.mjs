// plugins/kivo-creator/scripts/lib/run.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function runId(date = new Date(), label = 'page') {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`;
  return `${stamp}-${slugify(label) || 'page'}`;
}

/** Creates .creator/<run>/ with specs/, refs/ and verify/. .creator/ ignores itself in git. */
export function createRun(projectDir, label, date = new Date()) {
  const base = join(resolve(projectDir), '.creator');
  mkdirSync(base, { recursive: true });
  const ignore = join(base, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
  const id = runId(date, label);
  const dir = join(base, id);
  for (const sub of ['specs', 'refs', 'verify']) mkdirSync(join(dir, sub), { recursive: true });
  return { id, dir };
}

export function runPaths(dir) {
  return {
    specs: join(dir, 'specs'),
    refs: join(dir, 'refs'),
    verify: join(dir, 'verify'),
    scaffold: join(dir, 'scaffold'),
    plan: join(dir, 'match-plan.json'),
    planMd: join(dir, 'match-plan.md'),
    page: join(dir, 'page.html'),
    emitted: join(dir, 'emitted.json'),
    fidelity: join(dir, 'fidelity.md'),
    fidelityJson: join(dir, 'fidelity.json'),
    figmaSections: join(dir, 'figma-sections.json'),
    codeConnect: join(dir, 'code-connect.json'),
  };
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
