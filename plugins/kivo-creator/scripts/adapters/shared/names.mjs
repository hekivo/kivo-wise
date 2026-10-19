// plugins/kivo-creator/scripts/adapters/shared/names.mjs
export const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const pascal = (s) => kebab(s).split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
export const words = (className) => className.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
export const posix = (p) => p.split('\\').join('/');
/** Keeps generated comments from closing early (PHP, Blade, CSS). */
export const safeComment = (s) => String(s).replace(/\*\//g, '* /').replace(/--}}/g, '- -}}');
export const phpString = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
