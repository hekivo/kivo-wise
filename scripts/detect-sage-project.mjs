#!/usr/bin/env node
// Deprecated: replaced by detect-roots-project.mjs (kivo-wise 3.0.0). The JSON shape changed; see
// skills/roots-triage/references/triage.schema.json. This shim forwards all arguments.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.stderr.write('detect-sage-project.mjs is deprecated; use scripts/detect-roots-project.mjs (kivo-wise 3.0.0)\n');
const target = fileURLToPath(new URL('./detect-roots-project.mjs', import.meta.url));
const child = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(child.status ?? 0);
