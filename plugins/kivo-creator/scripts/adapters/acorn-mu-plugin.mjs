// plugins/kivo-creator/scripts/adapters/acorn-mu-plugin.mjs
import { acfCatalog, emitAcfPage, findThemeCss } from './shared/acf-composer.mjs';

export default {
  name: 'acorn-mu-plugin',
  profiles: ['acorn-mu-plugin'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => acfCatalog(stack),
  emitPage: (stack, entries) => emitAcfPage(entries),
  scaffoldBlock: () => ({ gap: 'scaffolding lands in the next task' }),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
