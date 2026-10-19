// plugins/kivo-creator/scripts/adapters/index.mjs
/**
 * Adapter contract. An adapter is a plain object:
 *  name                   string
 *  profiles               kivo-wise profiles it serves
 *  selector               CSS selector of one rendered section (verify)
 *  allowsGeneratedBlocks  false = record a gap instead of scaffolding
 *  catalog(stack)         -> Block[]  { name, slug, className?, title, description, whenToUse, group?, source, fields: Field[] }
 *                            Field { name, type (ACF vocabulary: text, textarea, wysiwyg, image, link, url, oembed, repeater, ...), min?, max?, subFields? }
 *  emitPage(stack, entries) -> { markup, media }   entries: [{ block, pairs, spec }] (pairs from lib/fill.mjs assign())
 *  scaffoldBlock(stack, spec, { theme, catalog }) -> { block, commands, files: [{ path, content }], notes, proposals } | { gap }
 *  themeCss(stack)        -> absolute path of the CSS file holding @theme, or null
 */
const REQUIRED = ['name', 'profiles', 'selector', 'allowsGeneratedBlocks', 'catalog', 'emitPage', 'scaffoldBlock', 'themeCss'];
const FUNCTIONS = ['catalog', 'emitPage', 'scaffoldBlock', 'themeCss'];

export const ADAPTER_FOR_PROFILE = { 'acorn-mu-plugin': 'acorn-mu-plugin', 'sage-theme': 'sage-theme', 'radicle-app': 'radicle' };
const LOADERS = {
  'acorn-mu-plugin': () => import('./acorn-mu-plugin.mjs'),
  'sage-theme': () => import('./sage-theme.mjs'),
  radicle: () => import('./radicle.mjs'),
};

export function assertAdapter(adapter) {
  const missing = REQUIRED.filter((k) => !(k in (adapter ?? {})));
  if (missing.length) throw new Error(`adapter ${adapter?.name ?? '?'} misses ${missing.join(', ')}`);
  const notFunctions = FUNCTIONS.filter((k) => typeof adapter[k] !== 'function');
  if (notFunctions.length) throw new Error(`adapter ${adapter.name}: ${notFunctions.join(', ')} must be functions`);
  return adapter;
}

export async function selectAdapter(stack) {
  const name = ADAPTER_FOR_PROFILE[stack.profile];
  if (!name) throw new Error(`No adapter for profile "${stack.profile}"`);
  if (!LOADERS[name]) throw new Error(`The ${name} adapter is not available yet`);
  return assertAdapter((await LOADERS[name]()).default);
}
