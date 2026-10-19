// plugins/kivo-creator/scripts/adapters/radicle.mjs
/**
 * Radicle projects keep app/, config/ and resources/ at the project root and
 * use native blocks (block.json). Folder layout and the generator are read
 * from the project, not assumed: new blocks go next to the existing block.json
 * files (fallback resources/blocks, unverified; see docs/provenance.md).
 */
import { findThemeCss } from './shared/acf-composer.mjs';
import { emitNativePage, nativeCatalog, scaffoldNative } from './shared/native-block.mjs';

export default {
  name: 'radicle',
  profiles: ['radicle-app'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => nativeCatalog(stack),
  emitPage: (stack, entries) => emitNativePage(entries),
  scaffoldBlock: (stack, spec, options) => scaffoldNative(stack, spec, options),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
