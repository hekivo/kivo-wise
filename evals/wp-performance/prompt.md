---
description: Eval for wp-performance on the composer-mu-plugin fixture
tags:
- skill
- wp-performance
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

The archive page takes 4 seconds locally. Profile it and tell me what is slow.
