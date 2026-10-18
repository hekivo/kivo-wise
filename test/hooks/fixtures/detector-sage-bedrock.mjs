#!/usr/bin/env node
// Fixture detector: Bedrock + Sage theme, no Lando (runner none).
const root = (process.argv.find((a) => a.startsWith('--path=')) || '--path=.').slice(7);
process.stdout.write(JSON.stringify({
  tool: { name: 'detect-roots-project', version: '3.0.0' },
  root,
  layout: 'bedrock',
  coreDir: 'web/wp',
  apps: [
    {
      kind: 'sage-theme', path: 'web/app/themes/sage', namespace: 'App\\', basePathHint: 'theme-inferred',
      boot: { file: 'functions.php', hook: null, priority: null },
      providers: { source: 'functions.php', file: 'functions.php' },
      blocks: 'none', postTypes: 'none',
      versions: { 'roots/acorn': '5.0.4' },
    },
  ],
  active: 0,
  site: { versions: { 'roots/wordpress': '6.9.1' }, wpCli: { path: 'wp', docroot: 'web' } },
  runtime: { runner: 'none', lando: null },
  flag: null, warnings: [], notes: [], truncated: false,
}) + '\n');
