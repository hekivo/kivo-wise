// plugins/kivo-creator/scripts/adapters/shared/native-block.mjs
/**
 * Native blocks (block.json). Every adapter reads them into its catalog and
 * scaffolds them when the project's block type is "native" (block-type.mjs).
 * The layout follows the project's existing block.json files; nothing about
 * folders is assumed.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { posix } from './names.mjs';
import { assign, valueFor } from '../../lib/fill.mjs';
import { serializeBlock } from '../../lib/block-markup.mjs';
import { roleUtilities } from '../../lib/tokens.mjs';
import { renderView } from './blade-view.mjs';
import { fieldsFromSlots, uniqueName, renderBlockCss, WHEN } from './acf-composer.mjs';

const SKIP = new Set(['node_modules', 'vendor', 'public', 'storage', 'build', 'dist', '.git', '.creator', 'wp', 'uploads']);

function* blockJsonFiles(dir, depth = 0) {
  if (depth > 6 || !existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!SKIP.has(entry.name)) yield* blockJsonFiles(join(dir, entry.name), depth + 1); }
    else if (entry.name === 'block.json') yield join(dir, entry.name);
  }
}

export function nativeField(name, attr) {
  if (attr.type === 'string') {
    if (/url|href|embed|video/i.test(name)) return { name, type: 'url' };
    return { name, type: attr.source === 'html' || attr.source === 'rich-text' ? 'wysiwyg' : 'text' };
  }
  if (attr.type === 'object') {
    if (/image|media|photo|picture|icon|avatar/i.test(name)) return { name, type: 'image' };
    if (/link|button|cta/i.test(name)) return { name, type: 'link' };
    return null;
  }
  if (attr.type === 'array') {
    const props = attr.items?.properties ?? {};
    return { name, type: 'repeater', subFields: Object.entries(props).map(([n, a]) => nativeField(n, a)).filter(Boolean) };
  }
  return null;
}

export function nativeCatalog(stack) {
  const blocks = [];
  for (const file of blockJsonFiles(stack.appPath)) {
    let json;
    try { json = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
    if (!json.name) continue;
    blocks.push({
      name: json.name,
      type: 'native',
      slug: json.name.split('/')[1],
      title: json.title ?? json.name,
      description: json.description ?? '',
      whenToUse: json.description ?? '',
      source: posix(relative(stack.projectDir, file)),
      dir: posix(relative(stack.projectDir, dirname(file))),
      fields: Object.entries(json.attributes ?? {}).map(([n, a]) => nativeField(n, a)).filter(Boolean),
    });
  }
  return blocks.sort((a, b) => a.name.localeCompare(b.name));
}

function nativeValue(slot, field, media, at) {
  switch (field.type) {
    case 'image':
      media.push({ ...at, field: field.name, src: slot.value?.src ?? null, alt: slot.value?.alt ?? '' });
      return { url: slot.value?.src ?? '', alt: slot.value?.alt ?? '' };
    case 'link':
      return { url: slot.value?.href ?? '', text: slot.value?.text ?? '' };
    case 'repeater':
      return (slot.items ?? []).map((item) => Object.fromEntries(assign(item, field.subFields ?? []).pairs.map((p) => [p.field.name, nativeValue(p.slot, p.field, media, at)])));
    default:
      return valueFor(slot, field);
  }
}

/** Block markup with attributes; images keep their URL (listed in media for an optional import). */
export function emitNativePage(entries) {
  const media = [];
  const parts = entries.map(({ block, spec, pairs }) => {
    const attrs = Object.fromEntries(pairs.map((p) => [p.field.name, nativeValue(p.slot, p.field, media, { spec: spec.id, block: block.name })]));
    return serializeBlock(block.name, attrs);
  });
  return { markup: `${parts.join('\n\n')}\n`, media };
}

const ATTRIBUTE = { text: 'string', textarea: 'string', wysiwyg: 'string', oembed: 'string', image: 'object', link: 'object' };
const NATIVE_TYPE = { text: 'text', textarea: 'text', wysiwyg: 'wysiwyg', oembed: 'url', image: 'image', link: 'link' };

const attributeFor = (f) => (f.acfType === 'repeater'
  ? { type: 'array', items: { type: 'object', properties: Object.fromEntries(f.subFields.map((s) => [s.name, attributeFor(s)])) } }
  : { type: ATTRIBUTE[f.acfType] });
const catalogField = (f) => (f.acfType === 'repeater' ? { name: f.name, type: 'repeater', subFields: f.subFields.map(catalogField) } : { name: f.name, type: NATIVE_TYPE[f.acfType] });

function mostCommon(values, fallback) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

/**
 * New native block: block.json beside the existing ones, a Blade view that
 * reads $data, and notes for the registration and the editor UI (neither is
 * generated: they follow project conventions this plugin cannot see).
 */
export function scaffoldNative(stack, spec, { theme, catalog = [], fallbackPrefix = 'app', fallbackDir = 'resources/blocks' }) {
  const { slug, title } = uniqueName(spec, catalog.map((b) => ({ ...b, className: '' })));
  // The catalog can hold ACF blocks too (it is the union of both types); only native ones set the prefix.
  const native = catalog.filter((b) => (b.type ? b.type === 'native' : !String(b.name).startsWith('acf/')));
  const prefix = mostCommon(native.map((b) => b.name.split('/')[0]), fallbackPrefix);
  const app = posix(relative(stack.projectDir, stack.appPath));
  const blocksDir = mostCommon(native.filter((b) => b.dir).map((b) => posix(dirname(b.dir))), posix(join(app, fallbackDir)));
  const { fields, notes } = fieldsFromSlots(spec.slots);
  const { utils, proposals } = roleUtilities(spec.tokens, theme);
  const name = `${prefix}/${slug}`;
  const blockJson = {
    $schema: 'https://schemas.wp.org/trunk/block.json',
    apiVersion: 3,
    name,
    title,
    category: 'design',
    description: `${title} section generated from the design.`,
    attributes: Object.fromEntries(fields.map((f) => [f.name, attributeFor(f)])),
    supports: { html: false, anchor: true },
  };
  const at = (...parts) => posix(join(app, ...parts));
  const blockDir = posix(join(blocksDir, slug));
  const files = [
    { path: `${blockDir}/block.json`, content: `${JSON.stringify(blockJson, null, 2)}\n` },
    { path: at('resources', 'views', 'blocks', `${slug}.blade.php`), content: renderView({ slug, spec, fields, utils, flavour: 'native' }) },
    { path: at('resources', 'css', 'blocks', `${slug}.css`), content: renderBlockCss({ name, spec, proposals }) },
  ];
  notes.push(
    `register the block where the project registers the others, on init: register_block_type(base_path('${blockDir}'), ['render_callback' => fn ($attributes) => view('blocks.${slug}', ['data' => $attributes])->render()]); (adjust base_path to the project's helper)`,
    'the editor UI (edit script) is not generated: run the project\'s make:block generator if it has one, or add a ServerSideRender edit script the way the existing blocks do',
  );
  const block = { name, type: 'native', slug, title, description: blockJson.description, whenToUse: WHEN[spec.kind], source: files[0].path, dir: blockDir, fields: fields.map(catalogField) };
  return { block, commands: [], files, notes, proposals };
}
