---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- routes provider registration to composer.json extra.acorn.providers on radicle-app (not config/app.php, not a functions.php withProviders call)
- tells the user to rebuild the package manifest with lando wp acorn package:discover (or the project cache command) after editing composer.json
- keeps the singleton in register() and the save_post hook in boot(), with autosave/revision guards
- mentions that a provider that throws is skipped and logged ('Skipping provider') and suggests checking the log
- verifies with a lando wp eval or lando wp acorn command rather than assuming
- never suggests running wp, composer or php outside the runner
