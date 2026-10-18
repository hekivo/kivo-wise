---
description: Eval for wp-hooks-lifecycle on the composer-mu-plugin fixture
tags:
- skill
- wp-hooks-lifecycle
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

In my mu-plugin's ServiceProvider boot() I added add_action('plugins_loaded', ...) to tweak a plugin and add_action('after_setup_theme', ..., 10) for image sizes. Neither runs. Also my save_post handler reads the ACF field and always gets the previous value.
