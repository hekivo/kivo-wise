// test/creator/build-creator-eval.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stage } from '../../scripts/build-creator-eval.mjs';
import { PLUGIN, readJson } from './helpers.mjs';

test('stages a copy without dependencies, with the Figma server declared and the fixtures inside evals/', () => {
  const out = stage(mkdtempSync(join(tmpdir(), 'stage-')));
  const manifest = readJson(join(out, '.claude-plugin', 'plugin.json'));
  assert.equal(manifest.dependencies, undefined);
  assert.deepEqual(readJson(join(out, '.mcp.json')), { mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } });
  assert.ok(existsSync(join(out, 'evals', 'fixtures', 'projects', 'acme-mu-plugin', '.roots-stack.json')));
  assert.deepEqual(readJson(join(PLUGIN, '.claude-plugin', 'plugin.json')).dependencies, ['kivo-wise'], 'source untouched');
  assert.ok(!existsSync(join(PLUGIN, '.mcp.json')), 'the shipped plugin declares no MCP server');
});

test('cases with Figma mocks get the recorded responses in mocks/figma/fixtures', () => {
  const out = stage(mkdtempSync(join(tmpdir(), 'stage-')));
  const fixtures = join(out, 'evals', 'figma-ingest-mocked', 'mocks', 'figma', 'fixtures');
  assert.ok(existsSync(join(fixtures, 'metadata.xml')));
  assert.ok(existsSync(join(fixtures, 'design-context-1-10.md')), 'node ids written with a dash resolve');
  if (process.platform !== 'win32') assert.ok(existsSync(join(fixtures, 'design-context-1:10.md')), 'node ids written with a colon resolve too');
  assert.ok(!existsSync(join(out, 'evals', 'figma-stops-without-mcp', 'mocks')), 'the missing-MCP case has no mocks');
});
