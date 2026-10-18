import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detect, formatText, parseYamlSubset } from '../scripts/detect-roots-project.mjs';

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

test('every fixture validates against triage.schema.json', () => {
  for (const name of ['composer-mu-plugin', 'sage-theme', 'bedrock-plain', 'bedrock-sage', 'radicle', 'plain-wp', 'flag-override', 'mu-plugin-inferred-basepath']) {
    const errors = validate(SCHEMA, run(name));
    assert.deepEqual(errors, [], `${name}: ${errors.join('; ')}`);
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
