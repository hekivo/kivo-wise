---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- reads the plugin's withRouting(...) call (web, api, apiPrefix) before choosing a route file
- explains that Acorn defines no 'auth' middleware alias and proposes a capability-check middleware or register_rest_route with permission_callback instead
- flags that Acorn's web group has no CSRF check and adds a WordPress nonce (or ValidateCsrfToken, or X-WP-Nonce on a REST route)
- keeps routes out of /wp-json, wp-admin and paths that collide with pages
- updates the project's API contract file in the same change if the project documents one, without inventing a location
- verifies with lando wp acorn route:list and curl for 401/403, success and invalid input
- never suggests running wp, composer or php outside the runner placeholders
