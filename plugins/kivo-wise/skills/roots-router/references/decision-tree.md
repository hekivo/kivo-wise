# Routing decision tree: profile x intent

Loader note: open this file from `roots-router` step 3 when the intent matches more than one row of `routing.json`, or when the profile changes the answer.

## 1. Lookup order for every fact

1. **Project guidelines first**: `AGENTS.md`, `.ai/` or whichever rules folder the repository names as its instructions. They override anything a skill says.
2. **Local source second**: WordPress core (the `coreDir` from triage), ACF `includes/`, the app's `vendor/` (Acorn, Livewire, ACF Composer). A hook or API found there is the answer; a skill only tells you where to look.
3. **Docs corpus third**: when `.docs-brain.json` exists, the versioned corpus it points to (opened through the `docs-brain` skill) beats the web because it matches the lock files.
4. **Web last**, and only for versions the corpus does not cover.

## 2. Profile first, then intent

Read `apps[active].kind` from the triage JSON (or the profile line in the session context). The flag file `.roots-stack.json` wins over heuristics. Three profiles are routed; the other kinds fall back as noted.

| Triage kind | Profile used for routing |
|---|---|
| `sage-theme`, `acorn-theme` | `sage-theme` |
| `acorn-mu-plugin`, `acorn-plugin` | `acorn-mu-plugin` |
| `radicle-app` | `radicle-app` |
| `acorn-unknown`, no app, layout `plain-wordpress` or `unknown` | run `roots-triage`; if still unknown, ask one question (see section 5) |

## 3. Intent rows

Rows are ordered from most specific to broadest; the first row whose identifiers appear in the request wins. The profile column says what changes inside the chosen skill.

| Intent (identifiers the user types) | Skill | sage-theme | acorn-mu-plugin | radicle-app |
|---|---|---|---|---|
| detect, `.roots-stack.json`, "which profile", missing or wrong session context | `roots-triage` | same | same | same |
| `Application::configure`, `ACORN_BASEPATH`, providers, View Composers, Blade components, `config/*.php`, `optimize:clear` | `acorn-stack` | base path inferred from the theme | base path must be explicit | base path is the repo root |
| `make:block`, `acf:block`, new CPT, `config/poet.php`, `config/post-types.php`, `make:*` | `acorn-scaffolding` | ACF Composer blocks, Poet CPTs | ACF Composer blocks, Poet or classes | native blocks, `acorn-post-types` |
| ACF fields, validation, `acf/validate_value`, `acf/save_post`, options pages, ACF JS API | `acf-native` | same | same | same |
| `wire:model`, `make:livewire`, 419, stale snapshot | `acorn-livewire` | assets from the theme layout | assets injected by the plugin | assets from the root layout |
| `register_rest_route`, `routes/*.php`, middleware, `permission_callback`, OpenAPI | `acorn-routes-api` | same | same | same |
| Eloquent, migrations, `wp acorn migrate`, factories | `acorn-data` | same | same | same |
| queues, jobs, WP-Cron, Action Scheduler, console commands, logging, Redis | `acorn-background` | same | same | same |
| `add_action`/`add_filter` timing, `after_setup_theme`, `plugins_loaded`, mu-plugin load order | `wp-hooks-lifecycle` | hooks from `functions.php` or providers | mu-plugins load before plugins and themes | root boot file loads first |
| escaping, `esc_*`, `wp_kses`, nonces, capabilities, `$wpdb->prepare` | `wp-security-escaping` | same | same | same |
| `lando`, `.lando.yml`, `lando rebuild`, `lndo.site`, Xdebug, DB import/export, "run wp-cli/composer/yarn" | `lando-wp` | tooling may be theme-scoped | tooling names read from `.lando.yml` | webroot usually `public` |
| install/update a plugin, `composer require`, WPackagist, `wp-packages.org`, private zips | `wp-composer-plugins` | same | same | same |
| 500, blank page, "view not found", "class not found", `debug.log`, stale after deploy | `roots-debugging` | same | same | same |
| Tailwind `@theme`, Vite, `Vite::asset`, `public/build`, CSS not applied | `tailwind-vite-assets` | build base = theme URL | build base = plugin URL | build base = webroot |
| PHPUnit, Pest, Playwright, "write a test", "what does CI run" | `testing-wp` | same | same | same |
| slow page, slow query, profiling, N+1, transients, APM | `wp-performance` | same | same | same |
| PHPStan, larastan, `phpstan.neon`, baseline | `wp-phpstan` | same | same | same |
| Abilities API, `wp_register_ability`, MCP adapter, `acorn-ai` | `wp-abilities-mcp` | same | same | same |
| official docs, corpus, `.docs-brain.json`, "which version of the docs" | `docs-brain` | same | same | same |
| onboarding, project overview, "orient me" | `roots-onboarding` | same | same | same |
| review, convention audit | `roots-reviewing` | theme conventions | plugin conventions | root-app conventions |

## 4. Tie-breaks

- A symptom ("500", "blank page") beats the topic it mentions: `roots-debugging` first, which then hands off to the topic skill.
- A command to run (`lando …`, "run the tests", "clear the cache") routes to `lando-wp` when the question is *how to run it*, and to the topic skill when the question is *what to run*.
- "Create" beats "explain": `make:*`, "new block", "new CPT" go to `acorn-scaffolding` even when providers or ACF are mentioned.
- Two topics with equal weight: open the one whose identifiers appear verbatim in the request; mention the second as the follow-up.

## 5. Native-first gate (apply before any custom code)

Before writing validation, save flows, admin behaviour, field choices, endpoints, cron, caching or routing, name the native mechanism (WordPress hook, ACF hook or JS API, Acorn facility) and verify how it behaves in the local source: the core directory from triage, ACF `includes/`, the app's `vendor/`. Only a verified gap justifies custom code, and the reason goes next to the code. If the native mechanism is unknown, stop and look it up (local source, then corpus) before proposing anything.

## 6. When routing cannot decide

Ask exactly one question: "Is the Acorn application the theme, a must-use plugin, or the repository root (Radicle)?" Then write the answer to `.roots-stack.json` (see `roots-triage`) so the next session does not ask again.

## 7. Skills that do not ship yet

`routing.json` lists every target skill under `planned` until its folder exists. When a row points at a planned skill: say so, apply the lookup order of section 1 (project guidelines, local source, corpus), and keep the profile differences from the row. Do not invent the skill's procedure.
