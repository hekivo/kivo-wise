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

const signature = (n) => `${n.tag}.${[...(n.cls ?? [])].sort().join('.')}`;
const ITEM_TAGS = new Set(['li', 'details', 'figure', 'img', 'dt']);

/** First container (breadth-first) holding 3+ siblings that share tag and classes. */
export function repeatedGroup(node) {
  const queue = [node];
  while (queue.length) {
    const current = queue.shift();
    const kids = current.children ?? [];
    if (kids.length >= 3) {
      const counts = new Map();
      for (const k of kids) counts.set(signature(k), (counts.get(signature(k)) ?? 0) + 1);
      const [sig, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
      if (count >= 3 && count / kids.length >= 0.6) {
        const items = kids.filter((k) => signature(k) === sig);
        if (items.every((i) => (i.children ?? []).length > 0) || ITEM_TAGS.has(items[0].tag)) return { container: current, items };
      }
    }
    queue.push(...kids);
  }
  return null;
}

const NUMERIC = /^[~<>]?\d[\d.,]*\s*(%|[kmb]|x)?\+?$/i;
const firstText = (node) => find(node, (n) => !!n.text)?.text.trim() ?? '';

export function classify(node) {
  const has = (pred) => !!find(node, pred);
  const headings = findAll(node, (n) => HEADING.test(n.tag));
  if (has((n) => n.tag === 'form')) return 'form';
  if (has((n) => n.tag === 'details') || headings.filter((h) => textOf(h).endsWith('?')).length >= 2) return 'faq';
  if (has((n) => n.tag === 'h1')) return 'hero';
  if (has((n) => n.tag === 'blockquote')) return 'testimonial';
  const group = repeatedGroup(node);
  if (group) {
    const { container, items } = group;
    const isLogo = (i) => (i.tag === 'img' || !!find(i, (n) => n.tag === 'img')) && !find(i, (n) => HEADING.test(n.tag)) && !textOf(i);
    if (items.every(isLogo)) return 'logos';
    if (items.map(firstText).filter((t) => NUMERIC.test(t)).length * 2 >= items.length) return 'stats';
    if (container.tag === 'ol') return 'steps';
    return 'features';
  }
  if (has((n) => n.tag === 'iframe' || n.tag === 'video')) return 'media';
  const actions = findAll(node, (n) => n.tag === 'button' || (n.tag === 'a' && !!textOf(n)));
  const paragraphs = findAll(node, (n) => n.tag === 'p');
  if (actions.length >= 1 && actions.length <= 3 && headings.length <= 1 && paragraphs.length <= 2) return 'cta';
  if (headings.length || paragraphs.length) return 'text';
  if (has((n) => n.tag === 'img')) return 'media';
  return 'custom';
}

const TEXT_TAGS = new Set(['p', 'dd', 'blockquote', 'figcaption', 'cite']);
const LOOSE_TEXT_TAGS = new Set(['span', 'div', 'strong', 'em', 'small', 'label', 'li']);

/** Slots in document order; a repeated group becomes a trailing list slot "items". */
export function extractSlots(node) {
  const group = repeatedGroup(node);
  // Skip the items, not the container: the container can be the section itself (faq).
  const slots = collectSlots(node, new Set(group ? group.items : []));
  if (group) slots.push({ name: 'items', type: 'list', provenance: 'exact', items: group.items.map((item) => collectSlots(item, new Set())) });
  return slots;
}

function collectSlots(root, skip) {
  const out = [];
  const counters = {};
  const add = (type, value) => {
    counters[type] = (counters[type] ?? 0) + 1;
    out.push({ name: counters[type] === 1 ? type : `${type}_${counters[type]}`, type, value, provenance: 'exact' });
  };
  const visit = (n) => {
    if (skip.has(n)) return;
    const t = n.tag;
    if (HEADING.test(t) || t === 'summary' || t === 'dt') { const v = textOf(n); if (v) add('heading', v); return; }
    if (TEXT_TAGS.has(t)) { const v = textOf(n); if (v) add('text', v); return; }
    if (t === 'img') { if (n.attrs?.src) add('image', { src: n.attrs.src, alt: n.attrs.alt ?? '' }); return; }
    if ((t === 'a' || t === 'button') && textOf(n)) { add('link', { href: n.attrs?.href ?? '', text: textOf(n) }); return; }
    if (t === 'form') {
      const fields = findAll(n, (x) => ['input', 'select', 'textarea'].includes(x.tag)).map((x) => x.attrs?.name).filter(Boolean);
      add('form', { action: n.attrs?.action ?? '', fields });
      return;
    }
    if (t === 'iframe' || t === 'video') { add('embed', { src: n.attrs?.src ?? '' }); return; }
    if (LOOSE_TEXT_TAGS.has(t) && n.text && !(n.children ?? []).length) { add('text', n.text); return; }
    for (const child of n.children ?? []) visit(child);
  };
  visit(root);
  return out;
}

export function extractLayout(node) {
  const group = repeatedGroup(node);
  const heading = find(node, (n) => HEADING.test(n.tag));
  const textAlign = heading?.style?.textAlign ?? 'left';
  return {
    columns: group ? Math.max(1, group.items.filter((i) => Math.abs(i.rect.y - group.items[0].rect.y) <= 4).length) : 1,
    align: textAlign === 'center' ? 'center' : textAlign === 'right' || textAlign === 'end' ? 'right' : 'left',
    media: mediaPosition(node, heading, group),
    repeat: group ? group.items.length : 0,
  };
}

function mediaPosition(node, heading, group) {
  if (node.style?.backgroundImage && node.style.backgroundImage !== 'none') return 'background';
  const inGroup = new Set();
  if (group) for (const item of group.items) walk(item, (n) => inGroup.add(n));
  const media = findAll(node, (n) => ['img', 'video', 'iframe'].includes(n.tag) && !inGroup.has(n) && n.rect?.w > 0);
  if (!media.length) return 'none';
  const biggest = media.sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h)[0];
  if (biggest.rect.w * biggest.rect.h >= 0.8 * node.rect.w * node.rect.h) return 'background';
  if (!heading) return 'top';
  const mediaCenter = biggest.rect.x + biggest.rect.w / 2;
  const headingCenter = heading.rect.x + heading.rect.w / 2;
  if (mediaCenter > headingCenter + 40) return 'right';
  if (mediaCenter < headingCenter - 40) return 'left';
  return biggest.rect.y < heading.rect.y ? 'top' : 'bottom';
}

const isButton = (n) => n.tag === 'button' || (n.tag === 'a' && (n.cls ?? []).some((c) => /btn|button/i.test(c)));

/** The element that represents a token role inside a section (shared with verify). */
export function roleNode(node, role) {
  switch (role) {
    case 'section': return node;
    case 'heading': return find(node, (n) => HEADING.test(n.tag));
    case 'text': return find(node, (n) => n.tag === 'p');
    case 'link': return find(node, (n) => n.tag === 'a' && !isButton(n));
    case 'button': return find(node, isButton);
    case 'media': return find(node, (n) => n.tag === 'img' || n.tag === 'video');
    default: return null;
  }
}

const ROLE_PROPS = {
  section: ['backgroundColor', 'paddingTop', 'paddingBottom'],
  heading: ['color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight'],
  text: ['color', 'fontFamily', 'fontSize', 'lineHeight'],
  link: ['color'],
  button: ['backgroundColor', 'color'],
};
const EMPTY_VALUES = new Set(['', 'none', 'normal', 'auto', 'transparent', 'rgba(0, 0, 0, 0)']);

export function extractTokens(node) {
  const out = [];
  for (const [role, props] of Object.entries(ROLE_PROPS)) {
    const target = roleNode(node, role);
    if (!target) continue;
    for (const prop of props) {
      const value = target.style?.[prop];
      if (value === undefined || EMPTY_VALUES.has(String(value).trim())) continue;
      out.push({ role, prop, value: String(value), provenance: 'exact', node: target.path });
    }
  }
  return out;
}

export function toSpec({ node, chrome }, { index, sourceRef }) {
  const kind = chrome ? 'custom' : classify(node);
  const spec = {
    id: `${String(index + 1).padStart(2, '0')}-${chrome ? node.tag : kind}`,
    order: index,
    source: { kind: 'html', ref: node.path, url: sourceRef },
    kind,
    slots: extractSlots(node),
    layout: extractLayout(node),
    tokens: extractTokens(node),
    refs: {},
    notes: ['kind and layout are inferred by heuristics; slot values and tokens are exact (DOM text and computed styles)'],
  };
  if (chrome) spec.chrome = true;
  if (node.merged) spec.notes.push(`merged short siblings: ${node.merged.join(', ')}`);
  return spec;
}
