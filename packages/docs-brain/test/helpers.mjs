import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const BIN = resolve(import.meta.dirname, '../bin/docs-brain.mjs');
export const PROJECT = resolve(import.meta.dirname, 'fixtures/project');

export function tmp(prefix = 'docs-brain-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1',
};

export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
}

/** Create a git repo with the given files on branch main; returns { dir, sha }. */
export function makeGitRepo(files) {
  const dir = tmp('docs-brain-repo-');
  git(dir, 'init', '-q', '-b', 'main');
  for (const [rel, text] of Object.entries(files)) write(join(dir, rel), text);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return { dir, sha: git(dir, 'rev-parse', 'HEAD') };
}

export function commitFiles(dir, files, remove = []) {
  for (const [rel, text] of Object.entries(files)) write(join(dir, rel), text);
  for (const rel of remove) git(dir, 'rm', '-q', rel);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'change');
  return git(dir, 'rev-parse', 'HEAD');
}

/**
 * Local HTTP server. routes: { '/path': (req, url) => ({ status, headers, body }) | { ... } }.
 * Records every request in `requests`.
 */
export async function startServer(routes) {
  const requests = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    requests.push({ method: req.method, path: url.pathname, search: url.search, headers: req.headers });
    let route = routes[url.pathname];
    if (typeof route === 'function') route = route(req, url);
    if (!route) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(route.status ?? 200, route.headers ?? { 'content-type': 'text/html' });
    res.end(req.method === 'HEAD' ? undefined : route.body ?? '');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, requests, close: () => new Promise((r) => server.close(r)) };
}

/** Run the CLI asynchronously (so an in-process server can answer). */
export function runCli(args, opts = {}) {
  return new Promise((resolvePromise) => {
    execFile('node', [BIN, ...args], { encoding: 'utf8', env: { ...process.env, ...(opts.env || {}) }, cwd: opts.cwd }, (err, stdout, stderr) => {
      resolvePromise({ code: err ? err.code ?? 1 : 0, stdout, stderr });
    });
  });
}

export function manifestYaml(sources, defaults = {}) {
  return JSON.stringify({ version: 1, corpus_dir: 'corpus', defaults: { politeness_ms: 0, ...defaults }, sources }, null, 2);
}
