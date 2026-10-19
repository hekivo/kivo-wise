// plugins/kivo-creator/scripts/lib/figma.mjs
import { slugify } from './run.mjs';

export function parseFigmaUrl(url) {
  const u = new URL(url);
  if (!/(^|\.)figma\.com$/.test(u.hostname)) throw new Error(`not a figma.com URL: ${url}`);
  const m = u.pathname.match(/^\/(design|file|proto|board|make)\/([A-Za-z0-9]+)(?:\/branch\/([A-Za-z0-9]+))?/);
  if (!m) throw new Error(`unrecognised Figma URL path: ${u.pathname}`);
  const node = u.searchParams.get('node-id');
  return { kind: m[1], fileKey: m[3] ?? m[2], nodeId: node ? node.replace(/-/g, ':') : null };
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Tolerant XML element tree (no text nodes): what get_metadata returns. */
export function parseXmlTree(xml) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, tag, rawAttrs, selfClosing] = m;
    if (closing) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = {};
    for (const a of rawAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = decode(a[2]);
    const node = { tag, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

function findNode(node, id) {
  if (node.attrs?.id === id) return node;
  for (const child of node.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

const CONTAINERS = new Set(['frame', 'instance', 'section', 'group', 'component']);
const KIND_RULES = [
  [/\bcta\b|call to action/i, 'cta'],
  [/^(header|footer|nav(igation)?|top ?bar)\b/i, 'chrome'],
  [/hero|banner/i, 'hero'],
  [/faq|question|accordion/i, 'faq'],
  [/feature|benefit/i, 'features'],
  [/testimonial|quote|review/i, 'testimonial'],
  [/logo|client|partner/i, 'logos'],
  [/stat|number|metric/i, 'stats'],
  [/step|how it works/i, 'steps'],
  [/form|contact|sign ?up/i, 'form'],
  [/video|gallery|media/i, 'media'],
];

export function kindFromName(name) {
  return KIND_RULES.find(([re]) => re.test(name))?.[1] ?? 'custom';
}

const box = (a) => ({ x: Number(a.x ?? 0), y: Number(a.y ?? 0), width: Number(a.width ?? 0), height: Number(a.height ?? 0) });

/** Section skeletons (no values) for the frame `nodeId`: its container children, top to bottom. */
export function sectionsFromMetadata(xml, nodeId) {
  const tree = parseXmlTree(xml);
  let root = (nodeId && findNode(tree, nodeId)) || tree.children[0];
  if (!root) throw new Error('get_metadata returned no nodes');
  for (let depth = 0; depth < 3; depth++) {
    const kids = root.children.filter((c) => CONTAINERS.has(c.tag));
    if (kids.length === 1 && box(kids[0].attrs).width >= 0.9 * box(root.attrs).width && kids[0].children.length >= 2) root = kids[0];
    else break;
  }
  return root.children
    .filter((c) => CONTAINERS.has(c.tag))
    .sort((a, b) => box(a.attrs).y - box(b.attrs).y)
    .map((c, i) => {
      const rule = kindFromName(c.attrs.name ?? '');
      const chrome = rule === 'chrome';
      const kind = chrome ? 'custom' : rule;
      const label = chrome || kind === 'custom' ? slugify(c.attrs.name ?? 'section') : kind;
      return { id: `${String(i + 1).padStart(2, '0')}-${label}`, nodeId: c.attrs.id, name: c.attrs.name ?? '', kind, chrome, box: box(c.attrs) };
    });
}

/** Distinct component instances (by name), first id wins: candidates for Code Connect. */
export function componentsFromMetadata(xml) {
  const seen = new Map();
  const visit = (node) => {
    if (node.tag === 'instance' && node.attrs.name && !seen.has(node.attrs.name)) seen.set(node.attrs.name, { id: node.attrs.id, name: node.attrs.name });
    node.children.forEach(visit);
  };
  visit(parseXmlTree(xml));
  return [...seen.values()];
}
