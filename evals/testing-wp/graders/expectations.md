---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- reads tests/Pest.php and an existing test first and writes a Pest test, not a stubbed unit test, because WordPress is booted on this profile
- asserts through WordPress APIs (post_type_exists / get_post_type_object / rest routes) and does not create or leave records in the development database
- warns that the suite runs against the configured database and keeps the test non-destructive and repeatable
- runs the narrow test first with the lando test command --filter, then the whole suite, and reports what was observed
- does not invent a second test runner or add a WordPress stub bootstrap
- never suggests running wp/composer outside the runner
