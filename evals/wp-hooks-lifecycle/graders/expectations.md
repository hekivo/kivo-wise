---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- explains that Acorn boots on after_setup_theme in this profile, so plugins_loaded already fired and after_setup_theme at a priority not greater than the boot priority is skipped
- moves the plugins_loaded callback to a bootstrap file loaded by the main plugin file (file scope, no app() there) and the image sizes to a higher after_setup_theme priority or another valid place
- explains the block editor two-request save (REST then post.php?meta-box-loader=1) and moves the ACF-dependent logic to acf/save_post with priority > 10, routing details to acf-native
- adds autosave/revision guards
- never suggests running wp, composer or php outside the runner
