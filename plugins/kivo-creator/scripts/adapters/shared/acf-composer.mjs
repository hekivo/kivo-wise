// plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs
/**
 * ACF Composer conventions shared by the acorn-mu-plugin and sage-theme adapters.
 * Block name acf/{slug}; slug defaults to the kebab-case $name; the field group
 * is Builder::make(<literal>) or the slug ($this->slug).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { kebab, posix } from './names.mjs';

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

export function parseBlockClass(php, source) {
  const cls = php.match(/(abstract\s+)?class\s+(\w+)\s+extends\s+\w+/);
  if (!cls || cls[1]) return null;
  const prop = (name) => php.match(new RegExp(`\\$${name}\\s*=\\s*(['"])(.*?)\\1`))?.[2] ?? null;
  const title = prop('name');
  if (!title) return null;
  const slug = prop('slug') ?? kebab(title);
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

function* phpFiles(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* phpFiles(full);
    else if (entry.name.endsWith('.php')) yield full;
  }
}

export function acfCatalog(stack) {
  const blocks = [];
  for (const file of phpFiles(join(stack.appPath, 'app', 'Blocks'))) {
    const block = parseBlockClass(readFileSync(file, 'utf8'), posix(relative(stack.projectDir, file)));
    if (block) blocks.push(block);
  }
  return blocks.sort((a, b) => a.name.localeCompare(b.name));
}

export function findThemeCss(dir) {
  return ['resources/css/app.css', 'resources/styles/app.css'].map((p) => join(dir, p)).find((p) => existsSync(p)) ?? null;
}
