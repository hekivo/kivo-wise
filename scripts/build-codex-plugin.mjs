#!/usr/bin/env node
/**
 * build-codex-plugin.mjs
 *
 * Gera o layout que o Codex CLI (>= 0.137) exige, a partir da FONTE ÚNICA
 * (skills/, hooks/ e .codex-plugin/plugin.json na raiz do repo). Sem réplica
 * mantida à mão — é build, igual ao padrão de plugins multi-harness reais
 * (Anthropic commita plugins/<nome>/ com conteúdo real; EveryInc gera via
 * conversor). Symlink NÃO serve: o install do Codex copia o diretório pro
 * cache (~/.codex/plugins/cache/...) e não segue symlink.
 *
 * Gera (todos derivados, marcados como GENERATED):
 *   .agents/plugins/marketplace.json   — manifesto de marketplace (formato 0.137)
 *   plugins/kivo-wise/                 — o plugin com conteúdo REAL:
 *       .codex-plugin/plugin.json      (cópia do manifesto canônico)
 *       skills/  hooks/  AGENTS.md     (cópia do que o plugin.json declara + regras universais)
 *
 * Fonte da verdade permanece a raiz (Claude Code lê de lá). Este script só
 * espelha pro subdir que o Codex precisa.
 *
 * Uso:
 *   node scripts/build-codex-plugin.mjs           # (re)gera
 *   node scripts/build-codex-plugin.mjs --check   # CI: falha se o gerado está stale
 */

import {
  readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync, readdirSync, statSync,
} from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PLUGIN_NAME = 'kivo-wise';

const MANIFEST_SRC = resolve(ROOT, '.codex-plugin', 'plugin.json');
const PLUGIN_DIR = resolve(ROOT, 'plugins', PLUGIN_NAME);
const MARKETPLACE = resolve(ROOT, '.agents', 'plugins', 'marketplace.json');

const GENERATED_NOTE =
  'GENERATED por scripts/build-codex-plugin.mjs — NÃO edite à mão. ' +
  'Fonte: skills/ hooks/ AGENTS.md .codex-plugin/plugin.json na raiz do repo.';

// Dirs/arquivos da raiz que o plugin do Codex precisa (o que .codex-plugin/plugin.json declara).
const MIRROR = ['skills', 'hooks'];

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Constrói a árvore de saída em memória → { caminho relativo ao ROOT : conteúdo string } */
function buildArtifacts() {
  const manifest = readJson(MANIFEST_SRC);
  const version = manifest.version;
  const out = {};

  // 1. marketplace.json (formato Codex 0.137: interface + source.path subdir + policy + category)
  const marketplace = {
    name: `${PLUGIN_NAME}-marketplace`,
    interface: {
      displayName: manifest.interface?.displayName ?? 'Kivo Wise',
    },
    plugins: [
      {
        name: PLUGIN_NAME,
        version,
        source: { source: 'local', path: `./plugins/${PLUGIN_NAME}` },
        policy: { installation: 'AVAILABLE' },
        category: manifest.interface?.category ?? 'Development',
      },
    ],
  };
  out[relative(ROOT, MARKETPLACE)] = JSON.stringify(marketplace, null, 2) + '\n';

  // 2. plugin manifest (cópia) + marcador GENERATED
  out[`plugins/${PLUGIN_NAME}/.codex-plugin/plugin.json`] =
    JSON.stringify(manifest, null, 2) + '\n';
  out[`plugins/${PLUGIN_NAME}/GENERATED.md`] = `# ${GENERATED_NOTE}\n`;

  // 2b. AGENTS.md — the universal rules, hand-written at the repo root. Codex does
  // not load a plugin's own context file; it reads the PROJECT's AGENTS.md (cwd and
  // up) and ~/.codex/AGENTS.md. We mirror the root file into the plugin so Codex
  // users can copy it into their project (see README → OpenAI Codex).
  const agentsMd = readFileSync(resolve(ROOT, 'AGENTS.md'), 'utf8');
  out[`plugins/${PLUGIN_NAME}/AGENTS.md`] =
    '<!-- GENERATED from the root AGENTS.md by scripts/build-codex-plugin.mjs — do not edit by hand. -->\n\n' +
    agentsMd;

  // 3. conteúdo espelhado (skills/, hooks/) — arquivos reais
  for (const dir of MIRROR) {
    const srcDir = resolve(ROOT, dir);
    if (!existsSync(srcDir)) continue;
    for (const file of walk(srcDir)) {
      const rel = relative(ROOT, file);
      out[`plugins/${PLUGIN_NAME}/${rel}`] = readFileSync(file); // Buffer (binário-safe)
    }
  }
  return out;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

function writeAll(artifacts) {
  // limpa as saídas geradas antes de reescrever
  rmSync(PLUGIN_DIR, { recursive: true, force: true });
  rmSync(dirname(MARKETPLACE), { recursive: true, force: true });
  for (const [rel, content] of Object.entries(artifacts)) {
    const abs = resolve(ROOT, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

function check(artifacts) {
  const drift = [];
  for (const [rel, content] of Object.entries(artifacts)) {
    const abs = resolve(ROOT, rel);
    if (!existsSync(abs)) {
      drift.push(`faltando: ${rel}`);
      continue;
    }
    const cur = readFileSync(abs);
    const exp = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (!cur.equals(exp)) drift.push(`stale: ${rel}`);
  }
  // arquivos extras no gerado que não deveriam estar
  if (existsSync(PLUGIN_DIR)) {
    for (const file of walk(PLUGIN_DIR)) {
      const rel = relative(ROOT, file);
      if (!(rel in artifacts)) drift.push(`extra: ${rel}`);
    }
  }
  return drift;
}

const isCheck = process.argv.includes('--check');
const artifacts = buildArtifacts();

if (isCheck) {
  const drift = check(artifacts);
  if (drift.length) {
    console.error('Codex plugin (plugins/ + .agents/) está stale vs a fonte:\n');
    for (const d of drift.slice(0, 20)) console.error(`  - ${d}`);
    if (drift.length > 20) console.error(`  ... +${drift.length - 20}`);
    console.error('\nRode: node scripts/build-codex-plugin.mjs');
    process.exit(1);
  }
  console.log('Codex plugin gerado está em sync com a fonte.');
} else {
  writeAll(artifacts);
  const files = Object.keys(artifacts).length;
  console.log(`Codex plugin gerado: ${files} arquivos em plugins/${PLUGIN_NAME}/ + .agents/plugins/marketplace.json`);
}
