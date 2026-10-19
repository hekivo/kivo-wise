// test/creator/figma-ref.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fetchRefs } from '../../plugins/kivo-creator/scripts/figma-ref.mjs';
import { encodePng } from '../../plugins/kivo-creator/scripts/png.mjs';
import { PLUGIN, validSpec } from './helpers.mjs';

function runWithFigmaSpec() {
  const run = mkdtempSync(join(tmpdir(), 'figref-'));
  mkdirSync(join(run, 'specs'));
  mkdirSync(join(run, 'refs'));
  const spec = { ...validSpec(), id: '02-hero', refs: {}, source: { kind: 'figma', ref: '1:10', url: 'https://www.figma.com/design/AbC123acme/Acme?node-id=1-2' } };
  writeFileSync(join(run, 'specs', '02-hero.json'), JSON.stringify(spec));
  return run;
}

const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', r));

test('downloads one PNG per Figma section and records it under refs/<id>-<width>.png', async () => {
  const png = encodePng({ width: 4, height: 2, data: Buffer.alloc(32, 200) });
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url, token: req.headers['x-figma-token'] });
    if (req.url.startsWith('/v1/images/AbC123acme')) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ err: null, images: { '1:10': `http://127.0.0.1:${server.address().port}/img/hero.png` } }));
    } else { res.setHeader('content-type', 'image/png'); res.end(png); }
  });
  await listen(server);
  try {
    const run = runWithFigmaSpec();
    const out = await fetchRefs({ runDir: run, token: 'test-token', base: `http://127.0.0.1:${server.address().port}` });
    assert.deepEqual(out, [{ spec: '02-hero', saved: 'refs/02-hero-4.png' }]);
    assert.ok(existsSync(join(run, 'refs', '02-hero-4.png')));
    assert.deepEqual(JSON.parse(readFileSync(join(run, 'specs', '02-hero.json'), 'utf8')).refs, { 4: 'refs/02-hero-4.png' });
    assert.equal(seen[0].url, '/v1/images/AbC123acme?ids=1%3A10&format=png&scale=1');
    assert.equal(seen[0].token, 'test-token');
    assert.equal(seen[1].token, undefined, 'the token is sent to the Figma API only, not to the image host');
  } finally {
    server.close();
  }
});

test('CLI without FIGMA_TOKEN exits 2 and explains, without printing any token', () => {
  const run = runWithFigmaSpec();
  const env = { ...process.env };
  delete env.FIGMA_TOKEN;
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'figma-ref.mjs'), `--run=${run}`], { encoding: 'utf8', env });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /FIGMA_TOKEN is not set/);
});

test('CLI reads the token from the environment only and never prints it, even when the API refuses', async () => {
  const secret = 'figd_fake-secret-value-0123';
  const server = createServer((req, res) => { res.statusCode = 403; res.end(JSON.stringify({ status: 403, err: 'Invalid token' })); });
  await listen(server);
  try {
    const run = runWithFigmaSpec();
    const env = { ...process.env, FIGMA_TOKEN: secret, FIGMA_API_BASE: `http://127.0.0.1:${server.address().port}` };
    const child = spawn(process.execPath, [join(PLUGIN, 'scripts', 'figma-ref.mjs'), `--run=${run}`], { env });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    const code = await new Promise((r) => child.on('close', r));
    assert.equal(code, 1);
    assert.match(output, /answered 403/);
    assert.ok(!output.includes(secret), 'the token must not appear in the output');
    const unknown = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'figma-ref.mjs'), `--run=${run}`, `--token=${secret}`], { encoding: 'utf8', env: { ...process.env, FIGMA_TOKEN: '' } });
    assert.equal(unknown.status, 1);
    assert.ok(!unknown.stderr.includes(secret), 'a token passed on the command line is refused without echoing it');
  } finally {
    server.close();
  }
});
