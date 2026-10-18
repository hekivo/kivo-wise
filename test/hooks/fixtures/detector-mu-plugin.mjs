#!/usr/bin/env node
// Fixture detector: canned C1 JSON for the reference acorn-mu-plugin shape (composer-wordpress + acorn-mu-plugin).
const root = (process.argv.find((a) => a.startsWith('--path=')) || '--path=.').slice(7);
process.stdout.write(JSON.stringify({
  tool: { name: 'detect-roots-project', version: '3.0.0' },
  root,
  layout: 'composer-wordpress',
  coreDir: 'wp',
  apps: [
    {
      kind: 'acorn-mu-plugin',
      path: 'wp-content/mu-plugins/acme-core',
      namespace: 'AcmeCore\\',
      basePathHint: 'configure-arg',
      boot: { file: 'acme-core.php', hook: 'after_setup_theme', priority: 10 },
      providers: { source: 'configurator', file: 'app/Support/Helpers/AppConfigurator.php' },
      blocks: 'acf-composer',
      postTypes: 'classes',
      versions: { 'roots/acorn': '6.2.0', 'livewire/livewire': '4.3.5', 'log1x/acf-composer': '3.4.6', 'log1x/poet': '2.1.0' },
    },
  ],
  active: 0,
  site: { versions: { 'roots/wordpress': '7.1.3', 'wpengine/advanced-custom-fields-pro': '6.8.10' }, wpCli: { path: 'wp', docroot: null } },
  runtime: {
    runner: 'lando',
    lando: {
      name: 'acme', recipe: 'wordpress', webroot: '.', php: '8.4', via: 'nginx', database: 'mysql', xdebug: true,
      webService: 'appserver_nginx', envFile: [], misplacedEnvFile: true,
      services: { redis: { type: 'redis:6' } },
      tooling: { 'cache-clear': { service: 'appserver', cmd: 'wp cache flush && wp acorn optimize:clear' } },
      events: ['pre-start', 'post-start', 'post-db-import'],
      runners: { wp: 'lando wp', acorn: 'lando wp acorn', composer: 'lando composer', node: 'lando yarn', test: 'lando phpunit', lint: 'lando pint-check', cache: 'lando cache-clear', logs: 'lando logs -s appserver -s appserver_nginx' },
    },
  },
  flag: { file: '.roots-stack.json', profile: 'acorn-mu-plugin', app: 'wp-content/mu-plugins/acme-core', runner: 'lando' },
  warnings: ['acorn app without ACORN_BASEPATH while theme acme-2025 has composer.json'],
  notes: [],
  truncated: false,
}) + '\n');
