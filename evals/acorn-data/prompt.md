---
description: Eval for acorn-data on the sage-theme fixture
tags:
- skill
- acorn-data
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

I need a table to store newsletter signups with an Eloquent model. Set up the model and migration.
