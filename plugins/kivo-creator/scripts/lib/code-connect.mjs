// plugins/kivo-creator/scripts/lib/code-connect.mjs
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const STOP = new Set(['default', 'primary', 'secondary', 'tertiary', 'block', 'section', 'component', 'variant', 'desktop', 'mobile', 'tablet', 'v1', 'v2', 'new']);
const words = (s) => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

/** Jaccard similarity of the meaningful words of two names. */
export function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter((w) => B.has(w)).length;
  return shared / new Set([...A, ...B]).size;
}

/** Anonymous and class-based Blade components under resources/views/components. */
export function bladeComponents(stack) {
  const base = join(stack.appPath, 'resources', 'views', 'components');
  const out = [];
  const visit = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.blade.php')) {
        const id = relative(base, full).replace(/\.blade\.php$/, '').split(/[\\/]/).join('.');
        out.push({ name: `x-${id}`, title: id.replace(/[.-]/g, ' '), slug: id, source: relative(stack.projectDir, full).split('\\').join('/') });
      }
    }
  };
  visit(base);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * components: [{ id, name }] from get_metadata; map: get_code_connect_map;
 * targets: blocks and Blade components ({ name, title, slug, source }).
 */
export function proposeMappings({ components, map = {}, targets, threshold = 0.5 }) {
  const mapped = [];
  const proposals = [];
  const unmatched = [];
  for (const c of components) {
    if (map[c.id]) { mapped.push({ component: c.name, nodeId: c.id, codeConnectName: map[c.id].codeConnectName, source: map[c.id].codeConnectSrc }); continue; }
    const base = c.name.split('/')[0];
    const best = targets
      .map((t) => ({ target: t.name, source: t.source, score: Math.max(similarity(base, t.title ?? ''), similarity(base, t.slug ?? '')) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= threshold) proposals.push({ component: c.name, nodeId: c.id, target: best.target, source: best.source, score: Math.round(best.score * 100) / 100 });
    else unmatched.push({ component: c.name, nodeId: c.id });
  }
  return { mapped, proposals, unmatched };
}
