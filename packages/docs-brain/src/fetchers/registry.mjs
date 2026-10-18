// Maps a source type to its fetcher module.
const MODULES = {
  git: './git.mjs',
  'local-git': './local-git.mjs',
  rest: './rest.mjs',
  sitemap: './sitemap.mjs',
  llms: './llms.mjs',
  negotiate: './negotiate.mjs',
};

export async function fetcherFor(type) {
  const mod = MODULES[type];
  return mod ? import(mod) : null;
}
