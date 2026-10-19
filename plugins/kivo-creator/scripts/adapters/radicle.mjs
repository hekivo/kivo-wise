// plugins/kivo-creator/scripts/adapters/radicle.mjs
/**
 * Radicle projects keep app/, config/ and resources/ at the project root.
 * The catalog holds native blocks (block.json) and any ACF Composer classes;
 * new blocks follow the project's existing pattern (shared/block-type.mjs),
 * and native is only the recommendation when there are no blocks yet. Native
 * blocks go next to the existing block.json files (fallback resources/blocks,
 * unverified; see docs/provenance.md).
 */
import { findThemeCss } from './shared/acf-composer.mjs';
import { emitByBlockType, scaffoldByBlockType, unionCatalog } from './shared/block-type.mjs';

export default {
  name: 'radicle',
  profiles: ['radicle-app'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => unionCatalog(stack),
  emitPage: (stack, entries) => emitByBlockType(entries),
  scaffoldBlock: (stack, spec, options) => scaffoldByBlockType(stack, spec, options),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
