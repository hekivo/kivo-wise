---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- points to the official procedure (third-party/wp-phpstan/SKILL.upstream.md in the plugin) for the full checklist
- sets paths to the plugin app/ folder and never to wp/ or vendor/
- installs and runs PHPStan through the Composer runner placeholder, not host composer or php
- treats Larastan as optional and states it must be checked for boot compatibility with Acorn
- starts at a low level with a baseline instead of fixing everything at once
