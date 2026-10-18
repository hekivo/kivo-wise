---
description: Eval for acorn-scaffolding on the composer-mu-plugin fixture
tags:
- skill
- acorn-scaffolding
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Create a 'Feature Grid' ACF block in our mu-plugin that holds three 'Feature Card' blocks by default, with a light and a dark style. I changed the styles once already and the editor still shows the old ones.
