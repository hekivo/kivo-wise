// Content checks for the compose-wp skill and its routing (component 03). The skill contract
// itself (sections, length, links, tool names) is enforced by scripts/validate-skills.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_DIR = join(ROOT, 'skills', 'compose-wp');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');
const skill = read('skills', 'compose-wp', 'SKILL.md');

function section(text, heading) {
  const start = text.indexOf(`## ${heading}\n`);
  assert.ok(start !== -1, `section ${heading}`);
  const rest = text.slice(start + heading.length + 4);
  const end = rest.search(/\n## /);
  return end === -1 ? rest : rest.slice(0, end);
}

const REFERENCES = ['compose-file.md', 'bin-scripts.md', 'tls-and-hosts.md', 'wsl2.md', 'devcontainer-and-cloud.md', 'failure-modes.md'];

test('SKILL.md links the six references one hop away (AC-03-1)', () => {
  for (const ref of REFERENCES) {
    assert.ok(existsSync(join(SKILL_DIR, 'references', ref)), `references/${ref} exists`);
    assert.ok(skill.includes(`(references/${ref})`) || skill.includes(`\`references/${ref}\``), `SKILL.md links references/${ref}`);
  }
  assert.ok(skill.split('\n').length < 500);
  assert.match(skill, /^---\nname: compose-wp\ndescription: Use when /);
});

test('the lifecycle table uses Compose verbs only (AC-03-2)', () => {
  const procedure = section(skill, 'Procedure');
  const table = procedure.slice(procedure.indexOf('| Change | Command |'), procedure.indexOf('Team settings go in'));
  assert.ok(table.length > 100, 'lifecycle table found');
  assert.ok(!/lando/i.test(table), 'no Lando verb in the lifecycle table');
  for (const verb of ['docker compose up -d', 'docker compose build', 'docker compose restart', 'bin/down --volumes', 'bin/db-export']) {
    assert.ok(table.includes(verb), `lifecycle table has ${verb}`);
  }
});

test('the procedure covers every S-5 step (AC-03-2)', () => {
  const procedure = section(skill, 'Procedure');
  for (const needle of [
    'compose.yaml', 'override', 'docker compose ps', 'bin/setup', 'bin/up', '--cloud', '--ci', '{{session_kind}}',
    'from the project root', 'bin/db-import', 'bin/db-export', 'bin/db`', '`{{db_service}}`', 'DB_HOST=db', 'localhost',
    '{{runner.logs}}', 'docker compose logs -f {{web_service}}', 'debug.log', 'health',
    'sage-theme', 'acorn-mu-plugin', 'radicle-app',
  ]) assert.ok(procedure.includes(needle), `procedure mentions ${needle}`);
  const inputs = section(skill, 'Inputs required');
  for (const p of ['{{php_service}}', '{{web_service}}', '{{db_service}}', '{{cache_service}}', '{{node_service}}', 'runtime.session.kind', 'bin/info', 'docker context ls']) {
    assert.ok(inputs.includes(p), `inputs mention ${p}`);
  }
});

test('verification and failure modes match S-5 (AC-03-3)', () => {
  const verification = section(skill, 'Verification');
  for (const needle of ['bin/trust-cert', 'curl -I', '-k', 'bin/wp', 'core is-installed', 'option get siteurl', '{{runner.acorn}} --version', '{{runner.composer}} --version', 'PONG']) {
    assert.ok(verification.includes(needle) || verification.includes(needle.replace('bin/wp', '{{runner.wp}}')), `verification mentions ${needle}`);
  }
  const rows = read('skills', 'compose-wp', 'references', 'failure-modes.md');
  for (const needle of ['already allocated', 'is not running', 'UID/GID', '/mnt/c', 'Windows browser', 'docker: command not found', 'Cannot connect to the Docker daemon', 'unhealthy', 'TTY', 'allowlist']) {
    assert.ok(rows.includes(needle), `failure-modes.md row for ${needle}`);
  }
});

test('devcontainer-and-cloud.md states the S-6 facts (AC-03-4)', () => {
  const doc = read('skills', 'compose-wp', 'references', 'devcontainer-and-cloud.md');
  assert.match(doc, /stack starts per session/i);
  for (const host of ['wpackagist.org', 'api.wordpress.org', 'downloads.wordpress.org', 'pkg-containers.githubusercontent.com', 'connect.advancedcustomfields.com', 'developer.wordpress.org', 'roots.io', 'docs.docker.com', 'containers.dev']) {
    assert.ok(doc.includes(host), `allowlist host ${host}`);
  }
  assert.match(doc, /proxy `403`/);
  assert.match(doc, /never ask the user for a token value/);
  assert.match(doc, /never enters the machine, a file, an environment variable or the chat/);
  assert.match(doc, /synthetic fixtures only/);
  assert.match(doc, /cloud agent session/);
  assert.match(doc, /editor devcontainer|Editor devcontainers/);
  const refs = REFERENCES.map((r) => read('skills', 'compose-wp', 'references', r)).join('\n');
  assert.match(refs, /https:\/\/docs\.docker\.com\//);
  assert.match(refs, /https:\/\/containers\.dev\//);
});

test('routing sends Compose projects to compose-wp and keeps lando-wp (AC-03-5)', () => {
  const keywords = JSON.parse(read('skills', 'roots-router', 'references', 'keywords.json'));
  assert.deepEqual(keywords['compose-wp'], ['compose.yaml', 'docker compose', 'devcontainer', 'bin/wp', 'codespace', 'kivo-wp', 'compose-wp']);
  assert.deepEqual(keywords['lando-wp'], ['lando', '.lando.yml', 'landofile', 'lndo.site', 'xdebug', 'db-import', 'db-export', 'lando-wp']);
  const routing = JSON.parse(read('skills', 'roots-router', 'references', 'routing.json'));
  assert.ok(routing.routes.some((r) => r.skill === 'compose-wp'));
  const intent = routing.intents.find((i) => i.skill === 'compose-wp');
  for (const term of ['compose.yaml', 'docker compose', 'devcontainer', 'bin/wp', 'codespace', 'kivo-wp']) assert.ok(intent.match.includes(term), term);
  assert.ok(!routing.planned.includes('compose-wp'));
  const router = read('skills', 'roots-router', 'SKILL.md');
  assert.match(router, /`lando-wp` when `runtime\.runner` is `lando`, `compose-wp` when it is `compose`/);
  const tree = read('skills', 'roots-router', 'references', 'decision-tree.md');
  assert.match(tree, /\| `compose-wp` \|/);
  assert.match(tree, /`lando-wp` when `runtime\.runner` is `lando`, `compose-wp` when it is `compose`/);
});

test('jev-review prompts: Compose prompts expect compose-wp, Lando prompts keep lando-wp (AC-03-6)', () => {
  const { prompts } = JSON.parse(read('dev', 'jev-review', 'prompts.json'));
  const byPrefix = (prefix) => prompts.filter((p) => p.id.startsWith(prefix));
  assert.equal(byPrefix('compose-').length, 3);
  assert.ok(byPrefix('compose-').every((p) => p.expected === 'compose-wp'));
  assert.equal(byPrefix('lando-').length, 3);
  assert.ok(byPrefix('lando-').every((p) => p.expected === 'lando-wp'));
});

test('triage, commands and AGENTS.md document the compose runner (AC-03-7)', () => {
  const triage = read('skills', 'roots-triage', 'SKILL.md');
  for (const needle of ['`compose`', '`runtime.compose`', '`runtime.session`', 'Landofile still present', 'no bin/ scripts', 'docker CLI not found', 'bin/ scripts found but no Compose file', 'is not one of lando, compose, ddev, none', 'set but no <x> environment found', 'No Lando, Compose or DDEV environment found']) {
    assert.ok(triage.includes(needle), `roots-triage mentions ${needle}`);
  }
  assert.match(read('commands', 'roots-status.md'), /docker compose ps/);
  assert.match(read('commands', 'roots-status.md'), /<lando \| compose \| ddev \| none>/);
  assert.match(read('commands', 'roots-detect.md'), /<lando \| compose \| ddev \| none>/);
  assert.match(read('AGENTS.md'), /run through the\s+project runner from the session context \(`lando <cmd>`, or `bin\/<cmd>` from\s+the project root/);
});

test('evals/compose-wp copies the compose-bin fixture and grades runner-neutrally (AC-03-8)', () => {
  const scaffold = read('evals', 'compose-wp', 'scaffold.sh');
  assert.match(scaffold, /test\/fixtures\/projects\/compose-bin/);
  assert.match(scaffold, /rm -rf \.kivo-wise/);
  assert.ok(process.platform === 'win32' || (statSync(join(ROOT, 'evals', 'compose-wp', 'scaffold.sh')).mode & 0o111) !== 0, 'scaffold.sh is executable');
  assert.match(read('evals', 'compose-wp', 'graders', 'skill-fired.md'), /compose-wp/);
  assert.match(read('evals', 'compose-wp', 'graders', 'runner-acorn-command.md'), /bin\/wp acorn\|lando wp acorn/);
  assert.match(read('evals', 'compose-wp', 'graders', 'no-lando-verbs.md'), /match: not_contains/);
  assert.equal(read('evals', 'compose-wp', 'graders', 'no-bare-host-command.md'), read('evals', 'roots-debugging', 'graders', 'no-bare-host-command.md'));
});

test('lando-wp is unchanged by the Compose work (D-011)', () => {
  const lando = read('skills', 'lando-wp', 'SKILL.md');
  assert.ok(!/docker compose|compose\.yaml|bin\/wp|compose-wp/i.test(lando), 'lando-wp has no Compose content');
});
