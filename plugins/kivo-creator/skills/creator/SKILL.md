---
name: creator
description: Use when the person runs the creator command to turn a Figma frame, an HTML file or a URL into a WordPress page on the Roots stack - routes the source, runs the ingest, builds and checks the match plan, and stops for approval before anything is emitted. Resumes a run with --run=.creator/<run>. For one step on its own use html-ingest, figma-ingest, section-matching, block-scaffolding-from-design or visual-fidelity.
disable-model-invocation: true
license: MIT
compatibility: Requires the kivo-wise plugin (stack detection, runner context). Node 20+; Playwright in the target project for HTML sources and verification; the official Figma MCP server for Figma sources.
---

# /creator

Arguments: `<figma.com URL | file.html | https URL>` or `--run=.creator/<run>` to resume.

## When to use

- The person typed the command with a source or a run folder.
- Never start it on your own; the individual skills cover single steps.

## Inputs required

1. A source (Figma frame URL with `node-id`, an `.html` file or an `http(s)` URL), or an existing run folder.
2. The target stack: `.roots-stack.json` at the project root. If it is missing, run kivo-wise `/roots-detect --write` first (or ask the person).
3. The kivo-creator plugin root (two levels above this skill's folder).

## Procedure

1. **Route the source.** `figma.com/design/...` or `figma.com/file/...` → `figma-ingest`. A path ending in `.html` or an `http(s)` URL → `html-ingest`. `--run=` → skip to step 3 with that folder. Anything else: ask. There is no fallback: if the Figma MCP server is missing, stop with the instructions from `figma-ingest`.
2. **Ingest** with the routed skill. It ends with valid specs in `.creator/<run>/specs/`.
3. **Match** with `section-matching` until `node <kivo-creator>/scripts/match.mjs --run=.creator/<run> --check --project=.` passes.
4. **Stop.** Show `.creator/<run>/match-plan.md`, the gaps and any question still open, and ask the person to approve the plan. Do not emit, scaffold or edit project files in this turn.
5. After the person approves (a later message): `block-scaffolding-from-design`, then `visual-fidelity` (at most three fix rounds). Finish with the fidelity report.

## Verification

- At the stop point the working tree of the project is unchanged apart from `.creator/` (`git status`).
- `match.mjs --check` passes on the plan you show.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| No profile found | No `.roots-stack.json` and no detector output | Run kivo-wise `/roots-detect --write`, then resume with `--run=` |
| Figma tools unavailable | The Figma MCP server is not connected in this session | Stop; follow the connection steps in `figma-ingest` |
| Plan check fails | Open or invalid decisions | Finish `section-matching` before stopping |
| Files appear in the project before approval | Emit started too early | Revert them; emitting waits for approval |

## Escalation

Every run stops at the match plan for the person's approval. Ask again before emitting if the plan changed after it was approved.
