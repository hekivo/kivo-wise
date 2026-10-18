# Token efficiency

The plugin keeps what it puts in context small and loads the rest on demand.

- **Session start** injects at most 1,500 characters of detected facts and a routing table. It never injects a skill body.
- **The keyword router** adds one line, and only when exactly one skill matches the prompt. Ambiguous prompts get nothing.
- **Skill descriptions** are the only text Claude sees for every skill up front. They start with "Use when", list the triggers, and name the neighbouring skill for the cases they do not cover.
- **Skill bodies** load only when the skill is chosen and stay under 500 lines. Long material lives in `references/` and is read when a step asks for it.
- **Documentation** is searched in the docs corpus with `rg` instead of being pasted into context; see `docs-brain`.

## Adding a skill

1. Create `skills/<name>/SKILL.md` with `name` equal to the folder and a description that starts with "Use when".
2. Add its keywords to `skills/roots-router/references/keywords.json` and its profile routes to `routing.json` if the router should reach it.
3. Run `node scripts/validate-skills.mjs` and `node --test test/`.
