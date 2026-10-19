// plugins/kivo-creator/scripts/lib/context.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveStack } from './stack.mjs';
import { selectAdapter } from '../adapters/index.mjs';
import { resolveBlockType } from '../adapters/shared/block-type.mjs';
import { loadTheme } from './tokens.mjs';

/**
 * Stack, adapter, catalog, theme and the block type for new blocks
 * (stackFile = kivo-wise detector JSON; blocks = the person's --blocks answer).
 */
export async function loadContext({ project = '.', stack: stackFile = '', blocks = '' } = {}) {
  const detection = stackFile ? JSON.parse(readFileSync(resolve(stackFile), 'utf8')) : null;
  const stack = resolveStack(project, { detection });
  const adapter = await selectAdapter(stack);
  const cssPath = adapter.themeCss(stack);
  const catalog = adapter.catalog(stack);
  const blockType = resolveBlockType(stack, catalog, { asked: blocks || null });
  return { stack, adapter, catalog, blockType, theme: loadTheme(cssPath ? readFileSync(cssPath, 'utf8') : ''), cssPath };
}
