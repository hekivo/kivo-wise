# Kivo Wise — Universal Rules

Rules applied in every session where this plugin is active. These take
precedence over skill-local guidance unless a skill explicitly overrides.

## Environment

- All `wp`, `composer`, `artisan`, `yarn`, `npm` commands run via `lando <cmd>`.
  Never invoke these binaries directly on the host.
- Sage projects use Bedrock. Custom code lives in `web/app/`, never in `web/wp/`.
- The plugin supports Claude Code, VS Code Copilot, Cursor, and OpenAI Codex.
  When contributing to this plugin — adding or updating automation hooks —
  keep `hooks/hooks.json` and `hooks/cursor-hooks.json` in sync via
  `scripts/sync-cursor-hooks.mjs`. Manifest versions across
  `.claude-plugin/`, `.cursor-plugin/`, and `.codex-plugin/` are aligned by
  `scripts/sync-codex-manifests.mjs` (also enforced in CI). The Codex CLI
  (>= 0.137) layout — `.agents/plugins/marketplace.json` and the real-content
  plugin under `plugins/kivo-wise/` (which carries a copy of this file) — is
  **generated** from the root source (`skills/`, `hooks/`,
  `.codex-plugin/plugin.json`, and this `AGENTS.md`) by
  `scripts/build-codex-plugin.mjs`; run it after changing those, never edit
  the generated files (`plugins/`, `.agents/`) by hand (CI enforces sync via
  `--check`).
  `plugins/kivo-creator/` is the exception: a second, **hand-authored**
  plugin (edit it directly). Its three manifests and its entry in every
  marketplace (always `plugins[1]`) share one version, checked by
  `scripts/sync-codex-manifests.mjs` and bumped by release-please as the
  `kivo-creator` package. Codex does not load a plugin's own context file;
  it reads `AGENTS.md` from the project root — see README → OpenAI Codex.

## Protected files (never edit directly)

- `.env`, `wp-config.php` — managed by Bedrock/Trellis Vault. Suggest
  `ansible-vault edit` or Bedrock `.env` pattern instead.
- `bedrock/config/environments/*.php` — environment-specific config.
- `trellis/group_vars/*/vault.yml` — secrets.

If Claude needs to modify these, it MUST ask the user first with a concrete
alternative path.

## Tailwind v4

- `tailwind.config.js` does NOT exist in this stack. Use `@theme` directives
  inside `resources/css/app.css`.
- Prefer utility composition over `@apply`. `@apply` is allowed only for
  truly reusable component primitives.
- Source of truth for design tokens is the `@theme` block in `app.css`.

## Routing & content

- HTTP routes go through Acorn Routes (`routes/web.php`), not
  `register_rest_route()` directly.
- Custom post types go through Poet (`config/poet.php`), not
  `register_post_type()`.
- Fields and blocks go through ACF Composer classes, not the ACF GUI. A field
  group is a class `extends Field` using `Builder::make('name')`; call
  `$fields->setLocation(...)` on its **own line** — never chained onto
  `Builder::make()` (it returns a `LocationBuilder`, not `$this`).
- Escape Blade output by field type: `addText` → `{{ $f }}`, `addTextarea` →
  `@textarea($f)`, `addWysiwyg` → `{!! wp_kses_post($f) !!}`. Never
  `nl2br(esc_html())`.
- Block data fetched at render caches reads in a transient: `get_transient()`,
  and on a miss run the query then `set_transient($key, $data, $ttl)`.

## Interactive UI

- Interactive components use Livewire. Avoid custom JS for anything Livewire
  can model.
- Livewire on Bedrock needs its internal `/livewire/update` endpoint to
  resolve — pretty permalinks enabled and Acorn routes processed (verify with
  `lando acorn route:list`).
- Static UI uses Blade components, not shortcodes.

## Background work

- Scheduled/recurring work goes through Action Scheduler or Laravel queue
  jobs, never raw WP-Cron scripts.

## When in doubt

- Query the WordPress MCP Adapter (if available) via `discover-abilities`
  and `execute-ability` before generating code that references post types,
  routes, fields, or Livewire components. Consult the `roots-router` skill for
  the lookup order and the native-first gate.
- If the AI stack is not installed, ask the user instead of guessing.
