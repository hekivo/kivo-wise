#!/usr/bin/env node
/**
 * validate-skills.mjs — enforces the skill contract (plan contract C3).
 *
 * Rules for every skills/<name>/SKILL.md:
 *   - frontmatter keys limited to: name, description, license, compatibility,
 *     metadata, disable-model-invocation
 *   - name == folder name, kebab-case
 *   - description <= 1,024 characters, starts with "Use when", is valid plain YAML
 *     (no ": " or " #" unless quoted); a closing
 *     negative-routing sentence ("For X use Y") is recommended (warning)
 *   - exactly six H2 sections, in order: When to use, Inputs required,
 *     Procedure, Verification, Failure modes, Escalation
 *   - Failure modes holds a Symptom / Cause / Fix table
 *   - file <= 500 lines
 *   - references/**.md start with an H1 and never link into another skill's
 *     folder (references stay one hop away)
 *   - no `${CLAUDE_`, `$ARGUMENTS`, or tool names (claude, cursor, codex,
 *     copilot) in any markdown file of the skill
 *   - scripts referenced as scripts/<name>.<ext> resolve relative to the skill
 *     folder, the root or the parent of the root (project root for --root <p>/.claude); no `../` or absolute script paths
 *   - links to references/... in SKILL.md point at existing files
 *
 * third-party/<name>/SKILL.md keeps its upstream format; only name == folder
 * is checked there.
 *
 * Usage:
 *   node scripts/validate-skills.mjs                 # whole plugin, exit 1 on errors
 *   node scripts/validate-skills.mjs --only lando-wp # one or more skills; the
 *                                                     # rest is counted, not reported
 *   node scripts/validate-skills.mjs --root <dir>    # validate another tree (tests)
 *   node scripts/validate-skills.mjs --quiet         # only problems and the summary
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const ALLOWED_FRONTMATTER = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'disable-model-invocation',
]);
const REQUIRED_SECTIONS = [
  '## When to use',
  '## Inputs required',
  '## Procedure',
  '## Verification',
  '## Failure modes',
  '## Escalation',
];
const MAX_LINES = 500;
const MAX_DESCRIPTION = 1024;
const DESCRIPTION_PREFIX = 'Use when';
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_TOKENS = [
  { pattern: /\$\{CLAUDE_/g, label: '${CLAUDE_*} variable' },
  { pattern: /\$ARGUMENTS\b/g, label: '$ARGUMENTS placeholder' },
  // Project paths such as `.claude/rules/` or `.cursor/rules/` are file locations, not tool names.
  { pattern: /(?<![./\w])(claude|cursor|codex|copilot)\b(?!\/)/gi, label: 'tool name' },
];
const SCRIPT_REF = /(?:^|[\s`'"(])((?:\.\.?\/)?(?:[\w.-]+\/)*scripts\/[\w./-]+\.(?:mjs|cjs|js|sh|py))(?=$|[\s`'")\]:,;])/gm;
const REFERENCE_LINK = /\]\(((?:\.\/)?references\/[^)#\s]+)(?:#[^)]*)?\)/g;
const CROSS_SKILL_LINK = /(?:\]\(|\bskills\/)((?:\.\.\/)+)?([a-z0-9][\w-]*)\/(?:SKILL\.md|references\/|scripts\/)/g;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { root: null, only: [], quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = argv[++i];
    } else if (arg.startsWith('--root=')) {
      opts.root = arg.slice('--root='.length);
    } else if (arg === '--only') {
      opts.only.push(argv[++i]);
    } else if (arg.startsWith('--only=')) {
      opts.only.push(arg.slice('--only='.length));
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 32).join('\n'));
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (opts.only.some((name) => !name)) {
    console.error('--only needs a skill name');
    process.exit(2);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const ROOT = opts.root ? resolve(opts.root) : resolve(SCRIPT_DIR, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitLines(text) {
  return text.split(/\r?\n/);
}

/**
 * Minimal YAML subset for skill frontmatter: top-level `key: value` scalars,
 * quoted scalars, `>` / `|` block scalars (with `-` chomping) and one level of
 * nested mapping (used by `metadata:`). Returns { data, keys, error }.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { data: null, keys: [], error: 'missing YAML frontmatter' };
  const lines = splitLines(match[1]);
  const data = {};
  const keys = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      i++;
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*?))?\s*$/);
    if (!kv) {
      return { data, keys, error: `cannot parse frontmatter line ${i + 1}: "${line}"` };
    }
    const key = kv[1];
    const rest = kv[2] ?? '';
    keys.push(key);
    if (/^[>|][+-]?$/.test(rest)) {
      const fold = rest.startsWith('>');
      const block = [];
      i++;
      while (i < lines.length && (lines[i].trim() === '' || /^\s/.test(lines[i]))) {
        block.push(lines[i]);
        i++;
      }
      const stripped = block.map((l) => l.replace(/^\s+/, ''));
      data[key] = fold
        ? stripped
            .join('\n')
            .replace(/([^\n])\n(?!\n)/g, '$1 ')
            .trim()
        : stripped.join('\n').trim();
      continue;
    }
    if (rest === '') {
      const nested = {};
      i++;
      let sawChild = false;
      while (i < lines.length && (lines[i].trim() === '' || /^\s/.test(lines[i]))) {
        const child = lines[i].trim().match(/^([A-Za-z_][\w-]*):\s*(.*?)\s*$/);
        if (child) {
          nested[child[1]] = unquote(child[2]);
          sawChild = true;
        } else if (lines[i].trim() !== '') {
          return { data, keys, error: `cannot parse nested frontmatter line ${i + 1}: "${lines[i]}"` };
        }
        i++;
      }
      data[key] = sawChild ? nested : '';
      continue;
    }
    data[key] = unquote(rest);
    i++;
  }
  return { data, keys, error: null, raw: match[0] };
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function listMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** H2 headings outside fenced code blocks, in order of appearance. */
function collectH2(bodyLines) {
  const headings = [];
  let inFence = false;
  for (const line of bodyLines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^## /.test(line)) headings.push(line.trim());
  }
  return headings;
}

function sectionBody(bodyLines, heading) {
  const start = bodyLines.findIndex((l) => l.trim() === heading);
  if (start === -1) return '';
  let end = bodyLines.length;
  for (let i = start + 1; i < bodyLines.length; i++) {
    if (/^## /.test(bodyLines[i])) {
      end = i;
      break;
    }
  }
  return bodyLines.slice(start + 1, end).join('\n');
}

function findForbiddenTokens(text, file) {
  const problems = [];
  const lines = splitLines(text);
  lines.forEach((line, idx) => {
    for (const { pattern, label } of FORBIDDEN_TOKENS) {
      pattern.lastIndex = 0;
      const hit = pattern.exec(line);
      if (hit) problems.push(`${file}:${idx + 1} — ${label} "${hit[0]}" is not allowed inside skills`);
    }
  });
  return problems;
}

function firstNonEmptyLine(text) {
  return splitLines(text).find((l) => l.trim() !== '') ?? '';
}

// ---------------------------------------------------------------------------
// Skill validation
// ---------------------------------------------------------------------------

function validateSkill(skillDir, folderName) {
  const errors = [];
  const warnings = [];
  const label = `skills/${folderName}/SKILL.md`;
  const skillPath = join(skillDir, 'SKILL.md');

  if (!existsSync(skillPath)) {
    errors.push(`${label} — file not found`);
    return { errors, warnings };
  }

  const content = readFileSync(skillPath, 'utf8');
  const fm = parseFrontmatter(content);
  if (fm.error || !fm.data) {
    errors.push(`${label} — ${fm.error ?? 'missing YAML frontmatter'}`);
    return { errors, warnings };
  }

  // Frontmatter allow-list and required keys.
  for (const key of fm.keys) {
    if (!ALLOWED_FRONTMATTER.has(key)) {
      errors.push(`${label} — frontmatter key "${key}" is not allowed (allowed: ${[...ALLOWED_FRONTMATTER].join(', ')})`);
    }
  }
  const duplicates = fm.keys.filter((k, i) => fm.keys.indexOf(k) !== i);
  for (const dup of new Set(duplicates)) errors.push(`${label} — frontmatter key "${dup}" appears more than once`);

  // Single-line plain scalars: ': ' or ' #' break strict YAML parsers (error, or the value is cut at the '#').
  for (const key of ['description', 'compatibility']) {
    const raw = content.match(new RegExp(`^${key}:[ \\t]+(.+)$`, 'm'));
    const value = raw ? raw[1].trim() : '';
    if (!value || /^['"|>]/.test(value)) continue;
    if (/: /.test(value) || / #/.test(value)) {
      errors.push(`${label} — ${key} is not a valid plain YAML scalar (contains ": " or " #"); rephrase or quote it`);
    }
  }

  const name = fm.data.name;
  if (!name) {
    errors.push(`${label} — missing "name:" in frontmatter`);
  } else {
    if (name !== folderName) errors.push(`${label} — name "${name}" must equal the folder name "${folderName}"`);
    if (!NAME_PATTERN.test(name)) errors.push(`${label} — name "${name}" must be kebab-case (a-z, 0-9, hyphens)`);
  }

  const description = fm.data.description;
  if (!description) {
    errors.push(`${label} — missing "description:" in frontmatter`);
  } else {
    if (description.length > MAX_DESCRIPTION) {
      errors.push(`${label} — description is ${description.length} characters (max ${MAX_DESCRIPTION})`);
    }
    if (!description.startsWith(DESCRIPTION_PREFIX)) {
      errors.push(`${label} — description must start with "${DESCRIPTION_PREFIX}"`);
    }
    if (!/\bFor\b[^.]*\buse\b[^.]*\.?\s*$/i.test(description)) {
      warnings.push(`${label} — description should end with negative routing ("For X use Y")`);
    }
  }

  if ('disable-model-invocation' in fm.data && !['true', 'false'].includes(String(fm.data['disable-model-invocation']))) {
    errors.push(`${label} — disable-model-invocation must be true or false`);
  }

  // Size.
  const lineCount = splitLines(content).length;
  if (lineCount > MAX_LINES) errors.push(`${label} — ${lineCount} lines (max ${MAX_LINES})`);

  // Sections.
  const body = content.slice(fm.raw.length);
  const bodyLines = splitLines(body);
  const h2 = collectH2(bodyLines);
  const sameOrder = h2.length === REQUIRED_SECTIONS.length && h2.every((h, i) => h === REQUIRED_SECTIONS[i]);
  if (!sameOrder) {
    const missing = REQUIRED_SECTIONS.filter((s) => !h2.includes(s));
    const extra = h2.filter((s) => !REQUIRED_SECTIONS.includes(s));
    const parts = [];
    if (missing.length) parts.push(`missing: ${missing.join(', ')}`);
    if (extra.length) parts.push(`unexpected H2: ${extra.join(', ')}`);
    if (!missing.length && !extra.length) parts.push(`found order: ${h2.join(' > ')}`);
    errors.push(`${label} — body must have exactly these H2 sections in order: ${REQUIRED_SECTIONS.map((s) => s.slice(3)).join(' > ')} (${parts.join('; ')})`);
  }
  const failureModes = sectionBody(bodyLines, '## Failure modes');
  if (h2.includes('## Failure modes') && !/^\s*\|[^\n]*\bSymptom\b[^\n]*\|[^\n]*\bCause\b[^\n]*\|[^\n]*\bFix\b[^\n]*\|/m.test(failureModes)) {
    errors.push(`${label} — "## Failure modes" must contain a Symptom / Cause / Fix table`);
  }

  // Forbidden tokens in every markdown file of the skill.
  const markdownFiles = listMarkdownFiles(skillDir);
  for (const file of markdownFiles) {
    const rel = relative(ROOT, file).split('\\').join('/');
    errors.push(...findForbiddenTokens(readFileSync(file, 'utf8'), rel));
  }

  // references/**.md: H1 first, one hop, no cross-skill links.
  const refsDir = join(skillDir, 'references');
  const refFiles = listMarkdownFiles(refsDir);
  for (const file of refFiles) {
    const rel = relative(ROOT, file).split('\\').join('/');
    const text = readFileSync(file, 'utf8');
    if (!/^# \S/.test(firstNonEmptyLine(text))) errors.push(`${rel} — must start with an H1 title`);
    errors.push(...findCrossSkillLinks(text, rel, folderName));
  }
  errors.push(...findCrossSkillLinks(content, label, folderName));

  // SKILL.md links to references/ must exist.
  REFERENCE_LINK.lastIndex = 0;
  let link;
  while ((link = REFERENCE_LINK.exec(content)) !== null) {
    const target = join(skillDir, link[1]);
    if (!existsSync(target)) errors.push(`${label} — link target "${link[1]}" does not exist`);
  }

  // Script references.
  for (const file of [skillPath, ...refFiles]) {
    const rel = relative(ROOT, file).split('\\').join('/');
    const text = readFileSync(file, 'utf8');
    SCRIPT_REF.lastIndex = 0;
    let hit;
    const seen = new Set();
    while ((hit = SCRIPT_REF.exec(text)) !== null) {
      const ref = hit[1];
      if (seen.has(ref)) continue;
      seen.add(ref);
      if (ref.startsWith('../') || isAbsolute(ref)) {
        errors.push(`${rel} — script "${ref}" must be referenced relative to the skill folder (no "../" or absolute paths)`);
        continue;
      }
      const clean = ref.replace(/^\.\//, '');
      // Wrapper skills may point at the unmodified official scripts kept in third-party/<skill>/scripts/.
      if (/^third-party\/[\w-]+\/scripts\//.test(clean)) {
        if (!existsSync(join(ROOT, clean))) errors.push(`${rel} — script "${ref}" not found under the plugin root`);
        continue;
      }
      if (!clean.startsWith('scripts/')) {
        // e.g. "skills/other/scripts/x.mjs" or "hooks/scripts/x.mjs": outside the skill.
        errors.push(`${rel} — script "${ref}" must be referenced as scripts/<name> relative to the skill folder`);
        continue;
      }
      const inSkill = join(skillDir, clean);
      const inRoot = join(ROOT, clean);
      // Project skills validated with --root <project>/.claude may cite repository scripts.
      const inParent = join(dirname(ROOT), clean);
      if (!existsSync(inSkill) && !existsSync(inRoot) && !existsSync(inParent)) {
        errors.push(`${rel} — script "${ref}" not found in the skill folder, the root or its parent`);
      }
    }
  }

  return { errors, warnings };
}

function findCrossSkillLinks(text, label, folderName) {
  const problems = [];
  CROSS_SKILL_LINK.lastIndex = 0;
  let hit;
  while ((hit = CROSS_SKILL_LINK.exec(text)) !== null) {
    const target = hit[2];
    if (target !== folderName && target !== 'references' && target !== 'scripts') {
      problems.push(`${label} — links into another skill's folder ("${hit[0].trim()}"); references stay one hop inside this skill`);
    }
  }
  return problems;
}

function validateThirdParty(skillDir, folderName) {
  const errors = [];
  // A copy kept only as reference for a wrapper skill is stored as SKILL.upstream.md (not loaded).
  const loaded = join(skillDir, 'SKILL.md');
  const skillPath = existsSync(loaded) ? loaded : join(skillDir, 'SKILL.upstream.md');
  const label = `third-party/${folderName}/${existsSync(loaded) ? 'SKILL.md' : 'SKILL.upstream.md'}`;
  if (!existsSync(skillPath)) {
    errors.push(`${label} — file not found`);
    return { errors, warnings: [] };
  }
  const fm = parseFrontmatter(readFileSync(skillPath, 'utf8'));
  if (fm.error || !fm.data) errors.push(`${label} — ${fm.error ?? 'missing YAML frontmatter'}`);
  else if (!fm.data.name) errors.push(`${label} — missing "name:" in frontmatter`);
  else if (fm.data.name !== folderName) errors.push(`${label} — name "${fm.data.name}" must equal the folder name "${folderName}"`);
  return { errors, warnings: [] };
}

// ---------------------------------------------------------------------------
// Manifests and agents (only when present)
// ---------------------------------------------------------------------------

function validateManifests() {
  const errors = [];
  const files = [
    ['.claude-plugin/plugin.json', 'claude-plugin'],
    ['.cursor-plugin/plugin.json', 'cursor-plugin'],
    ['.codex-plugin/plugin.json', 'codex-plugin'],
    ['plugin.json', 'root'],
  ];
  const versions = [];
  for (const [rel, id] of files) {
    const full = join(ROOT, rel);
    if (!existsSync(full)) continue;
    try {
      const data = JSON.parse(readFileSync(full, 'utf8'));
      const missing = ['name', 'description', 'version'].filter((k) => !data[k]);
      if (missing.length) errors.push(`${rel} — missing fields: ${missing.join(', ')}`);
      else versions.push([id, data.version]);
    } catch (e) {
      errors.push(`${rel} — invalid JSON: ${e.message}`);
    }
  }
  const distinct = new Set(versions.map(([, v]) => v));
  if (distinct.size > 1) {
    errors.push(`Version mismatch between manifests: ${versions.map(([id, v]) => `${id}=${v}`).join(', ')}`);
  }
  return { errors, checked: versions.length };
}

function validateAgents() {
  const errors = [];
  const agentsDir = join(ROOT, 'agents');
  let checked = 0;
  if (!existsSync(agentsDir)) return { errors, checked };
  for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    checked++;
    const fm = parseFrontmatter(readFileSync(join(agentsDir, entry.name), 'utf8'));
    if (!fm.data?.name) errors.push(`agents/${entry.name} — missing "name:" in frontmatter`);
  }
  return { errors, checked };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function listSkillDirs(base) {
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();
}

const skillNames = listSkillDirs(join(ROOT, 'skills'));
const thirdPartyNames = listSkillDirs(join(ROOT, 'third-party'));

if (opts.only.length) {
  const known = new Set([...skillNames, ...thirdPartyNames]);
  const unknown = opts.only.filter((n) => !known.has(n));
  if (unknown.length) {
    console.error(`No skill named: ${unknown.join(', ')} (looked in ${relative(process.cwd(), ROOT) || '.'}/skills and third-party)`);
    process.exit(1);
  }
}

const selected = new Set(opts.only);
let totalErrors = 0;
let totalWarnings = 0;
let passed = 0;
let skipped = 0;
let skippedFailing = 0;

function report(label, result, isSelected) {
  if (!isSelected) {
    skipped++;
    if (result.errors.length) skippedFailing++;
    return;
  }
  if (result.errors.length === 0) {
    passed++;
    if (!opts.quiet) console.log(`✓ ${label}`);
  }
  for (const msg of result.errors) console.log(`✗ ${msg}`);
  for (const msg of result.warnings) console.log(`⚠ ${msg}`);
  totalErrors += result.errors.length;
  totalWarnings += result.warnings.length;
}

for (const name of skillNames) {
  const isSelected = selected.size === 0 || selected.has(name);
  report(`skills/${name}`, validateSkill(join(ROOT, 'skills', name), name), isSelected);
}
for (const name of thirdPartyNames) {
  const isSelected = selected.size === 0 || selected.has(name);
  report(`third-party/${name} (upstream format, name only)`, validateThirdParty(join(ROOT, 'third-party', name), name), isSelected);
}

if (selected.size === 0) {
  const manifests = validateManifests();
  for (const msg of manifests.errors) console.log(`✗ ${msg}`);
  totalErrors += manifests.errors.length;
  if (manifests.errors.length === 0 && manifests.checked > 0) {
    passed++;
    if (!opts.quiet) console.log(`✓ plugin manifests (${manifests.checked} files, versions agree)`);
  }

  const agents = validateAgents();
  for (const msg of agents.errors) console.log(`✗ ${msg}`);
  totalErrors += agents.errors.length;
  if (agents.errors.length === 0 && agents.checked > 0) {
    passed++;
    if (!opts.quiet) console.log(`✓ agents (${agents.checked} files)`);
  }
}

console.log(`\nSummary: ${passed} passed, ${totalWarnings} warnings, ${totalErrors} errors`);
if (skipped > 0) {
  console.log(`Skipped ${skipped} skill(s) not listed in --only; ${skippedFailing} of them currently fail the contract.`);
}
process.exit(totalErrors > 0 ? 1 : 0);
