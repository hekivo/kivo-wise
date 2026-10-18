---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- points to the official procedure (third-party/wp-performance/SKILL.upstream.md in the plugin) for the full checklist
- runs perf_inspect.mjs with WP_RUNNER set to the runner placeholder (lando wp), never a bare wp
- uses the container path for --path, not the host path
- measures a baseline (cold and warm) before proposing any change
- checks the object-cache drop-in and names the native cache API before suggesting a custom cache class
