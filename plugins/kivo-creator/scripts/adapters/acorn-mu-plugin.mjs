// plugins/kivo-creator/scripts/adapters/acorn-mu-plugin.mjs
/**
 * Acorn mu-plugin: blocks live in the plugin (ACF Composer classes in
 * app/Blocks, block.json files anywhere under it). The catalog holds both;
 * new blocks follow the project's existing pattern (shared/block-type.mjs),
 * and ACF Composer is only the recommendation when there are no blocks yet.
 */
import { findThemeCss } from './shared/acf-composer.mjs';
import { emitByBlockType, scaffoldByBlockType, unionCatalog } from './shared/block-type.mjs';

export default {
  name: 'acorn-mu-plugin',
  profiles: ['acorn-mu-plugin'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => unionCatalog(stack),
  emitPage: (stack, entries) => emitByBlockType(entries),
  scaffoldBlock: (stack, spec, options) => scaffoldByBlockType(stack, spec, options),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
