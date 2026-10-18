---
description: Eval for roots-debugging on the composer-mu-plugin fixture
tags:
- skill
- roots-debugging
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Since yesterday's deploy the staging homepage still shows the old hero, and the Livewire form on it returns errors when submitted. It works fine on my local environment. What is going on?
