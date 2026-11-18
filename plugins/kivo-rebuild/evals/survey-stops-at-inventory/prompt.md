---
description: /rebuild on a surveyed run stops at the inventory review and writes nothing outside .rebuild/
tags: [command, rebuild]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

/kivo-rebuild:rebuild --run=2026-01-02-acme
