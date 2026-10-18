---
description: Eval for testing-wp on the radicle fixture
tags:
- skill
- testing-wp
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

Add a test that proves our custom post type 'case_study' is registered with REST support, and run the test suite.
