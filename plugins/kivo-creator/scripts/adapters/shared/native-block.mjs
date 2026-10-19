// plugins/kivo-creator/scripts/adapters/shared/native-block.mjs
/**
 * Native blocks (block.json). Used by the radicle adapter and by sage-theme
 * when the theme registers blocks without ACF Composer. The layout follows the
 * project's existing block.json files; nothing about folders is assumed.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { posix } from './names.mjs';

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
