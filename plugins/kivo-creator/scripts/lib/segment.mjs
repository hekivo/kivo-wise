// plugins/kivo-creator/scripts/lib/segment.mjs
/**
 * Section segmentation on a serialised DOM snapshot (see collect.mjs).
 * Heuristic, documented in the plan and in the html-ingest skill:
 *  - content root = <main> (or role=main), else the body after unwrapping
 *    single-child wrappers;
 *  - header/footer/nav (banner/contentinfo/navigation) outside <main> = chrome;
 *  - sections = visible children of the root after unwrapping (max 4 levels);
 *  - siblings shorter than MIN_SECTION_HEIGHT merge into the previous one.
 */
export const MIN_SECTION_HEIGHT = 80;
const CHROME_TAGS = new Set(['header', 'footer', 'nav']);
const CHROME_ROLES = new Set(['banner', 'contentinfo', 'navigation']);
export const HEADING = /^h[1-6]$/;

export function walk(node, fn) {
  fn(node);
  for (const child of node.children ?? []) walk(child, fn);
}

export function find(node, pred) {
  if (pred(node)) return node;
  for (const child of node.children ?? []) {
    const hit = find(child, pred);
    if (hit) return hit;
  }
  return null;
}

export function findAll(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const child of node.children ?? []) findAll(child, pred, out);
  return out;
}

export function textOf(node) {
  const parts = [];
  walk(node, (n) => { if (n.text) parts.push(n.text); });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

const isVisible = (n) => n.visible !== false && n.rect && n.rect.w > 0 && n.rect.h > 0;
const visibleKids = (n) => (n.children ?? []).filter(isVisible);
const isChrome = (n) => CHROME_TAGS.has(n.tag) || CHROME_ROLES.has(n.role);
const isMain = (n) => n.tag === 'main' || n.role === 'main';
const SECTION_TAGS = new Set(['section', 'article']);
// A generic wrapper (not a section element, no heading of its own) with 2+ visible children.
const isWrapper = (n) => !SECTION_TAGS.has(n.tag) && !(n.children ?? []).some((c) => HEADING.test(c.tag)) && visibleKids(n).length >= 2;
const hasMedia = (n) => !!find(n, (x) => x.tag === 'img' || x.tag === 'video' || x.tag === 'iframe');

export function segment(snapshot) {
  const body = find(snapshot, (n) => n.tag === 'body') ?? snapshot;
  const chrome = [];
  let level = body;
  for (let depth = 0; depth < 5; depth++) {
    const kids = visibleKids(level);
    chrome.push(...kids.filter(isChrome));
    const rest = kids.filter((k) => !isChrome(k));
    const main = rest.find(isMain);
    if (main) { level = main; break; }
    if (rest.length === 1 && isWrapper(rest[0])) { level = rest[0]; continue; }
    break;
  }
  if (!isMain(level)) {
    const main = find(body, isMain);
    if (main && isVisible(main)) level = main;
  }
  let root = level;
  for (let depth = 0; depth < 4; depth++) {
    const kids = visibleKids(root);
    if (kids.length === 1 && isWrapper(kids[0])) root = kids[0];
    else break;
  }
  const inMain = isMain(level);
  const content = mergeSmall(visibleKids(root).filter((k) => inMain || !isChrome(k)));
  return [
    ...chrome.map((node) => ({ node, chrome: true })),
    ...content.map((node) => ({ node, chrome: false })),
  ].sort((a, b) => a.node.rect.y - b.node.rect.y);
}

function mergeSmall(nodes) {
  const out = [];
  for (const node of nodes) {
    const empty = !textOf(node) && !hasMedia(node);
    if (node.rect.h >= MIN_SECTION_HEIGHT) { out.push(node); continue; }
    if (empty) continue;
    if (!out.length) { out.push(node); continue; }
    const prev = out.pop();
    out.push({
      ...prev,
      text: '',
      rect: union(prev.rect, node.rect),
      children: prev.merged ? [...prev.children, node] : [prev, node],
      merged: [...(prev.merged ?? []), node.path],
    });
  }
  return out;
}

function union(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
