---
description: Eval for acorn-livewire on the radicle fixture
tags:
- skill
- acorn-livewire
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Add a Livewire search box to the blog archive that filters posts as I type.
