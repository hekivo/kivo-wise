# Architecture discovery procedures

Deep reference for scoping a new feature on a Roots project. Loaded on demand from `skills/roots-onboarding/SKILL.md`.

Run the onboarding map first (SKILL.md steps 1-5); it supplies profile, paths, providers and runner. This procedure produces a short architecture note and asks for approval. It writes no application code, and it writes files only when the user approves a location. It never commits, pushes or creates branches on its own.

## Phase 0: scope

1. Restate the scope in one sentence and confirm it.
2. Read the project rules (`AGENTS.md`, `.ai/`, `.claude/rules/`). If they require a written scope in an issue or card before coding, say so and offer to draft it.
3. Check the branch. If work would start on the default branch, say so and let the user decide; do not create a branch unprompted.

## Phase 1: explore what already exists

Use the inventory JSON, then read:

- the providers that touch the area (where they are registered depends on the profile; see the table in SKILL.md);
- existing blocks, post types, fields, components and composers close to the feature;
- routes and API contracts if the feature exposes data;
- plans or earlier notes in the project's plans folder.

## Phase 2: native first

For every requirement write which native mechanism covers it before any custom class. Name the mechanism and the local file where its behaviour is verified.

| Need | Look first at |
| --- | --- |
| Validation, save flow, field choices (ACF projects) | ACF hooks in the installed plugin's `includes/` |
| Custom post type or taxonomy | `register_post_type` in WordPress core; the project's existing mechanism (Poet, `roots/acorn-post-types`, classes) |
| Endpoint | `register_rest_route` in core (`wp-includes/rest-api.php`); an Acorn route only if the project already uses them |
| Scheduling, caching | WP-Cron, the transients API, the object cache; Acorn's scheduler and cache only where the project already boots them |
| Block | `register_block_type` with `block.json`; ACF Composer only where ACF is installed |
| View data | an Acorn View Composer |

A custom implementation needs a one-line reason ("the native hook fires after X, we need it before").

## Phase 3: clarifying questions

Ask one at a time, only what the code cannot answer: user-facing behaviour, editor experience, data sources and integrations, non-functional limits (performance, security, deadline), and whether existing data must stay readable.

## Phase 4: components and boundaries

List each component with responsibility, inputs and outputs, dependencies, and the main risk. Place each one in the profile's real folder (theme `app/`, plugin `app/`, or root `app/`) and name the provider that registers it.

## Phase 5: options

Offer two or three approaches with trade-offs and a recommendation. Ask the user to choose.

### Preset: zero-migration port

Use when porting ACF field groups, post types or blocks from older code and stored content must stay readable without a migration.

With ACF Builder (used by ACF Composer) a field key is built from the group name and the field name, lower-cased (`field_<group>_<name>`), as `StoutLogic\AcfBuilder\Transform\NamespaceFieldKey::transformValue` shows. So:

- renaming a field, renaming the group, or moving a field into another group changes the key and stored values stop resolving;
- the order of `->addX()` calls does not change keys (upstream guidance claimed it did; the transform above shows names only).

Rule for the port: keep group names, field names and nesting identical to the source; diff the built field arrays against the old ones before merging.

## Phase 6: execution strategy

Classify tasks: independent (can run in parallel), shared-service (sequential), risky (needs a checkpoint with the user).

## Phase 7: present in sections and get approval

Present Overview, then Components and data flow, then Quality strategy (error handling, tests, performance and security limits). Ask for approval after each section.

## Phase 8: write the note

Only after approval, and only at a location the user confirms (commonly the plans folder, a dated `YYYY-MM-DD-<topic>-architecture.md`). Use the template in `references/output-contract.md`. Offer an independent review of the note by `roots-architect` or `acorn-reviewer`; revise at most three times, then ask the user.
