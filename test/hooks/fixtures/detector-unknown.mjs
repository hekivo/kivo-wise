#!/usr/bin/env node
// Fixture detector: nothing found (layout unknown, no apps) → hooks must stay silent.
const root = (process.argv.find((a) => a.startsWith('--path=')) || '--path=.').slice(7);
process.stdout.write(JSON.stringify({
  tool: { name: 'detect-roots-project', version: '3.0.0' },
  root, layout: 'unknown', coreDir: null, apps: [], active: null,
  site: { versions: {}, wpCli: { path: 'wp', docroot: null } },
  runtime: { runner: 'none', lando: null },
  flag: null, warnings: [], notes: ['no composer.json found'], truncated: false,
}) + '\n');
