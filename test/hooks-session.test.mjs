// Session-aware pieces of the hooks (component 02): session kind parity with the detector,
// the detection cache keyed by session kind, the corpus line outside local sessions and the
// literal .gitignore match used by protect-files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { currentSessionKind, detectionSessionKind, isGitignored, readCache, writeCache, CACHE_DIR, CACHE_FILE } from '../hooks/lib.mjs';
import { sessionKind } from '../scripts/detect-roots-project.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(ROOT, 'hooks', 'session-start.mjs');
const FIXTURES = join(ROOT, 'test', 'hooks', 'fixtures');

function withTmp(fn) {
  const tmp = mkdtempSync(join(tmpdir(), 'kivo-hooks-'));
  try { return fn(tmp); } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function sessionStart(cwd, envOverrides) {
  const env = { ...process.env };
  for (const key of ['KIVO_WISE_NO_CACHE', 'KIVO_WISE_HOOK_DEBUG', 'CLAUDE_CODE_REMOTE', 'CODESPACES', 'KIVO_WP_CONTEXT', 'REMOTE_CONTAINERS']) delete env[key];
  Object.assign(env, envOverrides);
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd }),
    env,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout.trim() ? JSON.parse(res.stdout).hookSpecificOutput.additionalContext : '';
}

const SIGNALS = [
  {},
  { CLAUDE_CODE_REMOTE: 'true' },
  { CLAUDE_CODE_REMOTE: 'false' },
  { CODESPACES: 'true' },
  { CODESPACES: 'true', CLAUDE_CODE_REMOTE: 'true' },
  { KIVO_WP_CONTEXT: 'devcontainer' },
  { KIVO_WP_CONTEXT: 'local' },
  { REMOTE_CONTAINERS: 'true' },
  { REMOTE_CONTAINERS: 'true', CODESPACES: 'true' },
];

test('currentSessionKind agrees with the detector sessionKind for every signal (AC-02-3)', () => {
  for (const env of SIGNALS) assert.equal(currentSessionKind(env), sessionKind(env), JSON.stringify(env));
  assert.deepEqual([...new Set(SIGNALS.map((e) => currentSessionKind(e)))].sort(), ['cloud', 'codespaces', 'devcontainer', 'local']);
});

test('a detection without runtime.session is treated as local (AC-02-4)', () => {
  assert.equal(detectionSessionKind({ runtime: { runner: 'lando' } }), 'local');
  assert.equal(detectionSessionKind(null), 'local');
  assert.equal(detectionSessionKind({ runtime: { session: { kind: 'cloud' } } }), 'cloud');
  // detector-mu-plugin prints no runtime.session: the corpus line keeps the local wording
  // even when the hook itself runs in a cloud session.
  const text = sessionStart(join(FIXTURES, 'projects', 'mu-plugin'), {
    KIVO_WISE_NO_CACHE: '1', KIVO_WISE_DETECTOR: join(FIXTURES, 'detector-mu-plugin.mjs'), CLAUDE_CODE_REMOTE: 'true',
  });
  assert.match(text, /\nrules: project AGENTS\.md first, corpus second \(~\/hekivo\/kivo-wisdom\/corpus\), web last;/);
});

test('cloud session with an existing corpus root lists only the roots on disk (AC-02-4)', () => withTmp((tmp) => {
  mkdirSync(join(tmp, 'corpus'));
  writeFileSync(join(tmp, '.docs-brain.json'), JSON.stringify({ roots: ['corpus', '/nonexistent/kivo-wisdom/corpus'] }));
  const text = sessionStart(tmp, { KIVO_WISE_NO_CACHE: '1', KIVO_WISE_DETECTOR: join(FIXTURES, 'detector-cloud-no-corpus.mjs') });
  assert.match(text, /\nrules: project AGENTS\.md first, corpus second \(corpus\), web last;/);
}));

test('the cache stores the session kind and readCache drops an entry from another kind (AC-02-3)', () => withTmp((tmp) => {
  const detection = { apps: [], runtime: { runner: 'compose', session: { kind: 'local', dockerCli: true } } };
  writeCache(tmp, detection, {});
  const stored = JSON.parse(readFileSync(join(tmp, CACHE_DIR, CACHE_FILE), 'utf8'));
  assert.equal(stored.sessionKind, 'local');
  assert.deepEqual(readCache(tmp, {}), detection);
  assert.equal(readCache(tmp, { CODESPACES: 'true' }), null);
  delete stored.sessionKind;
  writeFileSync(join(tmp, CACHE_DIR, CACHE_FILE), JSON.stringify(stored));
  assert.equal(readCache(tmp, {}), null, 'an entry without a session kind (older hook) is dropped');
}));

test('session-start runs the detector again when the session kind changed (AC-02-3)', () => withTmp((tmp) => {
  const counter = join(tmp, 'runs.log');
  const detector = join(tmp, 'counting-detector.mjs');
  writeFileSync(detector, [
    "import { appendFileSync } from 'node:fs';",
    `import { sageComposeDetection } from ${JSON.stringify(join(FIXTURES, 'sage-compose-detection.mjs'))};`,
    `appendFileSync(${JSON.stringify(counter)}, 'run\\n');`,
    "const root = (process.argv.find((a) => a.startsWith('--path=')) || '--path=.').slice(7);",
    'process.stdout.write(JSON.stringify(sageComposeDetection(root)));',
    '',
  ].join('\n'));
  const project = join(tmp, 'project');
  mkdirSync(project);
  const runs = () => (existsSync(counter) ? readFileSync(counter, 'utf8').trim().split('\n').length : 0);
  sessionStart(project, { KIVO_WISE_DETECTOR: detector });
  assert.equal(runs(), 1);
  sessionStart(project, { KIVO_WISE_DETECTOR: detector });
  assert.equal(runs(), 1, 'same kind: served from the cache');
  sessionStart(project, { KIVO_WISE_DETECTOR: detector, CODESPACES: 'true' });
  assert.equal(runs(), 2, 'a cached local detection is dropped when CODESPACES=true');
  const stored = JSON.parse(readFileSync(join(project, CACHE_DIR, CACHE_FILE), 'utf8'));
  assert.equal(stored.sessionKind, 'codespaces');
}));

test('the sage-compose context length is pinned under MAX_CONTEXT_CHARS (AC-02-1)', () => {
  const golden = JSON.parse(readFileSync(join(ROOT, 'test', 'hooks', 'session-start', 'sage-compose', 'expected-stdout.json'), 'utf8'));
  const text = sessionStart(join(FIXTURES, 'projects', 'compose'), {
    KIVO_WISE_NO_CACHE: '1', KIVO_WISE_DETECTOR: join(FIXTURES, 'detector-sage-compose.mjs'),
  });
  assert.equal(text, golden.hookSpecificOutput.additionalContext);
  assert.equal(text.length, 1073, 'a wording change in the Compose context is a visible diff');
  assert.ok(text.length <= 1500);
  const runnerLine = text.split('\n').find((l) => l.startsWith('runner: '));
  assert.equal(runnerLine, 'runner: compose · wp=bin/wp · acorn=bin/wp acorn · composer=bin/composer · node=bin/npm · test=bin/test · lint=bin/mago · cache=bin/flush · logs=bin/logs');
});

test('Lando commands rule has no project-root clause (AC-02-1)', () => {
  const text = sessionStart(join(FIXTURES, 'projects', 'mu-plugin'), {
    KIVO_WISE_NO_CACHE: '1', KIVO_WISE_DETECTOR: join(FIXTURES, 'detector-mu-plugin.mjs'),
  });
  assert.ok(!/from the project root/.test(text));
});

test('isGitignored is a literal line match (AC-02-5)', () => withTmp((tmp) => {
  assert.equal(isGitignored(tmp, 'compose.override.yaml'), false, 'no .gitignore');
  writeFileSync(join(tmp, '.gitignore'), [
    '# compose.override.yml',
    '!docker-compose.override.yml',
    '  /compose.override.yaml  ',
    '*.override.yml',
    'docker-compose.override.yml',
    '',
  ].join('\n'));
  assert.equal(isGitignored(tmp, 'compose.override.yaml'), true, 'leading slash trimmed');
  assert.equal(isGitignored(tmp, 'compose.override.yml'), false, 'comments and globs do not match');
  assert.equal(isGitignored(tmp, 'docker-compose.override.yml'), true, 'the literal line still matches after a negation line');
  assert.equal(isGitignored(tmp, 'bin/wp'), false);
}));
