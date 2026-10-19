// plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs
/**
 * ACF Composer conventions shared by every adapter (block-type.mjs picks them when the project uses ACF Composer blocks).
 * Block name acf/{slug}; slug defaults to Str::slug(Str::kebab($name)) (acfDefaultSlug); the field group
 * is Builder::make(<literal>) or the slug ($this->slug).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { kebab, pascal, posix, words, safeComment, phpString } from './names.mjs';
import { roleUtilities } from '../../lib/tokens.mjs';
import { renderView } from './blade-view.mjs';
import { assign, valueFor } from '../../lib/fill.mjs';
import { serializeBlock } from '../../lib/block-markup.mjs';

const FIELD_CALL = /->(add\w+)\(\s*['"]([\w-]+)['"]\s*(?:,\s*(\[[\s\S]*?\]))?\s*\)|->(endRepeater|endGroup|endFlexibleContent)\(\)/g;
const acfType = (method) => method.replace(/^add/, '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();

export function parseFields(php) {
  const start = php.search(/function\s+fields\s*\(/);
  if (start === -1) return [];
  const root = [];
  const stack = [root];
  for (const m of php.slice(start).matchAll(FIELD_CALL)) {
    if (m[4]) { if (stack.length > 1) stack.pop(); continue; }
    const field = { name: m[2], type: acfType(m[1]) };
    const options = m[3] ?? '';
    const min = options.match(/['"]min['"]\s*=>\s*(\d+)/);
    const max = options.match(/['"]max['"]\s*=>\s*(\d+)/);
    if (min) field.min = Number(min[1]);
    if (max) field.max = Number(max[1]);
    stack.at(-1).push(field);
    if (field.type === 'repeater' || field.type === 'group') { field.subFields = []; stack.push(field.subFields); }
  }
  return root;
}

/**
 * ACF Composer's default slug: Str::slug(Str::kebab($name)) in Block::compose().
 * Str::kebab joins words (ucwords, spaces removed) and puts a dash before every
 * capital, so 'CTA Banner' becomes 'c-t-a-banner'.
 */
export function acfDefaultSlug(name) {
  let v = String(name);
  if (!/^[a-z]+$/.test(v)) {
    v = v.replace(/(^|\s)(\S)/g, (_, gap, ch) => gap + ch.toUpperCase()).replace(/\s+/g, '');
    v = v.replace(/(.)(?=[A-Z])/gu, '$1-').toLowerCase();
  }
  return v
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, '-')
    .replace(/@/g, '-at-')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseBlockClass(php, source) {
  const cls = php.match(/(abstract\s+)?class\s+(\w+)\s+extends\s+\w+/);
  if (!cls || cls[1]) return null;
  const prop = (name) => php.match(new RegExp(`\\$${name}\\s*=\\s*(['"])(.*?)\\1`))?.[2] ?? null;
  const title = prop('name');
  if (!title) return null;
  const slug = prop('slug') ?? acfDefaultSlug(title);
  return {
    name: `acf/${slug}`,
    slug,
    className: cls[2],
    title,
    description: prop('description') ?? '',
    whenToUse: php.match(/@creator-when\s+(.+)/)?.[1].trim() ?? '',
    group: php.match(/Builder::make\(\s*['"]([\w-]+)['"]/)?.[1] ?? slug,
    source,
    fields: parseFields(php),
  };
}

const NOT_PROJECT_CODE = new Set(['node_modules', 'vendor', 'wp', 'uploads', 'storage', 'build', 'dist', '.git', '.creator']);

function* phpFiles(dir, { skip = new Set(), depth = 0, maxDepth = Infinity } = {}) {
  if (!existsSync(dir) || depth > maxDepth) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { if (!skip.has(entry.name)) yield* phpFiles(full, { skip, depth: depth + 1, maxDepth }); }
    else if (entry.name.endsWith('.php')) yield full;
  }
}

/**
 * Whether the project's own PHP registers a Blade directive
 * (Blade::directive('<name>', ...)). Composer packages are not scanned: a
 * directive that only a package registers reads as missing, and the view then
 * falls back to plain escaping, which is still safe.
 */
export function bladeDirectiveRegistered(stack, name) {
  const re = new RegExp(`directive\\(\\s*['"]${name}['"]`);
  for (const file of phpFiles(stack.projectDir, { skip: NOT_PROJECT_CODE, maxDepth: 8 })) {
    if (re.test(readFileSync(file, 'utf8'))) return true;
  }
  return false;
}

export function acfCatalog(stack) {
  const blocks = [];
  for (const file of phpFiles(join(stack.appPath, 'app', 'Blocks'))) {
    const block = parseBlockClass(readFileSync(file, 'utf8'), posix(relative(stack.projectDir, file)));
    if (block) blocks.push({ ...block, type: 'acf' });
  }
  return blocks.sort((a, b) => a.name.localeCompare(b.name));
}

export function findThemeCss(dir) {
  return ['resources/css/app.css', 'resources/styles/app.css'].map((p) => join(dir, p)).find((p) => existsSync(p)) ?? null;
}

/**
 * ACF Builder key: field_<group>_<path joined by _>. StoutLogic NamespaceFieldKey
 * replaces spaces in the group name with _ and lowercases the result; dashes stay
 * (Builder::make('feature-grid') gives field_feature-grid_items).
 */
export const fieldKey = (group, path) => `field_${String(group).replace(/ /g, '_')}_${path.join('_')}`.toLowerCase();

/**
 * ACF block "data": name => value plus _name => field key; repeater rows are
 * flattened as <name>_<i>_<sub>. Images need an attachment id, so they are
 * emitted as null and listed in `media` for import.
 */
export function acfData(pairs, group, media, prefix = '', path = []) {
  const data = {};
  for (const { slot, field } of pairs) {
    const name = `${prefix}${field.name}`;
    const key = fieldKey(group, [...path, field.name]);
    if (field.type === 'repeater') {
      const rows = slot.items ?? [];
      data[name] = rows.length;
      data[`_${name}`] = key;
      rows.forEach((item, i) => Object.assign(data, acfData(assign(item, field.subFields ?? []).pairs, group, media, `${name}_${i}_`, [...path, field.name])));
    } else if (field.type === 'image') {
      data[name] = null;
      data[`_${name}`] = key;
      media.push({ field: name, src: slot.value?.src ?? null, alt: slot.value?.alt ?? '' });
    } else {
      data[name] = valueFor(slot, field);
      data[`_${name}`] = key;
    }
  }
  return data;
}

export function emitAcfPage(entries) {
  const media = [];
  const parts = entries.map(({ block, pairs, spec }) => {
    const found = [];
    const data = acfData(pairs, block.group ?? block.slug, found);
    media.push(...found.map((m) => ({ spec: spec.id, block: block.name, ...m })));
    return serializeBlock(block.name, { name: block.name, data, mode: 'preview' });
  });
  return { markup: `${parts.join('\n\n')}\n`, media };
}

export const WHEN = {
  hero: 'A page-opening section: main heading, lead text, call to action and optional media.',
  features: 'A grid of repeated items, each with a heading and text.',
  stats: 'A stats section: a heading and a row of figures with labels.',
  cta: 'A short call to action: heading, text and one or two links.',
  faq: 'Questions and answers.',
  testimonial: 'A quote with its author.',
  logos: 'A row of logos.',
  form: 'A section around a form.',
  media: 'A large image or an embedded video.',
  text: 'A block of text with an optional heading.',
  steps: 'An ordered sequence of steps.',
  custom: 'A custom section generated from the design.',
};
const SLOT_TO_ACF = { heading: 'text', text: 'textarea', richtext: 'wysiwyg', image: 'image', link: 'link', embed: 'oembed' };
const ACF_METHOD = { text: 'addText', textarea: 'addTextarea', wysiwyg: 'addWysiwyg', image: 'addImage', link: 'addLink', oembed: 'addOembed' };

/** Fields for a new block, derived from the slots (forms are left to the person). */
export function fieldsFromSlots(slots) {
  const fields = [];
  const notes = [];
  for (const slot of slots) {
    if (slot.type === 'form') { notes.push(`form slot "${slot.name}": connect the project's form block or shortcode by hand`); continue; }
    if (slot.type === 'list') {
      const sub = fieldsFromSlots(slot.items?.[0] ?? []);
      fields.push({ name: slot.name, acfType: 'repeater', slotType: 'list', subFields: sub.fields.filter((f) => f.acfType !== 'repeater') });
      notes.push(...sub.notes);
      continue;
    }
    fields.push({ name: slot.name, acfType: SLOT_TO_ACF[slot.type], slotType: slot.type });
  }
  return { fields, notes };
}

export const toCatalogField = (f) => (f.acfType === 'repeater' ? { name: f.name, type: 'repeater', subFields: f.subFields.map(toCatalogField) } : { name: f.name, type: f.acfType });

export function uniqueName(spec, catalog) {
  const base = pascal(spec.kind === 'custom' ? spec.id.replace(/^\d+-/, '') : spec.kind);
  let className = base;
  let slug = kebab(base);
  for (let n = 2; catalog.some((b) => b.className === className || b.slug === slug); n++) {
    className = `${base}${n}`;
    slug = `${kebab(base)}-${n}`;
  }
  return { className, slug, title: words(className) };
}

function withLine(f) {
  if (f.acfType === 'repeater') return `'${f.name}' => is_array(get_field('${f.name}')) ? get_field('${f.name}') : [],`;
  if (f.acfType === 'image' || f.acfType === 'link') return `'${f.name}' => get_field('${f.name}') ?: null,`;
  return `'${f.name}' => (string) (get_field('${f.name}') ?: ''),`;
}

function builderLines(f, depth) {
  const pad = '    '.repeat(depth);
  if (f.acfType === 'repeater') return [`${pad}->addRepeater('${f.name}')`, ...f.subFields.flatMap((s) => builderLines(s, depth + 1)), `${pad}->endRepeater()`];
  return [`${pad}->${ACF_METHOD[f.acfType]}('${f.name}')`];
}

export function renderAcfClass({ namespace, className, title, slug, spec, fields }) {
  const builder = fields.flatMap((f) => builderLines(f, 3));
  builder[builder.length - 1] += ';';
  return [
    '<?php', '',
    `namespace ${namespace}\\Blocks;`, '',
    'use Log1x\\AcfComposer\\Block;',
    'use Log1x\\AcfComposer\\Builder;', '',
    '/**',
    ` * Generated by kivo-creator from ${spec.source.kind} ${safeComment(spec.source.ref)}.`,
    ' *',
    ` * @creator-when ${WHEN[spec.kind]}`,
    ' */',
    `class ${className} extends Block`,
    '{',
    `    public $name = '${phpString(title)}';`, '',
    `    public $slug = '${slug}';`, '',
    `    public $description = '${phpString(title)} section generated from the design.';`, '',
    "    public $category = 'design';", '',
    "    public $icon = 'block-default';", '',
    '    public $supports = [',
    "        'align' => false,",
    "        'anchor' => true,",
    "        'mode' => false,",
    "        'jsx' => false,",
    '    ];', '',
    '    public function with(): array',
    '    {',
    '        return [',
    ...fields.map((f) => `            ${withLine(f)}`),
    '        ];',
    '    }', '',
    '    public function fields(): array',
    '    {',
    '        $fields = Builder::make($this->slug);', '',
    '        $fields',
    ...builder,
    '',
    '        return $fields->build();',
    '    }',
    '}',
    '',
  ].join('\n');
}

export function renderBlockCss({ name, spec, proposals }) {
  const lines = [`/* ${name}: generated by kivo-creator from ${spec.source.kind} ${safeComment(spec.source.ref)}. */`];
  if (proposals.length) {
    lines.push('/* Token proposals (add to @theme, then use the utility; never a literal value): */');
    for (const p of proposals) lines.push(`/*   ${p.suggested}: ${p.value} (${p.role} ${p.prop}) */`);
  }
  return `${lines.join('\n')}\n`;
}

export function scaffoldAcf(stack, spec, { theme, catalog = [] }) {
  const { className, slug, title } = uniqueName(spec, catalog);
  const { fields, notes } = fieldsFromSlots(spec.slots);
  const textareaDirective = bladeDirectiveRegistered(stack, 'textarea');
  const hasTextarea = (list) => list.some((f) => f.acfType === 'textarea' || (f.subFields && hasTextarea(f.subFields)));
  if (!textareaDirective && hasTextarea(fields)) notes.push('@textarea is not registered in the project, so textarea fields are escaped with {!! nl2br(e(...)) !!}; switch to @textarea(...) if the project adds the directive');
  const { utils, proposals } = roleUtilities(spec.tokens, theme);
  const app = posix(relative(stack.projectDir, stack.appPath)) || '.';
  const at = (...parts) => posix(join(app, ...parts));
  const files = [
    { path: at('app', 'Blocks', `${className}.php`), content: renderAcfClass({ namespace: stack.namespace.replace(/\\+$/, ''), className, title, slug, spec, fields }) },
    { path: at('resources', 'views', 'blocks', `${slug}.blade.php`), content: renderView({ slug, spec, fields, utils, flavour: 'acf', textareaDirective }) },
    { path: at('resources', 'css', 'blocks', `${slug}.css`), content: renderBlockCss({ name: `acf/${slug}`, spec, proposals }) },
  ];
  const block = { name: `acf/${slug}`, type: 'acf', slug, className, title, description: `${title} section generated from the design.`, whenToUse: WHEN[spec.kind], group: slug, source: files[0].path, fields: fields.map(toCatalogField) };
  return { block, commands: [`acf:block ${className} --no-interaction`], files, notes, proposals };
}
