#!/usr/bin/env node
/**
 * sync-codex-manifests.mjs
 *
 * Verifies (and, when run without --check, propagates) version alignment
 * between the Claude, Cursor and Codex plugin manifests.
 *
 * release-please already bumps the version field in each manifest via the
 * `extra-files` section in .release-please-config.json. This script catches
 * drift introduced by manual edits and is run in CI.
 *
 * Run manually:    node scripts/sync-codex-manifests.mjs
 * CI verification: node scripts/sync-codex-manifests.mjs --check
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SOURCE = {
  plugin: resolve(ROOT, '.claude-plugin', 'plugin.json'),
  marketplace: resolve(ROOT, '.claude-plugin', 'marketplace.json'),
};

const TARGETS = [
  {
    plugin: resolve(ROOT, '.codex-plugin', 'plugin.json'),
    marketplace: resolve(ROOT, '.codex-plugin', 'marketplace.json'),
    label: 'codex',
  },
  {
    plugin: resolve(ROOT, '.cursor-plugin', 'plugin.json'),
    marketplace: resolve(ROOT, '.cursor-plugin', 'marketplace.json'),
    label: 'cursor',
  },
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

const HAND_AUTHORED = [
  { name: 'kivo-creator', index: 1 },
  { name: 'kivo-rebuild', index: 2 },
];
const MARKETPLACES = [
  resolve(ROOT, '.claude-plugin', 'marketplace.json'),
  resolve(ROOT, '.cursor-plugin', 'marketplace.json'),
  resolve(ROOT, '.codex-plugin', 'marketplace.json'),
];

function syncHandAuthored(isCheck, drift) {
  for (const { name, index } of HAND_AUTHORED) {
    const dir = resolve(ROOT, 'plugins', name);
    const version = readJson(join(dir, '.claude-plugin', 'plugin.json')).version;
    for (const file of ['.cursor-plugin', '.codex-plugin'].map((d) => join(dir, d, 'plugin.json'))) {
      const data = readJson(file);
      if (data.version === version) continue;
      if (isCheck) drift.push(`${name}: ${file} version ${data.version} != ${version}`);
      else { data.version = version; writeJson(file, data); console.log(`Updated ${file} version to ${version}`); }
    }
    for (const file of MARKETPLACES) {
      const data = readJson(file);
      const entry = data.plugins?.[index];
      if (entry?.name !== name) { drift.push(`${file}: plugins[${index}] must be ${name} (release-please bumps $.plugins[${index}].version)`); continue; }
      if (entry.version === version) continue;
      if (isCheck) drift.push(`${file}: ${name} version ${entry.version} != ${version}`);
      else { entry.version = version; writeJson(file, data); console.log(`Updated ${file} ${name} version to ${version}`); }
    }
  }
}

function main() {
  const isCheck = process.argv.includes('--check');
  const source = readJson(SOURCE.plugin);
  const sourceMarket = readJson(SOURCE.marketplace);
  const sourceVersion = source.version;
  const sourceMarketVersion = sourceMarket.plugins?.[0]?.version;

  const drift = [];

  for (const target of TARGETS) {
    const tPlugin = readJson(target.plugin);
    const tMarket = readJson(target.marketplace);

    if (tPlugin.version !== sourceVersion) {
      if (isCheck) {
        drift.push(
          `${target.label}: plugin.json version ${tPlugin.version} != claude ${sourceVersion}`
        );
      } else {
        tPlugin.version = sourceVersion;
        writeJson(target.plugin, tPlugin);
        console.log(`Updated ${target.plugin} version to ${sourceVersion}`);
      }
    }

    if (tMarket.plugins?.[0]?.version !== sourceMarketVersion) {
      if (isCheck) {
        drift.push(
          `${target.label}: marketplace.json plugin version ${tMarket.plugins?.[0]?.version} != claude ${sourceMarketVersion}`
        );
      } else {
        tMarket.plugins[0].version = sourceMarketVersion;
        writeJson(target.marketplace, tMarket);
        console.log(`Updated ${target.marketplace} version to ${sourceMarketVersion}`);
      }
    }
  }

  syncHandAuthored(isCheck, drift);
  if (!isCheck && drift.length) { for (const d of drift) console.error(d); process.exit(1); }

  if (isCheck) {
    if (drift.length) {
      console.error('Codex/Cursor manifests are out of sync with Claude:\n');
      for (const d of drift) console.error(`  - ${d}`);
      console.error('\nRun: node scripts/sync-codex-manifests.mjs');
      process.exit(1);
    }
    console.log('Codex and Cursor manifests are in sync with Claude');
    return;
  }

  console.log('Sync complete');
}

main();
