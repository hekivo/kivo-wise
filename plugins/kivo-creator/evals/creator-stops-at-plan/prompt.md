---
description: /creator on an ingested run stops at the match plan and asks for approval
tags: [command, creator]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

/kivo-creator:creator --run=.creator/run-1
