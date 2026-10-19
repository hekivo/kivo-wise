// plugins/kivo-creator/scripts/adapters/sage-theme.mjs
/**
 * Sage themes: ACF Composer blocks (app/Blocks) when the theme uses it,
 * otherwise native block.json blocks found in the theme.
 */
import { acfCatalog, emitAcfPage, findThemeCss, scaffoldAcf } from './shared/acf-composer.mjs';
import { emitNativePage, nativeCatalog, scaffoldNative } from './shared/native-block.mjs';

const usesAcf = (stack) => stack.blocks === 'acf-composer';

export default {
  name: 'sage-theme',
  profiles: ['sage-theme'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => (usesAcf(stack) ? acfCatalog(stack) : nativeCatalog(stack)),
  emitPage: (stack, entries) => (usesAcf(stack) ? emitAcfPage(entries) : emitNativePage(entries)),
  scaffoldBlock: (stack, spec, options) => (usesAcf(stack) ? scaffoldAcf(stack, spec, options) : scaffoldNative(stack, spec, options)),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
