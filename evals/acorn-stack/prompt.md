---
description: Eval for acorn-stack on the radicle fixture
tags:
- skill
- acorn-stack
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

I added app/Providers/PricingServiceProvider.php with a singleton for our pricing API client and a save_post hook, but the hook never runs. Where do I register the provider so Acorn picks it up?
