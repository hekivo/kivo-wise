// plugins/kivo-creator/scripts/lib/args.mjs
import { pathToFileURL } from 'node:url';

/**
 * Parses --key=value options. `defaults` lists every accepted key; keys named
 * in `flags` may appear bare (--check) and become true.
 */
export function parseOptions(argv, defaults, { flags = Object.keys(defaults).filter((k) => defaults[k] === false) } = {}) {
  const options = { ...defaults };
  for (const arg of argv) {
    if (!arg.startsWith('--')) throw new Error(`unexpected argument "${arg}"`);
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (!(key in defaults)) throw new Error(`unknown option --${key}`);
    if (eq === -1) {
      if (!flags.includes(key)) throw new Error(`--${key} needs a value (--${key}=...)`);
      options[key] = true;
    } else {
      options[key] = arg.slice(eq + 1);
    }
  }
  return options;
}

/**
 * Runs main() when the module is executed directly, printing errors without a
 * stack. A main() may set process.exitCode before throwing to pick the code.
 */
export function runCli(importMetaUrl, main) {
  if (process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href) {
    Promise.resolve()
      .then(() => main(process.argv.slice(2)))
      .catch((error) => {
        console.error(error.message);
        process.exit(process.exitCode || 1);
      });
  }
}
