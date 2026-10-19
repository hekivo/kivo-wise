// plugins/kivo-creator/scripts/lib/lint.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ARBITRARY_VALUE = /(?<![\w-])(?:[a-z0-9-]+:)*-?[a-z][a-z0-9-]*-\[[^\]\s]+\]/g;
const ARBITRARY_PROPERTY = /(?<![\w-])\[[a-z][a-z-]*:[^\]\s]+\]/g;
const INLINE_STYLE = /\bstyle\s*=\s*["'{]/g;

export function lintSource(text, file) {
  const findings = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(ARBITRARY_VALUE)) findings.push({ file, line: i + 1, rule: 'arbitrary-value', match: m[0] });
    for (const m of line.matchAll(ARBITRARY_PROPERTY)) findings.push({ file, line: i + 1, rule: 'arbitrary-property', match: m[0] });
    if (!file.endsWith('.css')) for (const m of line.matchAll(INLINE_STYLE)) findings.push({ file, line: i + 1, rule: 'inline-style', match: m[0] });
  });
  return findings;
}

/** Lints project-relative paths that exist; missing files are skipped. */
export function lintFiles(paths, baseDir) {
  return paths.filter((p) => existsSync(join(baseDir, p))).flatMap((p) => lintSource(readFileSync(join(baseDir, p), 'utf8'), p));
}
