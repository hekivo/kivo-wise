---
name: review-board
description: Use when a reviewer who does not work in the repository must go through the URL decisions, the template groups and the parity gaps - builds a single-file review board, helps share it, imports the reviewer's marks without overwriting someone else's decision, and files issues for the template groups marked as having problems after a dry run. For producing the data use url-inventory, template-map or parity-audit.
license: MIT
compatibility: Node 20+. Publishing the board needs a way to host a single HTML page with a small shared store; gh is needed only to file issues.
---

# Review board

A self-contained `index.html` with the template groups, the URLs to decide and the parity gaps. Marks are saved in the reviewer's browser and, when hosted with a shared store, for everyone. The marks come back into the run's files with an import.

## When to use

- The inventory (and later the parity list) is ready for someone else to review.
- A reviewer's marks must come back into the run.
- Template groups marked `issues` must become issues in a repository.
- Not for producing the data (`url-inventory`, `template-map`, `parity-audit`).

## Inputs required

1. A run with `inventory.json`; `templates.json`, `features.json` and `parity.json` when they exist.
2. Optional: a hosting option for a single HTML page with a shared store, so several reviewers see each other's marks.
3. For issues: `gh` signed in, and the repository as `<owner>/<name>`.
4. The kivo-rebuild plugin root (two levels above this skill's folder).

## Procedure

1. Build: `node <root>/scripts/board.mjs build --project=.`. It writes `.rebuild/runs/<id>/board/index.html`. The board lists the top 5,000 URLs by clicks plus every `review` row; `--max-urls=<n>` changes that, and the page says how many were left out.
2. Share it. When the session can publish a hosted page, publish the generated file with a shared store whose collections are `decisions`, `templates` and `parity`, then tell the person to share it with the reviewer with edit access. Otherwise give the person the file; marks stay in that browser, and the reviewer sends back the `marks.json` that the page's "Download marks" button produces.
3. Stop and wait for the reviewer. Nothing is imported in the same turn.
4. Import in a later message: `node <root>/scripts/board.mjs import --project=. --file=<file>`. The file is either `marks.json`, or an export of the shared store read as `{"decisions": [...], "templates": [...], "parity": [...]}`. The script prints `N changes, M conflicts`.
5. Conflicts: an incoming mark that changes or clears a `final` decision made by someone else is not applied. Each one prints as `conflict <path>: <old> by <person> vs <new> by <person>`. Report them to the owner of the decision; do not choose.
6. Issues, dry run: `node <root>/scripts/issues.mjs --project=.`. It prints the issues it would file, one per template group with status `issues` and no issue number yet. Show the list.
7. After the person approves the list, in a later message: `node <root>/scripts/issues.mjs --project=. --repo=<owner>/<name> --apply`. It creates the labels, files the issues, and records the issue numbers in `templates.json`, so a re-run files nothing twice.

## Verification

- `board/index.html` exists and opens without network access to the project.
- After an import, `node <root>/scripts/validate.mjs --project=.` passes and the reported conflicts were shown to the person.
- Before approval, `issues.mjs` ran without `--apply` and nothing exists in the repository.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `conflict /path: redirect by ana vs gone by reviewer` | Two people decided the same URL differently | Report it to the owner; the stored decision stays until they agree |
| `0 changes, 0 conflicts` after an import | The file is empty, or its paths are not in the inventory | Check the file shape and that it belongs to this run |
| `--repo=<owner/name> is required with --apply` | The repository was not named | Ask the person for it |
| `failed: <title>: ...` on `--apply` | `gh` is not signed in or has no access | Run `gh auth login`; issues filed before the failure keep their numbers |
| The board is large and slow | Many `review` rows plus the top URLs | Lower `--max-urls`, or review by template group first |

## Escalation

Filing issues writes to a shared repository: always dry run first and wait for the person's approval of the list. Ask before sharing the board outside the people the person named; it holds the site's URLs and traffic numbers.
