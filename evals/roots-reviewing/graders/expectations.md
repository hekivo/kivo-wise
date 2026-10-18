---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- reads the active profile and applies native block.json checks; lists ACF Composer, Poet and Livewire checks under Not checked instead of reporting violations
- checks the new provider is registered in composer.json extra.acorn.providers using the inventory script, not config/app.php
- checks the post type uses config/post-types.php (roots/acorn-post-types) and flags a hand-written register_post_type
- uses the fixed report template with Critical, Improvement, Good practices, Not checked and Summary, each finding with file:line
- does not edit files, commit or push; suggested test command goes through the runner placeholder
