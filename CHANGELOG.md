# Changelog

## [3.0.0](https://github.com/hekivo/kivo-wise/compare/superpowers-sage-v2.11.1...kivo-wise-v3.0.0) (2026-10-18)

### ⚠ BREAKING CHANGES

* **rename:** the plugin and the repository are now `kivo-wise` (`hekivo/kivo-wise`); install with `claude plugin marketplace add hekivo/kivo-wise` and `claude plugin install kivo-wise@kivo-wise`. The `superpowers-sage` name, marketplace and `superpowers-sage:` skill/agent prefixes are gone.
* **manifests:** the duplicated root `plugin.json` and the stale root `hooks.json` were removed; `.claude-plugin/plugin.json` and `hooks/hooks.json` are the only sources. The plugin-root `CLAUDE.md` became `AGENTS.md` (hand-written; mirrored into `plugins/kivo-wise/` for Codex).
* **detector:** `scripts/detect-sage-project.mjs` is replaced by `scripts/detect-roots-project.mjs`, which classifies the site layout (`radicle`, `bedrock`, `composer-wordpress`, `plain-wordpress`), every Acorn app (`sage-theme`, `acorn-theme`, `acorn-mu-plugin`, `acorn-plugin`, `radicle-app`) and the Lando runtime, and honours a `.roots-stack.json` flag. The old script remains as a deprecated shim with a different JSON shape.
* **hooks:** rewritten in Node (stdin JSON in, JSON out) with profile-aware protected files; the bash hooks and `hooks/lib.sh` are removed.
* **skills:** consolidated into profile-aware skills (Sage theme / Acorn mu-plugin / Radicle); design-tool, forms and migration skills and agents are removed.
* **skills:** `sageing` is removed. Its routing map is superseded by `roots-router` (profile x intent routing, `references/routing.json`, `references/keywords.json`, `references/decision-tree.md`). Its design-tool routing and MCP query patterns are not carried over; skills that still link to `sageing/references/mcp-query-patterns.md` are rewritten in the skill consolidation phase.
* **skills:** `scripts/validate-skills.mjs` enforces the new skill contract (frontmatter allow-list, name equal to folder, "Use when" descriptions, six sections, 500-line cap, no tool names). Existing skills fail it until they are consolidated; CI runs it on the whole tree.
* **agent eval notes** moved from `agents/__evals__/` to `evals/agents/`.

### Features

* **skills:** add `roots-router`, `roots-triage` (with `references/triage.schema.json`) and `lando-wp`.
* `docs-brain` CLI and the `kivo-wisdom` corpus for versioned official documentation.
* **scripts:** add `scripts/sync-project-skills.mjs` (`--to <dir>`, default `.agents/skills`; `--include-gpl`; `--check`). It copies the plugin skills into a project for Cursor, Codex and Copilot, writes a `GENERATED.md` (plugin version, date, skill and file lists), exits 1 on drift in `--check` and never deletes files the target's `GENERATED.md` does not list. Covered by `test/sync-project-skills.test.mjs`.
* **third-party:** the manifest loads `third-party/` (official WordPress agent skills, GPL-2.0-or-later) next to `skills/`; the folders stay separate to keep the licence boundary, and the sync script skips them unless `--include-gpl` is passed.

### Bug Fixes

* **hooks:** the SessionStart context carries a `commands:` line that tells the agent to write every wp/acorn/composer/node/test command exactly as on the runner line (with an example from the detected runner) and to label CI/deploy commands separately; it replaces the weaker "never run … outside the runner" clause.
* **hooks:** the prompt router lets a `_triage` skill (roots-debugging) win a multi-match, so "Livewire errors since the deploy" opens debugging first; roots-debugging gets deploy-staleness keywords and triggers.
* **skills:** fixes from the eval run: runner-filled commands and labelled deploy commands in the Procedure of the building skills; acf-native detects ACF first and solves the no-ACF case with `register_post_meta` and `rest_pre_insert_{post_type}`; roots-debugging is read-only on shared environments and reports in the Evidence / Root cause / Fix / Prevention shape; tailwind-vite-assets gives the two-key plugin manifest and a `Vite::asset()` check; wp-performance and wp-phpstan resolve `third-party/` paths from the plugin root; the auditor, Livewire and architect agents get stricter report formats.
* **skills:** descriptions rewritten from a Jev routing review (`dev/jev-review/`): about 30% shorter (always-on cost ~7,280 to ~5,810 tokens), every one valid plain YAML (the old `acorn-livewire` description was cut at ` #[Locked]` by strict parsers), Livewire errors after a deploy routed to roots-debugging, roots-router limited to choosing between skills, and tailwind-vite-assets no longer points to the removed `wp-block-native`. `validate-skills.mjs` rejects `: ` and ` #` in unquoted descriptions. The keyword router has fewer wrong hints (`acf field`, `migration` and `object cache` removed, specific phrases added).

### Documentation

* **readme, docs:** README rewritten for 3.0 (profiles, install, what loads, docs brain, other assistants, development, upgrade notes). The Docsify guide describes only the shipped skills, agents, commands and hooks; the how-to and workflow pages for removed features are deleted, and the superpowers-sage history documents carry a "historical" note.

## [2.11.1](https://github.com/hekivo/superpowers-sage/compare/superpowers-sage-v2.11.0...superpowers-sage-v2.11.1) (2026-06-08)


### Bug Fixes

* deliver house conventions cross-harness via AGENTS.md + fix dropped session-start context ([db58c9d](https://github.com/hekivo/superpowers-sage/commit/db58c9d568c176824f85ce538c65fb6eeee90e70))
* deliver house conventions cross-harness via AGENTS.md + fix dropped session-start context ([dc7712c](https://github.com/hekivo/superpowers-sage/commit/dc7712cab5a9ec5fd19d3d6cbfc3161d0c877855))

## [2.11.0](https://github.com/hekivo/superpowers-sage/compare/superpowers-sage-v2.10.0...superpowers-sage-v2.11.0) (2026-06-05)


### Features

* **codex:** generate plugins/ + .agents/ layout for Codex CLI &gt;= 0.137 ([db2f631](https://github.com/hekivo/superpowers-sage/commit/db2f631cc060bdc912acaed57f909ae156a20a8b))


### Bug Fixes

* **codex:** generate plugins/ + .agents/ layout for Codex CLI ≥ 0.137 ([61dd59b](https://github.com/hekivo/superpowers-sage/commit/61dd59b838ba967b50ef919e12cda52e20920099))
* correct claude plugin install command (marketplace suffix) ([f76c1a9](https://github.com/hekivo/superpowers-sage/commit/f76c1a9fa3ef850abb1c0aa929ef69bf77464915))

## [2.10.0](https://github.com/hekivo/superpowers-sage/compare/superpowers-sage-v2.9.0...superpowers-sage-v2.10.0) (2026-05-28)


### Features

* **hooks:** expand skill-router keyword map with workflow skills ([a070f05](https://github.com/hekivo/superpowers-sage/commit/a070f05f7b6ffd2e9c2441d5a46b087ea407c092))


### Performance

* **hooks:** replace full sageing injection with compact routing summary ([5b318b4](https://github.com/hekivo/superpowers-sage/commit/5b318b4c361be546ccce075ae0dcd241acd67150))


### Documentation

* add Docsify site for GitHub Pages ([af0b4a9](https://github.com/hekivo/superpowers-sage/commit/af0b4a9644fa76703e375db0dd2fa4fd145f1923))
* add GitHub Pages link to README ([858406f](https://github.com/hekivo/superpowers-sage/commit/858406ff672847bf26f8cff8e855e6638f3d2532))
* add token optimization changelog entry for upcoming release ([d175c7f](https://github.com/hekivo/superpowers-sage/commit/d175c7f8d4aa46618b63f649eda7f77305c21da3))
* add usage guide design spec ([b1b99d6](https://github.com/hekivo/superpowers-sage/commit/b1b99d61e5eca38d90216a2068ab50ae67a1399a))
* add usage guide implementation plan (10 tasks) ([ed868f9](https://github.com/hekivo/superpowers-sage/commit/ed868f9a27348e78f8760cff6d464ca430be1efe))
* **guide:** add agents.md — all 11 agents including 5 previously undocumented ([47dd392](https://github.com/hekivo/superpowers-sage/commit/47dd392318276d85d8ef046ad013dab4830528e3))
* **guide:** add commands.md — acf-register, livewire-new, sage-status ([8e92dc3](https://github.com/hekivo/superpowers-sage/commit/8e92dc30371e7f6352beb6ca6d24ebe6334b57f5))
* **guide:** add hooks.md — session-start, keyword router (32 entries), diagnostics ([52e072c](https://github.com/hekivo/superpowers-sage/commit/52e072cd404d314b3b612ebfa4624ef555409ac4))
* **guide:** add INDEX.md navigation hub ([dc94e59](https://github.com/hekivo/superpowers-sage/commit/dc94e59686ffdfa75c2d800c3bd82d6775e16047))
* **guide:** add skills.md — all 19 workflow + 17 reference skills ([23227eb](https://github.com/hekivo/superpowers-sage/commit/23227eb6ca289830d0f70ede15472e10ba205f09))
* **guide:** add token-efficiency.md — mechanism, before/after, contributor guide ([9866d93](https://github.com/hekivo/superpowers-sage/commit/9866d93842a9182579fe3354f28f0c7dd6a4b825))
* **guide:** add workflows/first-session.md ([7324b5f](https://github.com/hekivo/superpowers-sage/commit/7324b5fdeaf33d9f5fe727364fcb489cfed80c84))
* **guide:** add workflows/implement-feature.md — full plan-driven loop ([6da2de0](https://github.com/hekivo/superpowers-sage/commit/6da2de0f329d3c36e26cc0b21dd9638460cdafd4))
* **guide:** add workflows/scaffold-block.md — scaffold, form integration, refactoring ([00b023e](https://github.com/hekivo/superpowers-sage/commit/00b023e4a3fb43201d10c6c9b53fa0ad64ab1e40))
* **skills:** add Invoke-for triggers to domain reference skills ([f1a6e91](https://github.com/hekivo/superpowers-sage/commit/f1a6e9110b809c0e08e1da46e77dfbc9ab2b19cd))
* **skills:** add Invoke/Skip triggers to workflow skill descriptions ([8e39f37](https://github.com/hekivo/superpowers-sage/commit/8e39f379f665378080165913b8234003f292d3fe))
* **skills:** tighten sageing description — remove always-on trigger ([e761efe](https://github.com/hekivo/superpowers-sage/commit/e761efe77d7e079ac5a1e5b855f7a1a2ae88a5cd))
* slim README to intro+install+links, move detail to docs/guide/ ([a770346](https://github.com/hekivo/superpowers-sage/commit/a770346db3823ba04010f4b1c9e356ee049cd22c))

## [Unreleased]

### Performance

* **hooks/session-start.sh**: Replace full `sageing` SKILL.md injection (270 lines, 18k chars)
  with a compact 20-line routing table. Reduces session-start token cost by ~93%
  (18.622 chars → ~1.284 chars per session).
* **hooks/user-prompt-activate.sh**: Expand keyword router from 15 to 32 entries, adding
  all workflow skills (reviewing, debugging, building, onboarding, architecture-discovery,
  plan-generator, designing, verifying, migrating, sage-design-system, block-scaffolding,
  block-refactoring, sageing, ai-setup, abilities-authoring) and domain reference skills
  (wp-capabilities, wp-security, wp-performance, wp-hooks-lifecycle, wp-cli-ops,
  sage-forms, wp-block-native). Verified with 13-case test suite: all passing.

### Docs

* **skills/sageing**: Remove "read this first in any Sage/Acorn project session" from
  description — prevents reflexive double-loading (hook + Skill tool) every session.
  Skill now activates on-demand for full architectural preferences and design tool routing.
* **skills/reviewing, debugging, onboarding, building**: Add explicit `Invoke for:` and
  `Skip when:` clauses to reduce false-positive loading from adjacent keyword matches.
* **skills/wp-capabilities, wp-security, wp-performance, wp-hooks-lifecycle, sage-forms**:
  Add `Invoke for:` with specific technical triggers.

## [2.9.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v2.8.0...superpowers-sage-v2.9.0) (2026-05-07)


### Features

* **plugin:** add OpenAI Codex plugin support ([#43](https://github.com/codigodoleo/superpowers-sage/issues/43)) ([8817c2b](https://github.com/codigodoleo/superpowers-sage/commit/8817c2bc78b03c0ea23e724d353ffadc2c8a95e5))

## [2.8.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v2.7.0...superpowers-sage-v2.8.0) (2026-04-21)


### Features

* **agents:** add forms specialist agent ([62356ba](https://github.com/codigodoleo/superpowers-sage/commit/62356ba262280b5f06a8c0850339d365c2420148))
* **skills:** add Lando runner detection to onboarding ([d61a3a1](https://github.com/codigodoleo/superpowers-sage/commit/d61a3a13f6550df84f61b81ae7e30d442ca18a8f))
* **skills:** add Phase 0c form detection to block-scaffolding ([5810a60](https://github.com/codigodoleo/superpowers-sage/commit/5810a60c8f38b45c25b60af50eb1719c74caad20))
* **skills:** add sage-forms Blade form views reference ([83ff947](https://github.com/codigodoleo/superpowers-sage/commit/83ff947f3e2085c89327cf8bc055089e0fb47835))
* **skills:** add sage-forms hf-validation JS module reference ([0ae855e](https://github.com/codigodoleo/superpowers-sage/commit/0ae855eb200e1db440e8737f918855245ecb2f7e))
* **skills:** add sage-forms installation reference ([f166d56](https://github.com/codigodoleo/superpowers-sage/commit/f166d56d7a5b400e5b48f7abae8e0596778e5389))
* **skills:** add sage-forms SKILL.md entry point ([c0b1f91](https://github.com/codigodoleo/superpowers-sage/commit/c0b1f910955158023cf8715c85b62c6195eb177d))
* **skills:** add sage-forms traps catalogue ([8633286](https://github.com/codigodoleo/superpowers-sage/commit/863328604dd6e18bb15cd96bbf70693428120721))
* **skills:** Cluster A — Lando runner detection + CSS cascade specialist ([5731526](https://github.com/codigodoleo/superpowers-sage/commit/57315268baa12e301f7a99ca54f03f35ad860ce8))
* **skills:** G10 CSS specialist + Phase 7 single approval gate in block-refactoring ([283cda5](https://github.com/codigodoleo/superpowers-sage/commit/283cda5888df6253a888ee9d101f7f5b9c60e7e9))
* **skills:** sage-forms integration — skill + forms agent + block-scaffolding Phase 0c ([b2b400f](https://github.com/codigodoleo/superpowers-sage/commit/b2b400f63fd911a43de8921158e012eabcf959cc))
* **skills:** spec-driven CSS cascade in block-scaffolding Phase 0b + S1 ([2f54c33](https://github.com/codigodoleo/superpowers-sage/commit/2f54c3335e80507d0210663ff1d27ddd81659a34))


### Bug Fixes

* **agents:** address code review findings in forms agent (rollback, grep precision, A5 scoping) ([89c5835](https://github.com/codigodoleo/superpowers-sage/commit/89c5835585c6b03277d99a4bd2e29862077da25a))
* **skills:** add observable symptoms to sage-forms Traps bullets ([fe4d8d3](https://github.com/codigodoleo/superpowers-sage/commit/fe4d8d36674fda2bf9e9071a3b5745faaecc5c7d))
* **skills:** address code review findings in block-scaffolding S1 ([73bb3ba](https://github.com/codigodoleo/superpowers-sage/commit/73bb3bada8dc9518a602e617bfa23266fa71f06c))
* **skills:** align G10 decision table phrasing and clarify report template ([4666ae7](https://github.com/codigodoleo/superpowers-sage/commit/4666ae729375adebfa65cd84a2615a57d45da831))
* **skills:** align G10 light row CSS action with block-scaffolding ([61cb131](https://github.com/codigodoleo/superpowers-sage/commit/61cb131f849e8a0d684adf06b47fa43062cfcc0e))
* **skills:** clarify lando.yml read failure fallback in runner detection ([bf85029](https://github.com/codigodoleo/superpowers-sage/commit/bf85029a7a629db7b0a5e512fe420c4cf30cc586))


### Documentation

* **plans:** add Cluster A implementation plan — worktrees detection & CSS cascade ([f9c786d](https://github.com/codigodoleo/superpowers-sage/commit/f9c786d845622449c639d8e3224fd2dda22200a7))
* **plans:** add sage-forms integration implementation plan ([9ce7c6e](https://github.com/codigodoleo/superpowers-sage/commit/9ce7c6e531597784a3cf26c048bb01a692372993))
* **readme:** update Cursor installation for modern versions + note on Claude CLI superiority ([7d69e2b](https://github.com/codigodoleo/superpowers-sage/commit/7d69e2bc513809eaa7ef4dbf8f8a4ff42113c35e))
* **specs:** add Cluster A spec — worktrees detection & CSS cascade generation ([c750f87](https://github.com/codigodoleo/superpowers-sage/commit/c750f8715cf640c17dac4098d0af56484be08112))
* **specs:** add sage-forms integration design ([e955a62](https://github.com/codigodoleo/superpowers-sage/commit/e955a6202e273ec26a0f4833b4b5c74f58f1b042))

## [2.7.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v2.6.0...superpowers-sage-v2.7.0) (2026-04-20)


### Features

* **block-refactoring:** extend G8 to cover slug/filenames, add G9/G10/G11 definitions ([e88518e](https://github.com/codigodoleo/superpowers-sage/commit/e88518eef8404c17427684636f121f831d798923))


### Bug Fixes

* **ai-setup:** separate composer commands by layer + Bedrock autoloader stub gotcha ([c249ede](https://github.com/codigodoleo/superpowers-sage/commit/c249ede08abbface263e3de7ecb14696820b0029))

## [2.6.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v2.5.0...superpowers-sage-v2.6.0) (2026-04-19)


### Features

* **acorn-migration:** add Phase 4 — ACF two-level key migration + second pass + positional args ([30bc024](https://github.com/codigodoleo/superpowers-sage/commit/30bc02460098ad81132445fd87637e69e2b9ab7c))
* **block-refactoring:** add Phase 0b shared component inventory before gap checks ([18a9723](https://github.com/codigodoleo/superpowers-sage/commit/18a972328fe4cf7ee7d2e929e701eb6a4ea8a84b))
* **block-refactoring:** G7 -&gt; CRITICAL, add Decision Log to report, add localization reference ([945cf55](https://github.com/codigodoleo/superpowers-sage/commit/945cf55554a7d8faab1a6b9a6adc1c6c3986b27a))
* **sage-lando:** add load_textdomain gotcha and ACF getName/getDescription/getStyles i18n pattern ([9591430](https://github.com/codigodoleo/superpowers-sage/commit/95914305586bfbe42c21dd61e6d2b2c86c6d00b1))
* **sage-reviewer:** add R-css-vars, R-component-reuse, R-nl2br convention checks ([ff63de6](https://github.com/codigodoleo/superpowers-sage/commit/ff63de66ac4a0f8d9092e31af15007ce4d71b731))


### Bug Fixes

* **acorn-migration:** remove redundant NOT LIKE clause in Phase 4 PASS 1 query ([d377a48](https://github.com/codigodoleo/superpowers-sage/commit/d377a48e259c3fc85efb2d9f6430cb3daefe3597))
* **skills:** add G9/G10/G11 gap checks to block-refactoring, block-scaffolding, sage-reviewer ([0c2d520](https://github.com/codigodoleo/superpowers-sage/commit/0c2d52038d9c2b9ab472994bf93eca2e2b20d605))


### Documentation

* **plans:** add plugin expansion wave plans (index + onda 1 full + 2-6 scoped) ([4d2a736](https://github.com/codigodoleo/superpowers-sage/commit/4d2a7365a3b155ab203ae8e3d6e4fe893dbdff67))
* **plans:** mark Onda 6 Done in index ([3bdff96](https://github.com/codigodoleo/superpowers-sage/commit/3bdff96482bc616597e88d358599d492a02403b2))
* **plans:** Onda 6 — hardening from field feedback; replace introspect with A/B groups ([dfa5c16](https://github.com/codigodoleo/superpowers-sage/commit/dfa5c16d5f64767a27392857d9af8cf29aaea659))
* **specs:** fix lando prefix and typo in plugin expansion design ([4cdc08b](https://github.com/codigodoleo/superpowers-sage/commit/4cdc08b585bc97fc02d50cb4c061029bbc3d5be5))

## [2.5.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v2.4.0...superpowers-sage-v2.5.0) (2026-04-19)


### Features

* **skills,scripts:** Wave 5 AI-native integration ([#34](https://github.com/codigodoleo/superpowers-sage/issues/34)) ([d406c03](https://github.com/codigodoleo/superpowers-sage/commit/d406c0318d90adee04c916b02a593181626757a0))

## [2.4.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v2.3.0...superpowers-sage-v2.4.0) (2026-04-19)


### Features

* **agents:** Wave 4 specialized subagents ([#32](https://github.com/codigodoleo/superpowers-sage/issues/32)) ([f7046fd](https://github.com/codigodoleo/superpowers-sage/commit/f7046fddf65ae3aaf2561ff7bd6e2935c7ba1006))

## [2.3.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v2.2.0...superpowers-sage-v2.3.0) (2026-04-19)


### Features

* **hooks,commands:** Wave 3 deterministic capabilities ([#30](https://github.com/codigodoleo/superpowers-sage/issues/30)) ([d3155cd](https://github.com/codigodoleo/superpowers-sage/commit/d3155cd8282d4dc9539bbbf22face7e1095f8bc9))

## [2.2.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v2.1.0...superpowers-sage-v2.2.0) (2026-04-19)


### Features

* **skills:** Onda 2 — progressive-disclosure for 26 skills + validator enforcement ([#28](https://github.com/codigodoleo/superpowers-sage/issues/28)) ([e623326](https://github.com/codigodoleo/superpowers-sage/commit/e6233261775025bb5d13aff4e7000ae04fcf5457))

## [2.1.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v2.0.0...superpowers-sage-v2.1.0) (2026-04-19)


### Features

* **onda-1:** foundation layer — CLAUDE.md + 7 skill progressive-disclosure refactors + validator ([#26](https://github.com/codigodoleo/superpowers-sage/issues/26)) ([d8ea4c5](https://github.com/codigodoleo/superpowers-sage/commit/d8ea4c547e9d082ad574739899e4f718c5ea17bf))

## [2.0.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v1.7.1...superpowers-sage-v2.0.0) (2026-04-18)


### ⚠ BREAKING CHANGES

* **blocks:** block architecture shifts from class-scoped (.b-{slug}) to tag-scoped custom elements (<block-{slug}>). All existing v1 blocks must be migrated via /block-refactoring.

### Features

* **agents,skills:** Wave 4 architecture features ([#24](https://github.com/codigodoleo/superpowers-sage/issues/24)) ([8de9dac](https://github.com/codigodoleo/superpowers-sage/commit/8de9dacc3d077a6949b4643d808bed9475f0bf30))
* **blocks:** adopt custom element pattern for all ACF blocks ([#20](https://github.com/codigodoleo/superpowers-sage/issues/20)) ([e124ac3](https://github.com/codigodoleo/superpowers-sage/commit/e124ac381b7a85c43eecce13ede9e83699603d11))
* **skills,ci,hooks:** Wave 3 automation helpers ([#23](https://github.com/codigodoleo/superpowers-sage/issues/23)) ([6a2930c](https://github.com/codigodoleo/superpowers-sage/commit/6a2930cc639709bef273707c84da2b8137c5a4ac))
* **skills:** add acf-block-refactor skill ([#17](https://github.com/codigodoleo/superpowers-sage/issues/17)) ([905feb7](https://github.com/codigodoleo/superpowers-sage/commit/905feb7d62dc48f4a9355bd7eb7547bd05a77a61))


### Bug Fixes

* **release:** sync version across 5 manifests and track in release-please ([#21](https://github.com/codigodoleo/superpowers-sage/issues/21)) ([0d389c9](https://github.com/codigodoleo/superpowers-sage/commit/0d389c926c0adddbad57ef55f11195303f10dcd0))


### Documentation

* **skills:** expand knowledge base with validated traps and gotchas ([#22](https://github.com/codigodoleo/superpowers-sage/issues/22)) ([1bc88d1](https://github.com/codigodoleo/superpowers-sage/commit/1bc88d19ac2fb959a1ed36d25c6078eb1fa600da))

## [1.7.1](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v1.7.0...superpowers-sage-v1.7.1) (2026-04-18)


### Bug Fixes

* **lang:** explicitly enforce en-US for file names and branch names ([#15](https://github.com/codigodoleo/superpowers-sage/issues/15)) ([f4b7f60](https://github.com/codigodoleo/superpowers-sage/commit/f4b7f60f8e95f014ff7cd7f41097f7698c4068f9))

## [1.7.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v1.6.0...superpowers-sage-v1.7.0) (2026-04-18)


### Features

* **lang:** enforce mandatory en-US for all artifacts and code ([#14](https://github.com/codigodoleo/superpowers-sage/issues/14)) ([610ccaa](https://github.com/codigodoleo/superpowers-sage/commit/610ccaa7f6a173997127ab0182d241c71180ceab))


### Bug Fixes

* **hooks:** quote paths and wrap with bash for Windows/VS Code ([#12](https://github.com/codigodoleo/superpowers-sage/issues/12)) ([4ef95d4](https://github.com/codigodoleo/superpowers-sage/commit/4ef95d41c94e5bcb6ef77e2fd1f73a8c9a69f020))

## [1.6.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v1.5.0...superpowers-sage-v1.6.0) (2026-04-17)


### Features

* add live Pencil screenshot with CACHED fallback to visual-verifier ([6144f17](https://github.com/codigodoleo/superpowers-sage/commit/6144f17809ff96e06be00f324cda6e09f1924ee1))
* add paper.design MCP support as preferred design source ([8a9c071](https://github.com/codigodoleo/superpowers-sage/commit/8a9c071282dfc60c14833ac3077f9d9762b4f6e3))
* add Pencil .pen path routing and workflow to designing skill ([f5533ec](https://github.com/codigodoleo/superpowers-sage/commit/f5533ecdf37ab8317709ec939666870303abfef9))
* add Pencil as step 4 in design-extractor detection order ([e41c8a1](https://github.com/codigodoleo/superpowers-sage/commit/e41c8a1ab61cba07f4d6ab18eb6adf9235f350d3))
* add Pencil MCP check and component-map.md reading to sage-architect ([dc24f15](https://github.com/codigodoleo/superpowers-sage/commit/dc24f157692fac3ccfef2b566599ada4980fa93c))
* add pencil-extractor agent (PANORAMIC/SURGICAL/COMPONENT_MAP) ([c931977](https://github.com/codigodoleo/superpowers-sage/commit/c931977376cb7e3be6cce72781e3c20ce1e947ac))
* **agents:** add paper.design source to design-extractor ([77c051c](https://github.com/codigodoleo/superpowers-sage/commit/77c051c86c7f8ae48015a16a2db0fc048857cc31))
* **agents:** add paper.design to sage-architect design tool list ([6ef9d9e](https://github.com/codigodoleo/superpowers-sage/commit/6ef9d9ebb4408b41b2d3867862bbe7967f56b33d))
* **architecture-discovery:** track paper in visual companion session ([8704f42](https://github.com/codigodoleo/superpowers-sage/commit/8704f42dff1c21b3bba33f0d766dc147a60d6280))
* **designing:** add paper.design branch with URL-based routing ([5c3f7de](https://github.com/codigodoleo/superpowers-sage/commit/5c3f7dea2ed7735f6d4285219f4bbfb98e248b3c))
* detect Pencil MCP and design/ folder in detect-design-tools ([21c47c0](https://github.com/codigodoleo/superpowers-sage/commit/21c47c085fd2cd7079d3c737d8070c145f1498b1))
* **detect:** add paper.design MCP detection with fixture tests ([53a5d3d](https://github.com/codigodoleo/superpowers-sage/commit/53a5d3dff1a6029b08d46a6458e68b59621fecbe))
* **onboarding:** detect and list paper.design MCP ([4acdb5d](https://github.com/codigodoleo/superpowers-sage/commit/4acdb5da97c99b5d4d6e67dd9c1d5874c7046e63))
* **paper-design:** implement MCP support for paper.design with URL-based routing, extraction, and verification enhancements ([e04bad4](https://github.com/codigodoleo/superpowers-sage/commit/e04bad41f865781c487cb1ca8e255297172d9aec))
* **paper.design:** add support for paper.design as a first-class design source ([08e8c03](https://github.com/codigodoleo/superpowers-sage/commit/08e8c033a73619366dbfb7f9475a30e866b6d3dc))
* **plugin:** surface paper.design MCP in hook summary and manifests ([010242e](https://github.com/codigodoleo/superpowers-sage/commit/010242e7f3517211c124f8e0cced70ec4a9c7dd7))
* **verifying:** add paper-only style spot-check vs computed_styles ([585d3b2](https://github.com/codigodoleo/superpowers-sage/commit/585d3b20274b15969d30b1f3582c62553028c71a))


### Bug Fixes

* address quality review issues in pencil-extractor agent ([dca13ec](https://github.com/codigodoleo/superpowers-sage/commit/dca13ecb33f1aa8e38a164a6128f6acb100bc6bd))
* **hooks:** add .gitattributes to force LF on shell scripts ([#9](https://github.com/codigodoleo/superpowers-sage/issues/9)) ([4fe481b](https://github.com/codigodoleo/superpowers-sage/commit/4fe481b7ea39650dcbde85ff796f4d8cb319404b))
* **manifest:** add trailing slash to skills and agents paths ([70c355e](https://github.com/codigodoleo/superpowers-sage/commit/70c355ef11b57a1eb75a60346a20df99b921f1c0))
* **manifest:** add trailing slash to skills and agents paths ([3718d40](https://github.com/codigodoleo/superpowers-sage/commit/3718d403d84d9a9beb8b0097694b4fcf534d2043))
* **manifest:** remove skills/agents/hooks path fields for auto-discovery ([#7](https://github.com/codigodoleo/superpowers-sage/issues/7)) ([bd1b2ca](https://github.com/codigodoleo/superpowers-sage/commit/bd1b2ca3b591c5174227e671d9553f5e8a4d7221))
* **marketplace:** use explicit github source for plugin resolution ([81f8b7f](https://github.com/codigodoleo/superpowers-sage/commit/81f8b7f6188be183e72c59513b5617629d1e7ab9))
* **plugin:** improve marketplace and manifest compatibility ([26be50c](https://github.com/codigodoleo/superpowers-sage/commit/26be50c23ef6ec5fc206c1af61a6138c85365ebb))


### Documentation

* add Pencil MCP support design spec ([f7636db](https://github.com/codigodoleo/superpowers-sage/commit/f7636db94933fc5f60179dba23b4999993fbae10))
* add Pencil MCP support implementation plan ([89e2d8e](https://github.com/codigodoleo/superpowers-sage/commit/89e2d8e3c2d6864b9c7219f46e619c62f953ee56))
* add Pencil MCP to README — routing, conventions, install ([f649ccd](https://github.com/codigodoleo/superpowers-sage/commit/f649ccd257a33ae44f0faa9c89c0f481199ef758))
* **designing:** update purpose line to reflect paper + URL routing ([2154812](https://github.com/codigodoleo/superpowers-sage/commit/2154812d3669ad5104d22fbf9df0d659fa974ce3))
* **readme:** add agnostic installation guide for Claude, VS Code, Cursor ([3e86691](https://github.com/codigodoleo/superpowers-sage/commit/3e86691e77501fe88e5f2208af1425203a1e5699))
* **readme:** document paper.design MCP as preferred design source ([23b4643](https://github.com/codigodoleo/superpowers-sage/commit/23b46432072921373dd22d2f9f843177bbcdd157))
* revise sage-design-system spec and plan ([26095ae](https://github.com/codigodoleo/superpowers-sage/commit/26095ae0f1a7793ff4d9f471aa7af801eb550017))
* **sageing:** document paper.design as preferred design source ([23beee3](https://github.com/codigodoleo/superpowers-sage/commit/23beee31a2bbb6b378d0dc631c05295918090a06))

## [1.4.3](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v1.4.2...superpowers-sage-v1.4.3) (2026-04-14)


### Bug Fixes

* **hooks:** add .gitattributes to force LF on shell scripts ([#9](https://github.com/codigodoleo/superpowers-sage/issues/9)) ([4fe481b](https://github.com/codigodoleo/superpowers-sage/commit/4fe481b7ea39650dcbde85ff796f4d8cb319404b))

## [1.4.2](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v1.4.1...superpowers-sage-v1.4.2) (2026-04-14)


### Bug Fixes

* **manifest:** remove skills/agents/hooks path fields for auto-discovery ([#7](https://github.com/codigodoleo/superpowers-sage/issues/7)) ([bd1b2ca](https://github.com/codigodoleo/superpowers-sage/commit/bd1b2ca3b591c5174227e671d9553f5e8a4d7221))

## [1.4.1](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v1.4.0...superpowers-sage-v1.4.1) (2026-04-14)


### Bug Fixes

* **manifest:** add trailing slash to skills and agents paths ([70c355e](https://github.com/codigodoleo/superpowers-sage/commit/70c355ef11b57a1eb75a60346a20df99b921f1c0))
* **manifest:** add trailing slash to skills and agents paths ([3718d40](https://github.com/codigodoleo/superpowers-sage/commit/3718d403d84d9a9beb8b0097694b4fcf534d2043))

## [1.4.0](https://github.com/codigodoleo/superpowers-sage/compare/superpowers-sage-v1.3.0...superpowers-sage-v1.4.0) (2026-04-14)


### Features

* add paper.design MCP support as preferred design source ([8a9c071](https://github.com/codigodoleo/superpowers-sage/commit/8a9c071282dfc60c14833ac3077f9d9762b4f6e3))
* **agents:** add paper.design source to design-extractor ([77c051c](https://github.com/codigodoleo/superpowers-sage/commit/77c051c86c7f8ae48015a16a2db0fc048857cc31))
* **agents:** add paper.design to sage-architect design tool list ([6ef9d9e](https://github.com/codigodoleo/superpowers-sage/commit/6ef9d9ebb4408b41b2d3867862bbe7967f56b33d))
* **architecture-discovery:** track paper in visual companion session ([8704f42](https://github.com/codigodoleo/superpowers-sage/commit/8704f42dff1c21b3bba33f0d766dc147a60d6280))
* **designing:** add paper.design branch with URL-based routing ([5c3f7de](https://github.com/codigodoleo/superpowers-sage/commit/5c3f7dea2ed7735f6d4285219f4bbfb98e248b3c))
* **detect:** add paper.design MCP detection with fixture tests ([53a5d3d](https://github.com/codigodoleo/superpowers-sage/commit/53a5d3dff1a6029b08d46a6458e68b59621fecbe))
* **onboarding:** detect and list paper.design MCP ([4acdb5d](https://github.com/codigodoleo/superpowers-sage/commit/4acdb5da97c99b5d4d6e67dd9c1d5874c7046e63))
* **paper-design:** implement MCP support for paper.design with URL-based routing, extraction, and verification enhancements ([e04bad4](https://github.com/codigodoleo/superpowers-sage/commit/e04bad41f865781c487cb1ca8e255297172d9aec))
* **paper.design:** add support for paper.design as a first-class design source ([08e8c03](https://github.com/codigodoleo/superpowers-sage/commit/08e8c033a73619366dbfb7f9475a30e866b6d3dc))
* **plugin:** surface paper.design MCP in hook summary and manifests ([010242e](https://github.com/codigodoleo/superpowers-sage/commit/010242e7f3517211c124f8e0cced70ec4a9c7dd7))
* **verifying:** add paper-only style spot-check vs computed_styles ([585d3b2](https://github.com/codigodoleo/superpowers-sage/commit/585d3b20274b15969d30b1f3582c62553028c71a))


### Bug Fixes

* **marketplace:** use explicit github source for plugin resolution ([81f8b7f](https://github.com/codigodoleo/superpowers-sage/commit/81f8b7f6188be183e72c59513b5617629d1e7ab9))
* **plugin:** improve marketplace and manifest compatibility ([26be50c](https://github.com/codigodoleo/superpowers-sage/commit/26be50c23ef6ec5fc206c1af61a6138c85365ebb))


### Documentation

* **designing:** update purpose line to reflect paper + URL routing ([2154812](https://github.com/codigodoleo/superpowers-sage/commit/2154812d3669ad5104d22fbf9df0d659fa974ce3))
* **readme:** add agnostic installation guide for Claude, VS Code, Cursor ([3e86691](https://github.com/codigodoleo/superpowers-sage/commit/3e86691e77501fe88e5f2208af1425203a1e5699))
* **readme:** document paper.design MCP as preferred design source ([23b4643](https://github.com/codigodoleo/superpowers-sage/commit/23b46432072921373dd22d2f9f843177bbcdd157))
* **sageing:** document paper.design as preferred design source ([23beee3](https://github.com/codigodoleo/superpowers-sage/commit/23beee31a2bbb6b378d0dc631c05295918090a06))
