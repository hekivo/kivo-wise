---
description: Eval for wp-abilities-mcp on the composer-mu-plugin fixture
tags:
- skill
- wp-abilities-mcp
max_turns: 12
timeout_seconds: 300
allowed_tools:
- Read
- Glob
- Grep
- Skill
append_system_prompt: 'You only have read-only tools in this environment. Do not try to run commands or edit files: show the exact commands you would run and the file changes as diffs or code blocks, and say what you verified by reading files.'
---

I created an ability with wp acorn make:ability ListProjects and added it to config/ai-wordpress.php, but it never shows up when the agent calls discover-abilities through our local MCP server. Fix it and give me the .mcp.json.
