---
description: Eval for compose-wp on the compose-bin fixture
tags:
- skill
- compose-wp
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

I added `WP_ENVIRONMENT_TYPE: staging` under the app service's `environment:` in compose.yaml, but WordPress still reports `local`. How do I apply the change, and then clear the Acorn cache so the theme picks it up?
