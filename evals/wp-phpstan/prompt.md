---
description: Eval for wp-phpstan on the composer-mu-plugin fixture
tags:
- skill
- wp-phpstan
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Set up PHPStan for our app. We boot Acorn from a must-use plugin.
