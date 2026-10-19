// plugins/kivo-creator/scripts/adapters/acorn-mu-plugin.mjs
import { acfCatalog, emitAcfPage, findThemeCss, scaffoldAcf } from './shared/acf-composer.mjs';

export default {
  name: 'acorn-mu-plugin',
  profiles: ['acorn-mu-plugin'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => acfCatalog(stack),
  emitPage: (stack, entries) => emitAcfPage(entries),
  scaffoldBlock: (stack, spec, options) => scaffoldAcf(stack, spec, options),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
