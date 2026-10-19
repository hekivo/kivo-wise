// plugins/kivo-creator/scripts/lib/context.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveStack } from './stack.mjs';
import { selectAdapter } from '../adapters/index.mjs';
import { loadTheme } from './tokens.mjs';

/** Stack, adapter, catalog and theme for a project (stackFile = kivo-wise detector JSON). */
export async function loadContext({ project = '.', stack: stackFile = '' } = {}) {
  const detection = stackFile ? JSON.parse(readFileSync(resolve(stackFile), 'utf8')) : null;
  const stack = resolveStack(project, { detection });
  const adapter = await selectAdapter(stack);
  const cssPath = adapter.themeCss(stack);
  return { stack, adapter, catalog: adapter.catalog(stack), theme: loadTheme(cssPath ? readFileSync(cssPath, 'utf8') : ''), cssPath };
}
