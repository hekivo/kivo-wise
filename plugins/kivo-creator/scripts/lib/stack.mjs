// plugins/kivo-creator/scripts/lib/stack.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const PROFILES = ['acorn-mu-plugin', 'sage-theme', 'radicle-app'];
// Same mapping as kivo-wise /roots-detect --write.
const KIND_TO_PROFILE = {
  'sage-theme': 'sage-theme',
  'acorn-theme': 'sage-theme',
  'acorn-mu-plugin': 'acorn-mu-plugin',
  'acorn-plugin': 'acorn-mu-plugin',
  'radicle-app': 'radicle-app',
};

const readJsonIfExists = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

/**
 * Target stack for an adapter. `.roots-stack.json` (written by kivo-wise
 * /roots-detect --write) wins; otherwise `detection` is the JSON printed by
 * kivo-wise's scripts/detect-roots-project.mjs.
 */
export function resolveStack(projectDir, { detection = null } = {}) {
  const root = resolve(projectDir);
  const flag = readJsonIfExists(join(root, '.roots-stack.json'));
  const app = detection?.apps?.[detection.active ?? 0] ?? null;
  const profile = flag?.profile ?? (app ? KIND_TO_PROFILE[app.kind] : undefined);
  const appRel = flag?.app ?? app?.path;
  if (!profile || appRel === undefined) {
    throw new Error('No Roots profile found. Run kivo-wise /roots-detect --write to create .roots-stack.json, or pass the detector JSON with --stack=<file>.');
  }
  if (!PROFILES.includes(profile)) throw new Error(`Unknown profile "${profile}" (expected ${PROFILES.join(', ')})`);
  const appPath = resolve(root, appRel);
  return {
    projectDir: root,
    profile,
    appPath,
    namespace: readNamespace(appPath) ?? app?.namespace ?? 'App\\',
    blocks: app?.blocks ?? (existsSync(join(appPath, 'app', 'Blocks')) ? 'acf-composer' : 'native'),
    runner: flag?.runner ?? detection?.runtime?.runner ?? 'none',
    // creator.blocks ("acf" | "native"): validated by adapters/shared/block-type.mjs.
    creatorBlocks: flag?.creator?.blocks ?? null,
  };
}

function readNamespace(appPath) {
  const psr4 = readJsonIfExists(join(appPath, 'composer.json'))?.autoload?.['psr-4'] ?? {};
  const hit = Object.entries(psr4).find(([, dir]) => [].concat(dir).some((d) => d.replace(/\/$/, '') === 'app'));
  return hit?.[0] ?? null;
}
