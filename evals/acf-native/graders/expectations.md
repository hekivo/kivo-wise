---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- checks whether ACF is installed before suggesting any acf/* hook, and says ACF is not installed by default on radicle-app
- without ACF, routes the rule to native WordPress mechanisms (register_post_meta with sanitize_callback, rest_pre_insert_{post_type} or wp_insert_post_data) in a provider listed in composer.json extra.acorn.providers
- if the project does use ACF, uses field settings (required, maxlength) plus acf/validate_value/key=… instead of editor.preSavePost or a custom check endpoint, and notes that block-editor validation runs only for publish/future
- names the local source file where the mechanism was verified
- suggests running node scripts/audit-native.mjs with the app path
- never suggests running wp/composer outside the runner
