// plugins/kivo-creator/scripts/lib/style-check.mjs
import { roleNode } from './segment.mjs';
import { normalizeValue } from './tokens.mjs';

function same(prop, expected, actual) {
  const a = normalizeValue(prop, expected);
  const b = normalizeValue(prop, actual);
  if (a.endsWith('px') && b.endsWith('px')) return Math.abs(parseFloat(a) - parseFloat(b)) <= 0.5;
  return a === b;
}

/** Checks every `exact` token of a spec against a rendered section snapshot. */
export function styleCheck(spec, rendered) {
  return spec.tokens.filter((t) => t.provenance === 'exact').map((t) => {
    const base = { role: t.role, prop: t.prop, expected: t.value };
    const node = rendered ? roleNode(rendered, t.role) : null;
    if (!node) return { ...base, actual: null, pass: false, reason: `no ${t.role} element in the rendered section` };
    const actual = node.style?.[t.prop];
    if (actual === undefined) return { ...base, actual: null, pass: false, reason: `${t.prop} was not collected` };
    return { ...base, actual, pass: same(t.prop, t.value, actual) };
  });
}
