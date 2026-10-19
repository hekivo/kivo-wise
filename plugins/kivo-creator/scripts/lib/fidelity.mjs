// plugins/kivo-creator/scripts/lib/fidelity.mjs
const pct = (ratio) => `${(ratio * 100).toFixed(2)}%`;

export function evaluateSection({ spec, width, diff, styles = [], threshold }) {
  const pixel = diff
    ? { ratio: diff.ratio, pass: diff.ratio <= threshold, sizeMatch: diff.sizeMatch }
    : { ratio: null, pass: null, reason: 'no reference image' };
  const failed = styles.filter((s) => !s.pass);
  return { spec: spec.id, kind: spec.kind, width, pixel, styles: { checked: styles.length, failed }, pass: pixel.pass !== false && failed.length === 0 };
}

export function summarize(rows, lint = []) {
  return { pass: rows.length > 0 && rows.every((r) => r.pass) && lint.length === 0, rows, lint };
}

export function formatFidelity(result, { run, threshold }) {
  const lines = [
    `# Fidelity report: ${run}`,
    '',
    `Result: **${result.pass ? 'PASS' : 'FAIL'}** (pixel limit ${pct(threshold)} per section and width)`,
    '',
    '| Section | Kind | Width | Pixel diff | Styles | Result |',
    '|---|---|---|---|---|---|',
  ];
  for (const r of result.rows) {
    const pixel = r.pixel.ratio === null ? 'no reference' : `${pct(r.pixel.ratio)}${r.pixel.sizeMatch === false ? ' (size differs)' : ''}`;
    const styles = r.styles.checked ? `${r.styles.checked - r.styles.failed.length}/${r.styles.checked}` : '-';
    lines.push(`| ${r.spec} | ${r.kind} | ${r.width} | ${pixel} | ${styles} | ${r.pass ? 'pass' : 'FAIL'} |`);
  }
  const mismatches = result.rows.flatMap((r) => r.styles.failed.map((s) => `- \`${r.spec}\` at ${r.width} px: ${s.role} ${s.prop} expected ${s.expected}, got ${s.actual ?? s.reason}`));
  lines.push('', '## Style mismatches', '', ...(mismatches.length ? mismatches : ['None.']));
  lines.push('', '## Lint', '', ...(result.lint.length ? result.lint.map((f) => `- \`${f.file}:${f.line}\` ${f.rule} \`${f.match}\``) : ['None.']));
  return `${lines.join('\n')}\n`;
}
