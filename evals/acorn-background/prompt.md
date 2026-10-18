---
description: Eval for acorn-background on the composer-mu-plugin fixture
tags:
- skill
- acorn-background
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Our CRM sync makes form submissions slow. Move it to a Redis queue; we already use Redis for the WordPress object cache.
