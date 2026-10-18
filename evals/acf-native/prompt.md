---
description: Eval for acf-native on the radicle fixture
tags:
- skill
- acf-native
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Editors keep publishing case studies without a client logo or with a summary longer than 160 characters. Block the publish with a clear error on the field, but drafts should still save.
