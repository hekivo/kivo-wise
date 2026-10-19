// plugins/kivo-creator/scripts/lib/tokens.mjs
/**
 * Design value -> theme token mapping (Tailwind v4 @theme). A value with no
 * token becomes a proposal; it is never written as a literal.
 */
const DEFAULT_THEME = [
  ['--font-weight-thin', '100'], ['--font-weight-extralight', '200'], ['--font-weight-light', '300'],
  ['--font-weight-normal', '400'], ['--font-weight-medium', '500'], ['--font-weight-semibold', '600'],
  ['--font-weight-bold', '700'], ['--font-weight-extrabold', '800'], ['--font-weight-black', '900'],
  ['--spacing', '0.25rem'],
];
const NAMESPACES = {
  color: '--color-', backgroundColor: '--color-', borderColor: '--color-',
  fontSize: '--text-', fontFamily: '--font-', fontWeight: '--font-weight-', lineHeight: '--leading-',
};
const SPACING = { paddingTop: 'pt', paddingBottom: 'pb', paddingLeft: 'pl', paddingRight: 'pr', gap: 'gap' };
const UTILITY_PREFIX = { color: 'text-', backgroundColor: 'bg-', borderColor: 'border-', fontSize: 'text-', fontFamily: 'font-', fontWeight: 'font-', lineHeight: 'leading-' };
const ROLE_NAME = { text: 'body' };

export function parseTheme(css) {
  const map = new Map();
  for (const block of css.matchAll(/@theme(?:\s+[a-z]+)?\s*\{([\s\S]*?)\}/g)) {
    for (const m of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) map.set(m[1], m[2].trim());
  }
  return map;
}

export const loadTheme = (css = '') => new Map([...DEFAULT_THEME, ...parseTheme(css)]);

export function normalizeColor(value) {
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return rgb(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a);
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return rgb(+m[1], +m[2], +m[3], a);
  }
  return null;
}

const rgb = (r, g, b, a) => (a >= 1 ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`);

export function normalizeValue(prop, value) {
  const v = String(value).trim();
  if (/color$/i.test(prop)) return normalizeColor(v) ?? v.toLowerCase();
  if (prop === 'fontFamily') return v.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
  if (/^-?[\d.]+px$/.test(v)) return `${parseFloat(v)}px`;
  if (/^-?[\d.]+rem$/.test(v)) return `${parseFloat(v) * 16}px`;
  return v.toLowerCase();
}

function spacingStep(value, theme) {
  const base = parseFloat(normalizeValue('spacing', theme.get('--spacing') ?? '0.25rem'));
  const px = parseFloat(normalizeValue('padding', value));
  if (!Number.isFinite(px) || !base) return null;
  const step = px / base;
  return Number.isInteger(step) ? step : null;
}

const proposal = (t) => ({ role: t.role, prop: t.prop, value: t.value, provenance: t.provenance, node: t.node, suggested: `${NAMESPACES[t.prop] ?? '--spacing-'}${ROLE_NAME[t.role] ?? t.role}` });

export function mapTokens(tokens, theme) {
  const mapped = [];
  const proposals = [];
  for (const t of tokens) {
    if (SPACING[t.prop]) {
      const step = spacingStep(t.value, theme);
      if (step === null) proposals.push(proposal(t));
      else mapped.push({ ...t, token: '--spacing', step });
      continue;
    }
    const ns = NAMESPACES[t.prop];
    if (!ns) continue; // not a theme concern (textAlign, display)
    if (t.token && theme.has(t.token)) { mapped.push(t); continue; }
    const want = normalizeValue(t.prop, t.value);
    const hit = [...theme].find(([name, value]) => name.startsWith(ns) && !(ns === '--font-' && name.startsWith('--font-weight-')) && !name.includes('--', 2) && normalizeValue(t.prop, value) === want);
    if (hit) mapped.push({ ...t, token: hit[0] });
    else proposals.push(proposal(t));
  }
  return { mapped, proposals };
}

export function utilityFor(t) {
  if (t.token === '--spacing') return SPACING[t.prop] ? `${SPACING[t.prop]}-${t.step}` : null;
  const ns = NAMESPACES[t.prop];
  if (!ns || !t.token?.startsWith(ns)) return null;
  return UTILITY_PREFIX[t.prop] + t.token.slice(ns.length);
}

export function roleUtilities(tokens, theme) {
  const { mapped, proposals } = mapTokens(tokens, theme);
  const utils = { section: [], heading: [], text: [], link: [], button: [], media: [] };
  for (const t of mapped) {
    const u = utilityFor(t);
    if (u && !utils[t.role].includes(u)) utils[t.role].push(u);
  }
  return { utils, proposals, mapped };
}
