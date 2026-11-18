#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/issues.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { latestRun, readDoc, runDir, writeDoc } from './lib/state.mjs';

export function issueDrafts({ templates }) {
  return templates.items.filter((t) => t.status === 'issues' && !t.issue).map((t) => ({
    key: `template:${t.group}`,
    title: `Front-end review: ${t.label}`,
    labels: ['frontend-review', `template:${t.group}`],
    body: [`Template: \`${t.template}\` (${t.count} URLs, ${t.clicks ?? 0} clicks)`, '', '**Reviewer note**', '', t.note ?? '', '', '**Samples**', '', ...(t.samples ?? []).map((s) => `- ${s}`), '', 'Add the viewport, a screenshot and live vs new for each problem.'].join('\n'),
  }));
}

const gh = (args) => spawnSync('gh', args, { encoding: 'utf8' });
const ghError = (r) => (r.error ? r.error.message : (r.stderr ?? '').trim());

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', repo: '', apply: false });
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: run map-templates.mjs first');
  const file = join(runDir(o.project, runId), 'templates.json');
  const templates = readDoc(file);
  if (!templates) throw new Error(`${file} not found: run map-templates.mjs and review the templates first`);
  const drafts = issueDrafts({ templates });
  if (!o.apply) {
    console.log(`DRY RUN: ${drafts.length} issues for ${o.repo || '<repo>'}`);
    for (const d of drafts) console.log(`\n# ${d.title}\nlabels: ${d.labels.join(', ')}\n${d.body}`);
    return;
  }
  if (!o.repo) throw new Error('--repo=<owner/name> is required with --apply');
  if (!drafts.length) { console.log('nothing to file'); return; }
  const tmp = mkdtempSync(join(tmpdir(), 'rebuild-issue-'));
  const labelled = new Set();
  let filed = 0;
  try {
    for (const d of drafts) {
      for (const l of d.labels.filter((x) => !labelled.has(x))) {
        gh(['label', 'create', l, '--repo', o.repo, '--force']);
        labelled.add(l);
      }
      const bodyFile = join(tmp, 'body.md');
      writeFileSync(bodyFile, d.body);
      const r = gh(['issue', 'create', '--repo', o.repo, '--title', d.title, '--body-file', bodyFile, ...d.labels.flatMap((l) => ['--label', l])]);
      const number = r.status === 0 ? Number(/\/issues\/(\d+)\s*$/.exec(r.stdout ?? '')?.[1]) : NaN;
      if (!Number.isInteger(number)) {
        console.error(`failed: ${d.title}: ${ghError(r) || 'no issue URL in the output'}`);
        process.exitCode = 1;
        break;
      }
      templates.items.find((t) => `template:${t.group}` === d.key).issue = number;
      filed += 1;
      console.log(`#${number} ${d.title}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    if (filed) {
      const { schema_version, kind, run_id, generated_at, ...body } = templates;
      writeDoc(file, 'templates', body, { runId });
    }
  }
}

runCli(import.meta.url, main);
