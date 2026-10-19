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
