// plugins/kivo-creator/scripts/adapters/sage-theme.mjs
/**
 * Sage themes: the catalog holds the theme's ACF Composer classes (app/Blocks)
 * and its block.json files. New blocks follow the theme's existing pattern
 * (shared/block-type.mjs); with no blocks yet the recommendation is ACF when
 * composer.json requires log1x/acf-composer, otherwise native.
 */
import { findThemeCss } from './shared/acf-composer.mjs';
import { emitByBlockType, scaffoldByBlockType, unionCatalog } from './shared/block-type.mjs';

export default {
  name: 'sage-theme',
  profiles: ['sage-theme'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => unionCatalog(stack),
  emitPage: (stack, entries) => emitByBlockType(entries),
  scaffoldBlock: (stack, spec, options) => scaffoldByBlockType(stack, spec, options),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
