import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detect, formatText, parseYamlSubset, sessionKind, RUNNER_CANDIDATES } from '../scripts/detect-roots-project.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCRIPT = join(ROOT, 'scripts', 'detect-roots-project.mjs');
const FIXTURES = join(__dirname, 'fixtures', 'projects');
const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'skills/roots-triage/references/triage.schema.json'), 'utf8'));

const fixture = (name) => join(FIXTURES, name);
const run = (name) => detect(fixture(name));

// Minimal JSON Schema checker: type, enum, const, required, properties,
// additionalProperties, items, oneOf (null-or-object), $ref into $defs.
function validate(schema, value, path = '$', errors = []) {
  if (schema.$ref) {
    const def = schema.$ref.replace('#/$defs/', '');
    return validate(SCHEMA.$defs[def], value, path, errors);
  }
  if (schema.oneOf) {
    const ok = schema.oneOf.some((s) => validate(s, value, path, []).length === 0);
    if (!ok) errors.push(`${path}: matches none of oneOf`);
    return errors;
  }
  if ('const' in schema && value !== schema.const) errors.push(`${path}: expected const ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (schema.type) {
    const types = [].concat(schema.type);
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
    const ok = types.some((t) => t === actual || (t === 'number' && actual === 'integer'));
    if (!ok) errors.push(`${path}: type ${actual} not in ${types.join('|')}`);
    if (!ok) return errors;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key}: missing`);
    for (const [key, child] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (sub) validate(sub, child, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not allowed`);
      else if (typeof schema.additionalProperties === 'object') validate(schema.additionalProperties, child, `${path}.${key}`, errors);
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errors));
  return errors;
}

function expectApp(result, index, expected) {
  const app = result.apps[index];
  assert.ok(app, `apps[${index}] exists`);
  for (const [key, want] of Object.entries(expected)) assert.equal(app[key], want, `apps[${index}].${key}`);
}

test('composer-mu-plugin: composer-wordpress layout with an Acorn mu-plugin (acme-core fixture)', () => {
  const r = run('composer-mu-plugin');
  assert.equal(r.layout, 'composer-wordpress');
  assert.equal(r.coreDir, 'wp');
  expectApp(r, 0, {
    kind: 'acorn-mu-plugin',
    path: 'wp-content/mu-plugins/acme-core',
    namespace: 'AcmeCore\\',
    basePathHint: 'ACORN_BASEPATH',
    postTypes: 'classes',
    blocks: 'acf-composer',
  });
  assert.deepEqual(r.apps[0].boot, { file: 'acme-core.php', hook: 'after_setup_theme', priority: 10 });
  assert.deepEqual(r.apps[0].providers, { source: 'configurator', file: 'app/Support/Helpers/AppConfigurator.php' });
  assert.equal(r.apps[0].versions['roots/acorn'], '6.2.0');
  assert.equal(r.apps[0].versions['livewire/livewire'], '4.3.5');
  assert.equal(r.apps[0].versions['log1x/acf-composer'], '3.4.6');
  assert.equal(r.apps[0].versions['log1x/poet'], '2.1.0');
  assert.equal(r.site.versions['roots/wordpress'], '7.1.3');
  assert.equal(r.site.versions['wpengine/advanced-custom-fields-pro'], '6.8.10');
  assert.equal(r.site.wpCli.path, 'wp');
  assert.equal(r.active, 0);
  assert.equal(r.apps.length, 1, 'third-party plugin composer.json without Acorn is ignored');
  assert.ok(r.notes.some((n) => /Poet/.test(n) && /PostTypes/.test(n)), 'notes mention both CPT mechanisms');
});

test('composer-mu-plugin: Lando runtime, misplaced env_file and runners', () => {
  const r = run('composer-mu-plugin');
  assert.equal(r.runtime.runner, 'lando');
  const l = r.runtime.lando;
  assert.equal(l.name, 'demo');
  assert.equal(l.recipe, 'wordpress');
  assert.equal(l.webroot, '.');
  assert.equal(l.php, '8.4');
  assert.equal(l.via, 'nginx');
  assert.equal(l.webService, 'appserver_nginx');
  assert.equal(l.database, 'mysql');
  assert.equal(l.xdebug, true);
  assert.equal(l.misplacedEnvFile, true);
  assert.deepEqual(l.envFile, []);
  assert.equal(l.services.redis.type, 'redis:6');
  assert.deepEqual(l.events, ['pre-start', 'post-start']);
  assert.equal(l.tooling['cache-clear'].service, 'appserver');
  assert.equal(l.tooling['cache-clear'].cmd, 'bash scripts/clear-cache.sh');
  assert.ok('build:fast' in l.tooling, 'tooling names may contain a colon');
  assert.match(l.tooling.login.cmd, /wp login as admin/);
  assert.deepEqual(l.parseErrors, []);
  assert.equal(r.runtime.runners.wp, 'lando wp');
  assert.equal(r.runtime.runners.acorn, 'lando wp acorn');
  assert.equal(r.runtime.runners.composer, 'lando composer');
  assert.equal(r.runtime.runners.node, 'lando yarn');
  assert.equal(r.runtime.runners.test, 'lando phpunit');
  assert.equal(r.runtime.runners.lint, 'lando pint-check');
  assert.equal(r.runtime.runners.cache, 'lando cache-clear');
  assert.equal(r.runtime.runners.logs, 'lando logs -s appserver -s appserver_nginx');
  assert.ok(r.warnings.some((w) => /env_file/.test(w)), 'misplaced env_file is reported as a warning');
});

test('sage-theme: a theme checkout alone is an unknown layout with one sage-theme app at .', () => {
  const r = run('sage-theme');
  assert.equal(r.layout, 'unknown');
  assert.equal(r.coreDir, null);
  expectApp(r, 0, {
    kind: 'sage-theme', path: '.', namespace: 'App\\', basePathHint: 'theme-inferred', postTypes: 'none', blocks: 'none',
  });
  assert.deepEqual(r.apps[0].boot, { file: 'functions.php', hook: null, priority: null });
  assert.deepEqual(r.apps[0].providers, { source: 'functions.php', file: 'functions.php' });
  assert.equal(r.apps[0].versions['roots/acorn'], '^6.0', 'constraint is used when there is no lock');
  assert.equal(r.runtime.runner, 'none');
  assert.equal(r.runtime.runners.wp, 'wp');
  assert.ok(r.warnings.some((w) => /Lando/.test(w)));
});

test('bedrock-plain: Bedrock without Acorn', () => {
  const r = run('bedrock-plain');
  assert.equal(r.layout, 'bedrock');
  assert.equal(r.coreDir, 'web/wp');
  assert.deepEqual(r.apps, []);
  assert.equal(r.active, null);
  assert.equal(r.site.versions['roots/wordpress'], '7.1.3');
  assert.equal(r.site.wpCli.docroot, 'web');
});

test('bedrock-sage: Bedrock with Sage at web/app/themes/sage', () => {
  const r = run('bedrock-sage');
  assert.equal(r.layout, 'bedrock');
  expectApp(r, 0, {
    kind: 'sage-theme', path: 'web/app/themes/sage', namespace: 'App\\', postTypes: 'none', blocks: 'none',
  });
  assert.equal(r.active, 0);
});

test('radicle: radicle-app at the root with acorn-post-types and native blocks', () => {
  const r = run('radicle');
  assert.equal(r.layout, 'radicle');
  assert.equal(r.coreDir, 'public/wp');
  expectApp(r, 0, {
    kind: 'radicle-app', path: '.', namespace: 'App\\', basePathHint: 'ACORN_BASEPATH', postTypes: 'acorn-post-types', blocks: 'native',
  });
  assert.deepEqual(r.apps[0].boot, { file: 'public/content/mu-plugins/00-acorn-boot.php', hook: 'after_setup_theme', priority: 0 });
  assert.deepEqual(r.apps[0].providers, { source: 'composer-extra', file: 'composer.json' });
  assert.equal(r.apps[0].versions['roots/acorn'], '6.3.0');
  assert.equal(r.apps[0].versions['roots/acorn-post-types'], '1.0.0');
  assert.equal(r.apps.length, 1, 'the radicle theme folder is not a second app');
  assert.equal(r.site.versions['roots/wordpress'], '6.9.4');
  assert.equal(r.site.wpCli.path, 'public/wp');
  const l = r.runtime.lando;
  assert.equal(l.webroot, 'public');
  assert.equal(l.database, 'mariadb');
  assert.equal(l.composerVersion, false);
  assert.deepEqual(l.envFile, ['.env', '.env.lando']);
  assert.equal(l.misplacedEnvFile, false);
  assert.deepEqual(l.excludes, ['vendor', 'node_modules']);
  assert.equal(l.services.assets.type, 'node:22');
  assert.equal(l.services.assets.image, 'node:24-bookworm');
  assert.equal(l.tooling.flush.cmd, 'wp cache flush && wp acorn optimize:clear && wp rewrite flush && redis-cli FLUSHALL');
  assert.equal(r.runtime.runners.acorn, 'lando acorn');
  assert.equal(r.runtime.runners.node, 'lando npm');
  assert.equal(r.runtime.runners.test, 'lando pest');
  assert.equal(r.runtime.runners.cache, 'lando flush');
  assert.equal(r.runtime.runners.composer, 'lando composer', 'composer_version false but a build step installs it');
});

test('plain-wp: vanilla WordPress', () => {
  const r = run('plain-wp');
  assert.equal(r.layout, 'plain-wordpress');
  assert.equal(r.coreDir, '.');
  assert.deepEqual(r.apps, []);
  assert.equal(r.site.versions.wordpress, '7.1.3');
});

test('flag-override: .roots-stack.json wins over the mu-plugin-first heuristic', () => {
  const r = run('flag-override');
  assert.deepEqual(r.flag, {
    file: '.roots-stack.json', profile: 'sage-theme', app: 'wp-content/themes/site-theme', runner: 'none', corpus: ['~/hekivo/kivo-wisdom/corpus'],
  });
  assert.equal(r.apps.length, 2, 'apps are still computed for drift warnings');
  assert.equal(r.apps[r.active].kind, 'sage-theme');
  assert.equal(r.apps[r.active].path, 'wp-content/themes/site-theme');
  assert.equal(r.runtime.runner, 'none');
});

test('flag-override: without the flag the mu-plugin is active', () => {
  const r = detect(fixture('flag-override'), { ignoreFlag: true });
  assert.equal(r.flag, null);
  assert.equal(r.apps[r.active].kind, 'acorn-mu-plugin');
});

test('mu-plugin-inferred-basepath: warns when a plugin app has no base path and a theme has composer.json', () => {
  const r = run('mu-plugin-inferred-basepath');
  expectApp(r, 0, { kind: 'acorn-mu-plugin', path: 'wp-content/mu-plugins/acme-core', basePathHint: null });
  assert.ok(r.warnings.some((w) => /ACORN_BASEPATH/.test(w) && /acme/.test(w)), r.warnings.join('\n'));
});

const PRE_COMPOSE_FIXTURES = ['composer-mu-plugin', 'sage-theme', 'bedrock-plain', 'bedrock-sage', 'radicle', 'plain-wp', 'flag-override', 'mu-plugin-inferred-basepath'];
const COMPOSE_FIXTURES = ['compose-bin', 'compose-no-contract', 'compose-anchors', 'composer-bin-dir', 'compose-no-bin', 'compose-and-lando', 'devcontainer-legacy', 'flag-runner-override', 'flag-runner-missing-env'];

test('every fixture validates against triage.schema.json', () => {
  for (const name of [...PRE_COMPOSE_FIXTURES, ...COMPOSE_FIXTURES]) {
    for (const env of [{ PATH: '' }, { PATH: process.env.PATH, CODESPACES: 'true' }]) {
      const errors = validate(SCHEMA, detect(fixture(name), { env }));
      assert.deepEqual(errors, [], `${name}: ${errors.join('; ')}`);
    }
  }
});

test('an empty directory is unknown with no apps and exits 0', () => {
  const r = detect(join(FIXTURES, 'plain-wp', 'wp-includes'));
  assert.equal(r.layout, 'unknown');
  assert.deepEqual(r.apps, []);
  assert.equal(r.active, null);
  assert.deepEqual(validate(SCHEMA, r), []);
});

test('CLI: --path= and --format=text, exit 0, both flag spellings', () => {
  const json = spawnSync('node', [SCRIPT, `--path=${fixture('radicle')}`], { encoding: 'utf8' });
  assert.equal(json.status, 0);
  assert.equal(JSON.parse(json.stdout).layout, 'radicle');
  const text = spawnSync('node', [SCRIPT, '--path', fixture('radicle'), '--format=text'], { encoding: 'utf8' });
  assert.equal(text.status, 0);
  assert.match(text.stdout.split('\n')[0], /^radicle · radicle-app @ \. · App\\ · acorn-post-types · native blocks · lando webroot public/);
  const missing = spawnSync('node', [SCRIPT, '--path=/nonexistent/path/for/kivo-wise'], { encoding: 'utf8' });
  assert.equal(missing.status, 0, 'never exits non-zero');
  assert.equal(JSON.parse(missing.stdout).layout, 'unknown');
});

test('YAML subset: nested maps, lists, list-of-maps, quoted scalars, block scalars, comments', () => {
  const doc = parseYamlSubset([
    'name: demo # trailing comment',
    'recipe: wordpress',
    'env_file:',
    '  - .env',
    '  - ".env.local"',
    'config:',
    '  php: "8.4"',
    '  xdebug: true',
    '  composer_version: false',
    'tooling:',
    '  build:fast:',
    '    cmd: bash build.sh',
    '  flush:',
    '    cmd:',
    '      - appserver: wp cache flush',
    '      - cache: redis-cli FLUSHDB',
    '  login:',
    '    cmd: >-',
    '      first line;',
    '      second line',
    '  ports:',
    '  - 5173:5173',
    'url: https://example.test/path',
    '',
  ].join('\n'));
  assert.equal(doc.name, 'demo');
  assert.deepEqual(doc.env_file, ['.env', '.env.local']);
  assert.equal(doc.config.php, '8.4');
  assert.equal(doc.config.xdebug, true);
  assert.equal(doc.config.composer_version, false);
  assert.equal(doc.tooling['build:fast'].cmd, 'bash build.sh');
  assert.deepEqual(doc.tooling.flush.cmd, [{ appserver: 'wp cache flush' }, { cache: 'redis-cli FLUSHDB' }]);
  assert.equal(doc.tooling.login.cmd, 'first line; second line');
  assert.deepEqual(doc.tooling.ports, ['5173:5173']);
  assert.equal(doc.url, 'https://example.test/path');
});

// Real projects are opt-in: point these env vars at local checkouts to run the check.
// KIVO_WISE_RADICLE_FIXTURE: a licensed Radicle project; KIVO_WISE_MU_PLUGIN_FIXTURE: an acorn-mu-plugin site.
test('YAML subset: parses real landofiles when the fixture env vars point at them', (t) => {
  const files = [process.env.KIVO_WISE_MU_PLUGIN_FIXTURE, process.env.KIVO_WISE_RADICLE_FIXTURE]
    .filter(Boolean)
    .map((dir) => join(dir, '.lando.yml'))
    .filter(existsSync);
  if (files.length === 0) return t.skip('KIVO_WISE_RADICLE_FIXTURE / KIVO_WISE_MU_PLUGIN_FIXTURE not set');
  for (const file of files) {
    const doc = parseYamlSubset(readFileSync(file, 'utf8'));
    assert.equal(doc.recipe, 'wordpress', file);
    assert.ok(doc.tooling && Object.keys(doc.tooling).length > 5, `${file}: tooling parsed`);
  }
});

test('large real-world projects: big composer.lock, configurator deep in app/, no duplicate version labels', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const tmp = mkdtempSync(join(tmpdir(), 'kivo-detect-'));
  try {
    cpSync(fixture('composer-mu-plugin'), tmp, { recursive: true });
    const mu = join(tmp, 'wp-content/mu-plugins/acme-core');
    // 600 classes sorted before Support/ so a bounded walk would never reach the configurator
    for (let i = 0; i < 600; i++) {
      const d = join(mu, 'app', 'Aaa', `Group${i}`);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'Thing.php'), '<?php\n');
    }
    // a lock bigger than any text-read cap
    const filler = Array.from({ length: 4000 }, (_, i) => ({ name: `vendor/pkg-${i}`, version: '1.0.0', description: 'x'.repeat(100) }));
    writeFileSync(join(mu, 'composer.lock'), JSON.stringify({ packages: [...filler, { name: 'roots/acorn', version: 'v6.2.0' }] }));
    const r = detect(tmp);
    assert.equal(r.apps[0].versions['roots/acorn'], '6.2.0');
    assert.deepEqual(r.apps[0].providers, { source: 'configurator', file: 'app/Support/Helpers/AppConfigurator.php' });
    assert.ok(!r.notes.some((n) => /invalid JSON/.test(n)), r.notes.join('\n'));
    const versionsLine = formatText(r).split('\n').find((l) => l.startsWith('versions:'));
    const labels = versionsLine.slice(10).split(' · ').map((p) => p.split(' ')[0]);
    assert.equal(new Set(labels).size, labels.length, versionsLine);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Docker Compose runner (spec S-2, S-3; component 01)
// ---------------------------------------------------------------------------

const DOCKER_DIR = mkdtempSync(join(tmpdir(), 'kivo-docker-'));
writeFileSync(join(DOCKER_DIR, 'docker'), '#!/bin/sh\nexit 0\n');
chmodSync(join(DOCKER_DIR, 'docker'), 0o755);
process.on('exit', () => rmSync(DOCKER_DIR, { recursive: true, force: true }));
const WITH_DOCKER = { PATH: DOCKER_DIR };
const NO_DOCKER = { PATH: '' };
const runEnv = (name, env = WITH_DOCKER) => detect(fixture(name), { env });

function withTmp(fn) {
  const tmp = mkdtempSync(join(tmpdir(), 'kivo-compose-'));
  try { return fn(tmp); } finally { rmSync(tmp, { recursive: true, force: true }); }
}

const KIVO_WP_COMPOSE = {
  files: ['compose.yaml', 'compose.override.yaml'],
  contract: { name: 'kivo-wp', version: 1 },
  devcontainer: '.devcontainer/devcontainer.json',
  services: { php: 'app', web: 'app', database: 'db', cache: 'cache', node: 'node', proxy: 'proxy', mail: 'mail' },
  bin: ['build', 'composer', 'dev', 'flush', 'logs', 'mago', 'npm', 'test', 'wp'],
  parseErrors: [],
};

test('compose-bin fixture scripts keep their executable bit', () => {
  for (const name of ['_lib.sh', ...KIVO_WP_COMPOSE.bin]) {
    const mode = statSync(join(fixture('compose-bin'), 'bin', name)).mode;
    assert.ok(process.platform === 'win32' || (mode & 0o111) !== 0, `bin/${name} lost its executable bit (git update-index --chmod=+x)`);
  }
});

test('compose-bin: kivo-wp contract 1 gives runner compose and the S-2 runtime.compose block (AC-01-1)', () => {
  const r = runEnv('compose-bin');
  assert.equal(r.runtime.runner, 'compose');
  assert.deepEqual(r.runtime.compose, KIVO_WP_COMPOSE);
  assert.deepEqual(r.runtime.session, { kind: 'local', dockerCli: true });
  assert.equal(r.runtime.lando, null);
  assert.deepEqual(r.warnings, []);
});

test('compose-bin: the runner map equals the S-3 kivo-wp column (AC-01-8)', () => {
  assert.deepEqual(runEnv('compose-bin').runtime.runners, {
    wp: 'bin/wp', acorn: 'bin/wp acorn', composer: 'bin/composer', node: 'bin/npm', test: 'bin/test', lint: 'bin/mago',
    cache: 'bin/flush', build: 'bin/build', dev: 'bin/dev', login: null, logs: 'bin/logs',
  });
});

test('Compose files resolve in Compose order and every override is listed (AC-01-1)', () => withTmp((tmp) => {
  writeFileSync(join(tmp, 'docker-compose.yml'), 'services:\n  app:\n    image: php:8.4-fpm\n');
  writeFileSync(join(tmp, 'compose.yml'), 'services:\n  app:\n    image: php:8.4-fpm\n');
  writeFileSync(join(tmp, 'docker-compose.override.yml'), 'services:\n  app:\n    environment:\n      A: "1"\n');
  writeFileSync(join(tmp, 'compose.override.yml'), 'services:\n  db:\n    image: mysql:8.4\n');
  const c = detect(tmp, { env: WITH_DOCKER }).runtime.compose;
  assert.deepEqual(c.files, ['compose.yml', 'compose.override.yml', 'docker-compose.override.yml']);
  assert.equal(c.services.database, 'db', 'services from an override are read');
}));

test('the shared candidate constant drives both runners (AC-01-8)', () => {
  assert.deepEqual(RUNNER_CANDIDATES.lint, ['pint-check', 'pint', 'phpcs', 'mago', 'lint']);
  const src = readFileSync(join(ROOT, 'scripts', 'detect-roots-project.mjs'), 'utf8');
  assert.ok(!/pickTool\(t, \[/.test(src), 'the Lando branch has no inline candidate lists');
});

test('compose-no-bin: docker compose exec -T forms and the no bin/ warning (AC-01-3, AC-01-8)', () => {
  const r = runEnv('compose-no-bin');
  assert.equal(r.runtime.runner, 'compose');
  assert.deepEqual(r.runtime.runners, {
    wp: 'docker compose exec -T app wp', acorn: 'docker compose exec -T app wp acorn', composer: 'docker compose exec -T app composer',
    node: null, test: null, lint: null, cache: null, build: null, dev: null, login: null, logs: null,
  });
  assert.deepEqual(r.warnings, ['compose: no bin/ scripts; commands use docker compose exec app']);
});

test('formatText prints the Compose file and contract where it prints the Lando webroot (AC-01-8)', () => {
  assert.equal(formatText(runEnv('compose-bin')).split('\n')[0], 'unknown · sage-theme @ . · App\\ · none · none blocks · compose compose.yaml (contract kivo-wp v1)');
  assert.equal(formatText(runEnv('compose-no-contract')).split('\n')[0], 'unknown · sage-theme @ . · App\\ · none · none blocks · compose compose.yaml');
  assert.equal(
    formatText(runEnv('compose-no-bin')).split('\n').find((l) => l.startsWith('runners:')),
    'runners: wp=docker compose exec -T app wp · acorn=docker compose exec -T app wp acorn · composer=docker compose exec -T app composer',
  );
  assert.equal(
    formatText(runEnv('compose-bin')).split('\n').find((l) => l.startsWith('runners:')),
    'runners: wp=bin/wp · acorn=bin/wp acorn · composer=bin/composer · node=bin/npm · test=bin/test · lint=bin/mago · cache=bin/flush · build=bin/build · dev=bin/dev · logs=bin/logs',
  );
});

test('logs falls back to docker compose logs, one name when web and php are the same service (AC-01-8)', () => {
  assert.equal(runEnv('compose-and-lando').runtime.runners.logs, 'docker compose logs -f app');
  withTmp((tmp) => {
    cpSync(join(fixture('compose-bin'), 'bin'), join(tmp, 'bin'), { recursive: true });
    rmSync(join(tmp, 'bin', 'logs'));
    writeFileSync(join(tmp, 'compose.yaml'), 'services:\n  php:\n    image: php:8.4-fpm\n  web:\n    image: nginx:1.27\n');
    const r = detect(tmp, { env: WITH_DOCKER });
    assert.equal(r.runtime.runners.logs, 'docker compose logs -f web php');
    assert.equal(r.runtime.runners.acorn, null, 'no Acorn app, no bin/acorn: no acorn runner');
  });
});

test('compose-no-contract: roles come from images; a Dockerfile service without a contract name is left out (AC-01-2)', () => {
  const r = runEnv('compose-no-contract');
  assert.equal(r.runtime.compose.contract, null);
  assert.deepEqual(r.runtime.compose.services, { php: 'php', web: 'web', database: 'database', cache: 'redis', node: 'assets', proxy: 'edge', mail: 'mailhog' });
  assert.ok(r.notes.includes('compose: service "worker" is built from a Dockerfile and has no image; its role is not inferred'), r.notes.join('\n'));
});

test('without a contract, fpm-nginx images and a Dockerfile-built contract name are matched (AC-01-2)', () => withTmp((tmp) => {
  writeFileSync(join(tmp, 'compose.yaml'), [
    'services:',
    '  site:',
    '    image: serversideup/php:8.4-fpm-nginx',
    '  front:',
    '    image: caddy:2',
    '  db:',
    '    image: mysql:8.4',
    '  cache:',
    '    image: valkey/valkey:8',
    '  mail:',
    '    image: axllent/mailpit:latest',
    '',
  ].join('\n'));
  assert.deepEqual(detect(tmp, { env: WITH_DOCKER }).runtime.compose.services,
    { php: 'site', web: 'site', database: 'db', cache: 'cache', node: null, proxy: 'front', mail: 'mail' });
  writeFileSync(join(tmp, 'compose.yaml'), 'services:\n  app:\n    build: .\n  node:\n    build: ./node\n');
  const c = detect(tmp, { env: WITH_DOCKER }).runtime.compose;
  assert.equal(c.services.php, 'app');
  assert.equal(c.services.web, 'app');
  assert.equal(c.services.node, 'node');
}));

test('an unknown higher contract version falls back to image roles with a note (AC-01-1)', () => withTmp((tmp) => {
  writeFileSync(join(tmp, 'compose.yaml'), 'x-kivo-wp:\n  contract: 2\nservices:\n  app:\n    image: php:8.4-fpm\n');
  const r = detect(tmp, { env: WITH_DOCKER });
  assert.deepEqual(r.runtime.compose.contract, { name: 'kivo-wp', version: 2 });
  assert.equal(r.runtime.compose.services.php, 'app');
  assert.equal(r.runtime.compose.services.web, null, 'contract 2 roles are not assumed');
  assert.ok(r.notes.includes('unknown kivo-wp contract 2; reading what exists'));
  writeFileSync(join(tmp, 'compose.yaml'), 'x-kivo-wp: { contract: 1 }\nservices:\n  app:\n    image: php:8.4-fpm\n');
  const flow = detect(tmp, { env: WITH_DOCKER });
  assert.equal(flow.runtime.compose.contract, null, 'a flow map is not read');
  assert.ok(flow.notes.some((n) => /x-kivo-wp is not a block map/.test(n)));
}));

test('devcontainer-legacy: a Compose file only under .devcontainer/ is not a runner (AC-01-3)', () => {
  const r = runEnv('devcontainer-legacy');
  assert.equal(r.runtime.runner, 'none');
  assert.equal(r.runtime.compose, null);
  assert.ok(r.notes.includes('.devcontainer/docker-compose.yml: editor-attached Compose stack; not used as the runner'));
});

test('bin/ scripts without a root Compose file give runner none and a warning (AC-01-3)', () => withTmp((tmp) => {
  cpSync(join(fixture('compose-bin'), 'bin'), join(tmp, 'bin'), { recursive: true });
  const r = detect(tmp, { env: WITH_DOCKER });
  assert.equal(r.runtime.runner, 'none');
  assert.ok(r.warnings.includes('bin/ scripts found but no Compose file; runner none'), r.warnings.join('\n'));
}));

test('composer-bin-dir: vendor binaries in bin/ are ignored with one note per file (AC-01-3)', () => {
  const r = runEnv('composer-bin-dir');
  assert.equal(r.runtime.runner, 'compose');
  assert.deepEqual(r.runtime.compose.bin, []);
  for (const name of ['README.txt', 'phpunit', 'pint']) {
    assert.ok(r.notes.some((n) => n.startsWith(`bin/${name}: not a Compose bin/ script`)), `note for bin/${name}`);
  }
  assert.deepEqual(r.warnings, ['compose: no bin/ scripts; commands use docker compose exec wordpress']);
});

test('compose-and-lando: Compose wins, the D-009 warning, runtime.lando still filled (AC-01-4)', () => {
  const r = runEnv('compose-and-lando');
  assert.equal(r.runtime.runner, 'compose');
  assert.equal(r.runtime.lando.name, 'legacy');
  assert.deepEqual(r.runtime.lando.files, ['.lando.yml']);
  assert.deepEqual(r.warnings, ['Landofile still present; runner compose chosen (set runner in .roots-stack.json to override)']);
  assert.equal(r.runtime.runners.wp, 'bin/wp');
});

test('flag-runner-override: a valid flag whose environment exists wins, drift warning stays (AC-01-5)', () => {
  const r = runEnv('flag-runner-override');
  assert.equal(r.runtime.runner, 'lando');
  assert.equal(r.runtime.runners.wp, 'lando wp');
  assert.ok(r.runtime.compose, 'runtime.compose is still reported');
  assert.deepEqual(r.warnings, ['.roots-stack.json: runner "lando" differs from the detected compose']);
});

test('flag-runner-missing-env: a flag without its environment keeps the detected runner (AC-01-5)', () => {
  const r = runEnv('flag-runner-missing-env');
  assert.equal(r.runtime.runner, 'lando');
  assert.ok(r.warnings.includes('.roots-stack.json: runner "compose" set but no compose environment found; using lando'), r.warnings.join('\n'));
  assert.ok(r.warnings.includes('.roots-stack.json: runner "compose" differs from the detected lando'));
});

test('an unknown flag runner is ignored with the S-2 warning (AC-01-5)', () => withTmp((tmp) => {
  cpSync(fixture('compose-bin'), tmp, { recursive: true });
  writeFileSync(join(tmp, '.roots-stack.json'), '{ "runner": "docker" }\n');
  const r = detect(tmp, { env: WITH_DOCKER });
  assert.equal(r.flag.runner, null);
  assert.equal(r.runtime.runner, 'compose');
  assert.deepEqual(r.warnings, ['.roots-stack.json: runner "docker" is not one of lando, compose, ddev, none']);
  writeFileSync(join(tmp, '.roots-stack.json'), '{ "runner": "none" }\n');
  const none = detect(tmp, { env: WITH_DOCKER });
  assert.equal(none.runtime.runner, 'none', 'none always exists');
  assert.equal(none.runtime.runners.wp, 'wp');
}));

test('YAML subset: anchor-only values, merge keys and aliases (AC-01-6)', () => {
  const skipped = [];
  const doc = parseYamlSubset(readFileSync(join(fixture('compose-anchors'), 'compose.yaml'), 'utf8'), { skipped });
  assert.deepEqual(doc['x-env'], { WP_ENV: 'development', DB_HOST: 'db' }, 'the block under an anchor-only value is read');
  assert.equal(doc['x-image'], 'kivo-wp/app:8.4', 'an anchored scalar keeps its value');
  assert.deepEqual(doc.services.app.environment, { EXTRA: '1' }, 'the merge key is skipped, not resolved');
  assert.deepEqual(doc.services.app.labels, {}, 'the alias value is skipped');
  assert.deepEqual(doc.services.db.environment, { MYSQL_DATABASE: 'wordpress' });
  assert.equal(Number(doc['x-kivo-wp'].contract), 1);
  assert.deepEqual(skipped.map((s) => s.kind), ['merge', 'alias']);
  const listed = [];
  assert.deepEqual(parseYamlSubset('a:\n  - one\n  - *two\n  - name: x\n    <<: *base\n', { skipped: listed }).a, ['one', { name: 'x' }]);
  assert.equal(listed.length, 2);
});

test('compose-anchors: the detector never throws and notes every skipped merge key and alias (AC-01-6)', () => {
  const r = runEnv('compose-anchors');
  assert.deepEqual(r.runtime.compose.parseErrors, []);
  assert.deepEqual(r.runtime.compose.contract, { name: 'kivo-wp', version: 1 });
  assert.deepEqual(r.notes.filter((n) => n.startsWith('compose.yaml: line')), [
    'compose.yaml: line 14: merge key "<<: *env" skipped (aliases are not resolved)',
    'compose.yaml: line 17: alias "tier: *php-image" skipped (aliases are not resolved)',
  ]);
});

test('unparseable Compose files, include and extends produce notes, never a crash (AC-01-6)', () => withTmp((tmp) => {
  writeFileSync(join(tmp, 'compose.yaml'), 'include:\n  - other.yaml\nservices:\n  app:\n    extends:\n      file: base.yaml\n      service: php\n    image: php:8.4-fpm\n');
  writeFileSync(join(tmp, 'compose.override.yaml'), 'services:\n  app:\n      bad: indentation\n    worse: here\n');
  const r = detect(tmp, { env: WITH_DOCKER });
  assert.equal(r.runtime.runner, 'compose');
  assert.equal(r.runtime.compose.parseErrors.length, 1);
  assert.match(r.runtime.compose.parseErrors[0], /^compose\.override\.yaml: /);
  assert.ok(r.notes.some((n) => /could not parse compose\.override\.yaml/.test(n)));
  assert.ok(r.notes.includes('compose: include is not followed; services from included files are not read'));
  assert.ok(r.notes.includes('compose: service "app" uses extends, which is not followed'));
  assert.equal(r.runtime.compose.services.php, 'app');
}));

test('COMPOSE_FILE is reported in a note and not followed', () => {
  const r = detect(fixture('compose-bin'), { env: { ...WITH_DOCKER, COMPOSE_FILE: 'other.yaml' } });
  assert.deepEqual(r.runtime.compose.files, KIVO_WP_COMPOSE.files);
  assert.ok(r.notes.some((n) => /COMPOSE_FILE is set/.test(n)));
});

test('runtime.session follows the S-2 signal order from an injected env (AC-01-7)', () => {
  const cases = [
    [{ CLAUDE_CODE_REMOTE: 'true', CODESPACES: 'true' }, 'cloud'],
    [{ CODESPACES: 'true', REMOTE_CONTAINERS: 'true' }, 'codespaces'],
    [{ KIVO_WP_CONTEXT: 'devcontainer' }, 'devcontainer'],
    [{ REMOTE_CONTAINERS: 'true' }, 'devcontainer'],
    [{ CLAUDE_CODE_REMOTE: '1', CODESPACES: 'false' }, 'local'],
    [{}, 'local'],
  ];
  for (const [env, kind] of cases) {
    assert.equal(sessionKind(env), kind, JSON.stringify(env));
    assert.equal(detect(fixture('compose-bin'), { env: { ...env, ...WITH_DOCKER } }).runtime.session.kind, kind);
  }
  assert.equal(detect(fixture('sage-theme'), { env: { CODESPACES: 'true', PATH: '' } }).runtime.session.kind, 'codespaces', 'present for every runner');
  assert.equal(detect('/nonexistent/path/for/kivo-wise', { env: { CODESPACES: 'true' } }).runtime.session.kind, 'codespaces');
});

test('runtime.session.dockerCli comes from a PATH scan; without docker the compose runner warns (AC-01-7)', () => {
  assert.equal(runEnv('compose-bin', WITH_DOCKER).runtime.session.dockerCli, true);
  const r = runEnv('compose-bin', NO_DOCKER);
  assert.equal(r.runtime.session.dockerCli, false);
  assert.deepEqual(r.warnings, ['docker CLI not found: bin/ scripts need Docker; open the project in the workspace container, not the app container']);
  assert.ok(!runEnv('sage-theme', NO_DOCKER).warnings.some((w) => /docker CLI/.test(w)), 'only the compose runner needs docker');
  withTmp((tmp) => {
    writeFileSync(join(tmp, 'docker'), '#!/bin/sh\n');
    chmodSync(join(tmp, 'docker'), 0o644);
    assert.equal(detect(fixture('compose-bin'), { env: { PATH: tmp } }).runtime.session.dockerCli, process.platform === 'win32', 'a non-executable docker file does not count');
  });
});

test('the detector spawns no process', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'detect-roots-project.mjs'), 'utf8');
  assert.ok(!/child_process/.test(src), 'detect-roots-project.mjs must not import child_process');
});

test('no regression: pre-existing fixtures keep runner, runners, lando and warnings from main (AC-01-9)', () => {
  const baseline = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'detector-baseline-main.json'), 'utf8'));
  assert.deepEqual(Object.keys(baseline).sort(), [...PRE_COMPOSE_FIXTURES].sort());
  for (const name of PRE_COMPOSE_FIXTURES) {
    for (const env of [NO_DOCKER, WITH_DOCKER, { ...WITH_DOCKER, CODESPACES: 'true' }]) {
      const r = detect(fixture(name), { env });
      assert.deepEqual(
        { runner: r.runtime.runner, runners: r.runtime.runners, lando: r.runtime.lando, warnings: r.warnings },
        baseline[name],
        name,
      );
      assert.equal(r.runtime.compose, null, `${name}: runtime.compose is null`);
    }
  }
});
