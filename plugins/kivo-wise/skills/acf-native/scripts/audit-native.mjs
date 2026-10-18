#!/usr/bin/env node
// Lists code that often re-implements a native WordPress / ACF mechanism.
// Every finding needs either a native replacement or a written reason.
// Read-only, zero dependencies, never throws: problems are reported in `notes`.
// Usage: node scripts/audit-native.mjs [app-path]   (default: current directory)

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const TOOL = { name: 'audit-native', version: '1.0.0' };
const EXTENSIONS = ['.php', '.js', '.mjs', '.ts', '.jsx', '.tsx'];
const SKIP_DIRS = new Set([
  'vendor', 'node_modules', 'public', 'storage', 'tests', 'test', '.git',
  'dist', 'build', 'cache', '.cache', 'coverage', 'wp', 'uploads',
]);
const MAX_FILE_BYTES = 1024 * 1024;

const CHECKS = [
  {
    id: 'editor-presavepost',
    severity: 'warning',
    title: 'editor.preSavePost: ACF already validates on publish/future through its savePost wrapper',
    pattern: /editor\.preSavePost/,
  },
  {
    id: 'custom-validation-endpoint',
    severity: 'warning',
    title: 'Custom validation/check endpoint: prefer acf/validate_value or field settings',
    pattern: /(Route::(post|get|match|any)\([^)]*(validat|publishab|check))|(register_rest_route\([^)]*(validat|publishab|check))/i,
  },
  {
    id: 'add-meta-box',
    severity: 'info',
    title: 'Meta box outside ACF: confirm a field group cannot cover it',
    pattern: /add_meta_box\(/,
  },
  {
    id: 'wp-insert-post-data',
    severity: 'info',
    title: 'wp_insert_post_data: review only if it reads ACF values (the block editor posts them in a later request)',
    pattern: /wp_insert_post_data/,
  },
  {
    id: 'save-post-handler',
    severity: 'info',
    title: 'save_post handler: if it reads ACF values, prefer acf/save_post with priority > 10',
    pattern: /add_action\(\s*['"]save_post(_[a-z0-9_-]+)?['"]/i,
  },
  {
    id: 'acf-name-filter',
    severity: 'info',
    title: 'ACF filter by name=: prefer key= (unique, not shared with other fields or plugins)',
    pattern: /acf\/(load_field|prepare_field|validate_value|update_value|format_value|load_value)\/name=/,
  },
  {
    id: 'acf-hidden-class',
    severity: 'warning',
    title: 'acf-hidden class used to hide a field: use acf/prepare_field returning false or code-managed meta',
    pattern: /acf-hidden/,
  },
  {
    id: 'meta-json-unslashed',
    severity: 'warning',
    title: 'update_post_meta with JSON: wrap the value in wp_slash()',
    pattern: /update_(post|term|user)_meta\((?![^;]*wp_slash)[^;]*(wp_)?json_encode/,
  },
  {
    id: 'admin-enqueue-acf-input',
    severity: 'info',
    title: 'admin_enqueue_scripts loading ACF-dependent assets: prefer acf/input/admin_enqueue_scripts',
    pattern: /add_action\(\s*['"]admin_enqueue_scripts['"][^;]*acf/i,
  },
];

const ACF_USAGE = /\b(acf\/[a-z_]+|get_field\(|acf_add_local_field_group|Log1x\\AcfComposer|acf\.getField)/;

function walk(dir, files, notes) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    notes.push(`Could not read directory ${dir}: ${error.message}`);
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(full, files, notes);
    } else if (entry.isFile() && EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
}

function main() {
  const notes = [];
  const findings = [];
  const root = resolve(process.argv[2] || process.cwd());
  const result = { tool: TOOL, root, findings, notes, summary: {} };

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    notes.push(`Path not found or not a directory: ${root}`);
    return result;
  }

  const files = [];
  walk(root, files, notes);
  let acfUsage = false;

  for (const file of files) {
    let text;
    try {
      if (statSync(file).size > MAX_FILE_BYTES) {
        notes.push(`Skipped large file ${relative(root, file)}`);
        continue;
      }
      text = readFileSync(file, 'utf8');
    } catch (error) {
      notes.push(`Could not read ${relative(root, file)}: ${error.message}`);
      continue;
    }
    if (!acfUsage && ACF_USAGE.test(text)) acfUsage = true;
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const check of CHECKS) {
        if (check.pattern.test(line)) {
          findings.push({
            check: check.id,
            severity: check.severity,
            title: check.title,
            file: relative(root, file),
            line: index + 1,
            text: line.trim().slice(0, 240),
          });
        }
      }
    });
  }

  result.summary = {
    filesScanned: files.length,
    findings: findings.length,
    bySeverity: findings.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }), {}),
  };
  if (files.length === 0) notes.push('No PHP/JS/TS files found under the path; pass the app path (theme, mu-plugin or project root).');
  if (!acfUsage) {
    notes.push('No ACF API usage found. If ACF is not installed (the radicle-app default), the WordPress-hook findings still apply.');
  }
  notes.push('Each finding needs a native replacement or a written reason (issue/PR "Native APIs used" and a code comment).');
  return result;
}

let output;
try {
  output = main();
} catch (error) {
  output = { tool: TOOL, findings: [], notes: [`Unexpected error: ${error.message}`] };
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
