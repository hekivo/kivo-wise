---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted.

- applies the `environment:` change with `docker compose up -d` (which recreates the changed service), and says that `docker compose restart` does not re-read compose.yaml
- uses the runner's acorn command for the cache, for example `bin/wp acorn optimize:clear` (or the project's `bin/flush`), run from the project root
- checks the stack state (`docker compose ps`) or reads compose.yaml and the bin/ scripts before answering
- verifies the result with the runner's WP-CLI, for example `bin/wp eval 'echo wp_get_environment_type();'` or `bin/wp config get WP_ENVIRONMENT_TYPE`
- never suggests running wp/composer outside the runner, and does not use Lando commands on this Compose project
