---
description: Eval for docs-brain on the composer-mu-plugin fixture
tags:
- skill
- docs-brain
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Does ACF 6.8 let me add a custom validation message per field? Check the docs for our version and write me a short note about it for the public README of our plugin.
