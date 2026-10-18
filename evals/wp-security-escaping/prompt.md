---
description: Eval for wp-security-escaping on the composer-mu-plugin fixture
tags:
- skill
- wp-security-escaping
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Links in our footer component show &#038; in the URL and break the UTM parameters. Fix the Blade component and make sure it does not come back.
