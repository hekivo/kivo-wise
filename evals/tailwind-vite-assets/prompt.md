---
description: Eval for tailwind-vite-assets on the composer-mu-plugin fixture
tags:
- skill
- tailwind-vite-assets
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Our plugin's built stylesheet 404s in production: the URL points to /wp-content/themes/<theme>/public/build/assets/... but the files are in the plugin's public/build. Locally with the dev server it works. Fix it.
