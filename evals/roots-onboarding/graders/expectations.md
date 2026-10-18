---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- runs the detector and then scripts/inventory-project.mjs with --app pointing at the detected app path (not a theme path); with read-only tools it cannot run scripts, so showing those exact commands with the detected app path and building the same map from the files satisfies this
- reports providers from composer.json extra.acorn.providers and names unregistered providers on disk if any
- describes blocks as native block.json with Blade, and does not mention ACF Composer, Poet or Livewire as present
- post types reported through roots/acorn-post-types config, not Poet
- stays read-only: writes no files, creates no branch, makes no commit
- never suggests running wp, composer, php, yarn or npm outside the runner
