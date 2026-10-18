---
description: Eval for the livewire-debugger agent
tags:
- agent
- livewire-debugger
max_turns: 15
timeout_seconds: 420
allowed_tools:
- Read
- Glob
- Grep
- Skill
- Agent
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files. Delegate to the matching kivo-wise subagent.'
---

My Livewire SearchBar component renders but doesn't update when I type.
