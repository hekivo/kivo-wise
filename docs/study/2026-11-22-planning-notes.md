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
