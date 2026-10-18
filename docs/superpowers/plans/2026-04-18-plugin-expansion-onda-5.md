> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Plugin Expansion — Onda 5 Implementation Plan (scoped)

> **Status:** Scoped scaffolding. Expand to full TDD when Onda 4 closes. **Strategic pillar** — this wave is the core differentiator of the expansion.

**Goal:** Integrate the official Roots/WordPress AI stack (Acorn AI + WP MCP Adapter + Laravel AI SDK) into the plugin so Claude queries the real project state via MCP before generating code.

**Architecture:**
- **5.1** produces an AI-readiness probe (Node script).
- **5.2** wraps the probe into a user-invocable `/ai-setup` skill that guides installation.
- **5.3** generates the user project's `.mcp.json` pointing to `lando wp mcp-adapter serve` via stdio.
- **5.4** is a new skill that teaches the creation of custom WordPress Abilities (`lando acorn make:ability`).
- **5.5** injects a "query-first" pattern across existing skills via a shared reference.

`sage-introspect` (custom MCP) is deferred to Onda 6 as conditional fallback only.

**Tech Stack:** Node (`.mjs`), bash, Composer (via Lando), `.mcp.json` schema, WP 6.9 Abilities API, Laravel AI SDK via `roots/acorn-ai`, `wordpress/mcp-adapter` (stdio transport).

**Source spec:** `docs/superpowers/specs/2026-04-18-plugin-expansion-design.md`

---

## Microplan scope

| ID | Target | Output |
|---|---|---|
| 5.1 | `scripts/detect-ai-readiness.mjs` | JSON probe: WP version, Acorn AI present, MCP Adapter present, API keys, running servers |
| 5.2 | `/ai-setup` skill | `skills/ai-setup/SKILL.md` + `references/*.md` + `scripts/install-ai-stack.sh` + `scripts/configure-mcp-json.mjs` |
| 5.3 | Project `.mcp.json` template | `templates/project-mcp.json.tpl` + `scripts/generate-project-mcp.mjs` (merges into existing user `.mcp.json` non-destructively) |
| 5.4 | `/abilities-authoring` skill | `skills/abilities-authoring/SKILL.md` + `references/{registration,schema,mcp-exposure,patterns}.md` + `scripts/create-ability.sh` + `scripts/list-abilities.sh` + `assets/ability-*.php.tpl` |
| 5.5 | Query-first integration | `skills/sageing/references/mcp-query-patterns.md` + targeted edits in `acorn-livewire/SKILL.md`, `acorn-routes/SKILL.md`, `modeling/SKILL.md`, `building/SKILL.md` linking to it |

## Quality bar

**C** on 5.1–5.4 (infra, install flow, MCP handshake). **B** on 5.5 (markdown wiring).

Each quality-C microplan ships with:
- Integration test in clean Lando project fixture (automated where possible, manual where Lando makes that impractical).
- `onda-5-validation.md` with handshake log + `discover-abilities` sample response.
- Rollback guide (each install step is reversible).

## Dependencies

- 5.1 is root of the wave. All others depend on 5.1 for `detect-ai-readiness.mjs`.
- 5.2 depends on 5.1.
- 5.3 depends on 5.1.
- 5.4 depends on 5.2 (skill uses installed Acorn AI commands).
- 5.5 depends on 5.2 + 5.3 + Onda 2 refactors (skills need `references/` structure to accept the new cross-link).

## Success criteria

- On a clean Lando Sage project with WP 6.9, running `/ai-setup` installs `roots/acorn-ai` + `wordpress/mcp-adapter`, publishes config, prompts for and writes an API key, generates project `.mcp.json`, and completes a successful `discover-abilities` handshake.
- AI-readiness probe correctly detects every combination of missing pieces on fixture projects (WP 6.8, WP 6.9 without Acorn AI, WP 6.9 with Acorn AI but no API key, fully ready).
- `/abilities-authoring` creates a new Ability via `lando acorn make:ability`, registers it, and it appears in `discover-abilities` output.
- At least 4 skills link `mcp-query-patterns.md` and explicitly instruct Claude to consult MCP before guessing.
- Token reduction: **additional 10–20%** on session-padrão when AI stack is available (because Claude stops re-asking for CPT/route metadata).

## AI-readiness probe shape (contract)

```json
{
  "ready": true,
  "wp_version": "6.9.1",
  "packages": { "acorn-ai": "1.0.0", "mcp-adapter": "0.4.0" },
  "api_keys_present": ["ANTHROPIC_API_KEY"],
  "mcp_servers": ["mcp-adapter-default-server"],
  "missing": [],
  "upgrade_path": []
}
```

When `ready: false`, `missing` contains one or more of: `"wp-core<6.9"`, `"acorn-ai"`, `"mcp-adapter"`, `"api-key"`, `"mcp-server-not-running"`. `upgrade_path` is an ordered list of remediation commands for `/ai-setup` to execute.

## `.mcp.json` template (contract)

Template at `templates/project-mcp.json.tpl`:

```json
{
  "mcpServers": {
    "wordpress": {
      "command": "lando",
      "args": [
        "wp",
        "mcp-adapter",
        "serve",
        "--server=mcp-adapter-default-server",
        "--user=admin"
      ]
    }
  }
}
```

Generator merges this into the user project's `.mcp.json` if one exists, preserving other entries.

## Handoff note

When expanded to full TDD, this is likely the largest wave (5 microplans × ~200 linhas each of tasks + fixtures). Consider executing it via `subagent-driven-development` to parallelize 5.1+5.3 and 5.4+5.5 under watchful checkpoints.
