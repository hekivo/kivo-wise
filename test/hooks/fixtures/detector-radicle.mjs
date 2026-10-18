#!/usr/bin/env node
// Fixture detector: canned C1 JSON for a Radicle project (synthetic, own-words signals only).
const root = (process.argv.find((a) => a.startsWith('--path=')) || '--path=.').slice(7);
process.stdout.write(JSON.stringify({
  tool: { name: 'detect-roots-project', version: '3.0.0' },
  root,
  layout: 'radicle',
  coreDir: 'public/wp',
  apps: [
    {
      kind: 'radicle-app',
      path: '.',
      namespace: 'App\\',
      basePathHint: 'root',
      boot: { file: 'public/content/mu-plugins/00-acorn-boot.php', hook: null, priority: null },
      providers: { source: 'config/app.php', file: 'config/app.php' },
      blocks: 'native',
      postTypes: 'acorn-post-types',
      versions: { 'roots/acorn': '6.3.0' },
    },
  ],
  active: 0,
  site: { versions: { 'roots/wordpress': '7.1.3' }, wpCli: { path: 'wp', docroot: 'public/wp' } },
  runtime: {
    runner: 'lando',
    lando: {
      name: 'radicle', recipe: 'wordpress', webroot: 'public', php: '8.3', via: 'nginx', database: 'mysql', xdebug: false,
      webService: 'appserver_nginx', envFile: ['.env'], misplacedEnvFile: false,
      services: {}, tooling: {}, events: [],
      runners: { wp: 'lando wp', acorn: 'lando wp acorn', composer: 'lando composer', node: 'lando npm', test: null, lint: null, cache: null, logs: 'lando logs -s appserver' },
    },
  },
  flag: null,
  warnings: [],
  notes: [],
  truncated: false,
}) + '\n');
