# Planning notes — Compose `bin/` runner support (2026-11-22)

This planning session ran without the owner in the loop. These notes record the impediments and the
improvements it found, in kivo-kion and in kivo-wise.

## Impediments

1. **The kion pivot gate rejects a spec draft that has proposals.** `kion validate` reports 10 errors
   (`the spec was started before this pivot question was answered`), because the spec path was
   registered while pivot questions were still open. That is by design: the brief asked for a draft
   with non-decided choices marked Proposal. The errors stay until the pivots are answered. No section
   was approved.
2. **The generic seed questions do not fit a tooling change.** `kion init --stack generic` seeds
   Q-001..Q-007 (data cloning, legacy ids, integration contracts). They are written for a system
   rewrite. Q-002 and Q-003 do not apply to a plugin feature. They are left open, not dropped, because
   dropping them is the owner's call.
3. **No legacy path.** Without `--legacy`, `kion probe --store` and the inventory agents do not apply.
   The Lando inventory was built by hand with `grep` and stored through `kion add inventory`.
4. **The parallel wp-kit work is not merged yet.** The wp-kit `feat/docker-dev-environment` branch has
   no Compose files or `bin/` scripts yet. Service names, script names and in-container behaviour are
   therefore fact questions (Q-023, Q-024), not facts. The only existing reference is the older
   `templates/.devcontainer/docker-compose.yml.hbs` (services `app`, `web`, `db`, `redis`).
5. **Record paths differ from the repository's existing layout.** kion defaults to `docs/specs` and
   `docs/plans`. kivo-wise keeps its design records under `docs/superpowers/specs` and `docs/plans`.
   The brief named `docs/specs`, so the default was kept. The owner may want `paths.specs` moved.

## Improvements found

### kivo-kion

- A `--draft` or "proposal" mode for `kion spec path` would let a planner write a spec with marked
  proposals without tripping the pivot gate. It would keep the gate for approval only.
- A `tooling` (or `plugin`) stack adapter with seed questions about runner contracts, release
  versioning and backward compatibility would fit this kind of work better than `generic`.
- `kion add inventory` could accept a grep-style import (path:line list), so a hand inventory does not
  need hand-written JSON.

### kivo-wise

- The `.roots-stack.json` `runner` key never overrides detection. It only warns on drift
  (`scripts/detect-roots-project.mjs:775`), and `roots-triage` does not say so clearly.
- The detector warns about only one Landofile defect (`env_file` under `config:`). The
  `wordpress-recipe.md` reference already says `cache:` under `config:` is ignored, but nothing warns about
  it. The wp-kit Lando template has that key, which is harmless there only because a separate `cache`
  service exists.
- `wordpress-recipe.md:14` lists `mysql:8.4` as valid. The parallel work shows it does not start with the
  installed recipe (`expire_logs_days`).
- The skill validator rejects tool names in skill markdown. The new skill must describe cloud agent
  sessions and editor devcontainers generically.
- `docs/guide/troubleshooting.md` already documents that Lando's mount breaks on Docker Engine 28+, a
  concrete reason for the move. It belongs in the migration guide.
- 462 `{{runner.*}}` placeholders are already runner-neutral. Most of the skill work is the preamble
  sentence "On Lando they default to …" and the router, not the procedures.

## Second pass: surveys, spec revision and review (2026-11-22)

The owner answered the 20 decisions on the decisions board. This pass answered the seven facts by
reading, revised the spec, registered decisions per section and reviewed every section by hand. No
section is approved.

### Impediments

1. **Survey evidence has no field of its own.** `survey` accepts only `reads`, `where`, `production` and
   `result` (kion `schemas/question.schema.json`); an `evidence` list is refused as an unknown field. The
   sources were appended to `where`, which mixes "what was read" with "what proves it".
2. **A fact answered by a design in another repository is not a fact of this one.** Q-023 and Q-024
   are answered by the parallel wp-kit decisions (D-022, D-009), but kion cannot reference a decision of
   another `.kion/` store, so the citation is free text ("wp-kit D-022").
3. **Facts that need a live cloud run cannot be closed by reading.** Q-021, Q-022 and Q-026 are answered
   from documentation and marked "documented; cloud probe pending". kion has no state between open and
   answered for that, so the caveat lives in the result text, and the probe
   (`dev/probes/environment-probe.sh`) is the follow-up.
4. **A survey can invalidate the premise of an answered decision.** Survey Q-026 found that hosted cloud
   sessions do not add marketplaces declared in repository settings, which is the mechanism of D-015.
   kion has no "decision premise invalidated" signal, so a new owner question (Q-028) was added; D-015
   stays active for developer machines, Codespaces and devcontainers.
5. **The review runs without a stack reviewer.** The adapter reviewer is a convention reviewer for
   projects on the stack, not for the plugin itself, so every section was reviewed against the detector,
   hooks, skills and tests by hand. One reviewer reading its own spec is a weak check.

### Improvements found

#### kivo-kion

- Add `survey.evidence` (list of path:line or URL) so sources stop riding inside `where`.
- Add a `pending-probe` fact state (or `survey.confirmed: false`) for facts answered from documentation
  that a live run must confirm; `kion next` could list them before approval.
- Let a fact or decision cite a decision of a sibling store (for example `wp-kit:D-022`), validated when
  the sibling path is configured.
- `kion spec review` could accept a batch file of findings with verdicts, so a manual review is one call.

#### kivo-wise

- `parseYamlSubset` loses a whole file on the first YAML anchor and returns flow maps as strings. Compose
  files use anchors often, so the Compose branch needs the narrow anchor rules written into S-2.
- The detector cache (`hooks/lib.mjs`) keys only on root and age. Any environment-dependent field needs
  the signal in the cache key.
- The Landofile ignored-key check must be a denylist: the wordpress builder reads undocumented `config`
  keys (`build`, `build_root`, `run_root`, `composer`).
- kivo-creator reads `flag.runner` before the detector result; once the detector owns the override it
  should read the detector.
- The rules line prints configured corpus roots without checking that they exist.

#### wp-kit (requests, raised in the wp-kit plan)

- Contract marker `x-kivo-wp` with `contract: <n>` in `compose.yaml` as a block map.
- `containerEnv.KIVO_WP_CONTEXT=devcontainer`, because `REMOTE_CONTAINERS` is set by one editor only.
- The devcontainer Node.js feature: the devcontainer base image has no Node.js and the hooks need 20+.
- Allowlist hosts missing from the cloud default: `wpackagist.org`, `api.wordpress.org`,
  `downloads.wordpress.org`, `pkg-containers.githubusercontent.com`, `connect.advancedcustomfields.com`.
- `.kivo-wise/` in the generated `.gitignore`.
- The Lando template's `cache:` key under `config:` is ignored by the recipe (backport rule).

#### Observed in passing

- The local probe run shows Docker Engine 29 next to Lando v3.26.9, the combination
  `docs/guide/troubleshooting.md` records as breaking Lando's mount. Worth confirming on the machines
  that still run Lando before the migration guide cites it.
- The MySQL 8.4 failure is version-specific: upstream `lando/wordpress` main already fixed the default
  `mysql8.cnf`, so the detector warning checks the installed recipe file instead of the tag alone.
