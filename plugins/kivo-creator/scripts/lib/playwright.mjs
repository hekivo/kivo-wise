// plugins/kivo-creator/scripts/lib/playwright.mjs
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NO_PLAYWRIGHT = [
  'Playwright was not found in the target project.',
  'kivo-creator ships no dependencies; it drives the project\'s own Playwright.',
  'Install it in the project (dev dependency), for example:',
  '  npm i -D playwright && npx playwright install chromium',
  'then run the command again from the project root.',
].join('\n');

/** Resolves playwright (or @playwright/test, playwright-core) from <projectDir>/node_modules. */
export async function loadPlaywright(projectDir) {
  const require = createRequire(join(resolve(projectDir), 'package.json'));
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    let entry;
    try {
      entry = require.resolve(name);
    } catch {
      continue;
    }
    const mod = await import(pathToFileURL(entry).href);
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (chromium) return { name, chromium };
  }
  return null;
}
