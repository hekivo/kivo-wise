# Plan — kivo-wp Compose contract 2

Spec: `docs/specs/2026-11-23-kivo-wise-compose-contract-2-design.md` (C2-1 to C2-6). Behaviour approved
in wp-kit (D-057); no new kivo-wise decision is needed. Delivery rules of the runner plan apply
(`docs/plans/2026-11-22-compose-runner/plan.md`): one complete pull request per component, the Codex
mirror regenerated, versions bumped by release-please only.

| Id | Component | Depends | Spec |
|---|---|---|---|
| 04 | Contract 2 detection, session line, skills and tests | runner plan 01 to 03 (merged) | C2-2 to C2-5 |

One component: the detector field, the session line and the skill text describe the same contract, and
a skill that names `runtime.compose.router` before the detector writes it would be wrong in between.

## Component 04 — steps and acceptance criteria

1. **Detection** (`scripts/detect-roots-project.mjs`, triage schema and `output-fields.md`).
   - AC-04-1: the `compose-router` fixture gives contract `{ kivo-wp, 2 }`, services `php`/`web` = `app`,
     `database` = `db`, `cache`, `node`, `mail`, `proxy` = `null`, and
     `router = { container: "kivo-wp-router", network: "kivo-wp", networkDeclared: true }`, with no
     "unknown kivo-wp contract" note.
   - AC-04-2: contract 2 with a `proxy` service ignores it with the C2-2 note; without the `kivo-wp`
     network, `networkDeclared` is false with its note.
   - AC-04-3: every existing fixture keeps its output except the new `router: null`; the schema test
     validates both fixtures.
2. **Session context** (`hooks/session-start.mjs`).
   - AC-04-4: the `compose:` line of C2-3 for contract 1 and 2, none without a contract or on Lando;
     goldens `sage-compose` (contract 1) and `sage-compose-router` (contract 2) stay under 1,500
     characters.
3. **Skills** (C2-4 table), then `scripts/build-codex-plugin.mjs`.
   - AC-04-5: `compose-wp` and its references describe both contracts; "picks a free port" appears only
     under contract 1; `bin/router`, `lando poweroff`, DNS rebinding and `KIVO_WP_HOST` appear for
     contract 2; `testing-wp` and `tailwind-vite-assets` give the router host names without a port.
   - AC-04-6: `validate-skills` (root and both plugins), the Codex mirror check and the full test suite
     are green; a contract 2 prompt routes to `compose-wp` in the offline routing review.
4. **Study note** in `docs/study/` with times, CI failures and impediments.

Exit: the pull request merged through the queue; release-please's release pull request reports the
minor version, left for the owner.
