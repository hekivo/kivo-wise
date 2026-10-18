#!/usr/bin/env node
import { main } from '../src/cli.mjs';

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code ?? 0;
  },
  (err) => {
    console.error(`docs-brain: ${err?.stack || err}`);
    process.exitCode = 1;
  },
);
