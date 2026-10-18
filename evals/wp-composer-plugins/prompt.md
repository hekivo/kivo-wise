---
description: Eval for wp-composer-plugins on the radicle fixture
tags:
- skill
- wp-composer-plugins
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Install the Redirection plugin from wordpress.org and also our licensed SEO plugin, which I have as ./packages/seo-pro-4.2.zip. Activate both when done.
