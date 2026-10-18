> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Onda 2 — YAML Trigger-Richness Audit

**Date:** 2026-04-19

## Summary

| Skill | Before | After | Changed in |
|---|---|---|---|
| acorn-commands | ✅ | ✅ | — |
| acorn-eloquent | ✅ | ✅ | — |
| acorn-livewire | ✅ | ✅ | — |
| acorn-logging | ✅ | ✅ | — |
| acorn-middleware | ✅ | ✅ | — |
| acorn-queues | ✅ | ✅ | — |
| acorn-redis | ✅ | ✅ | — |
| acorn-routes | ✅ | ✅ | — |
| architecting | ✅ | ✅ | — |
| architecture-discovery | ✅ | ✅ | — |
| block-refactoring | ✅ | ✅ | — |
| block-scaffolding | ✅ | ✅ | — |
| building | ✅ | ✅ | — |
| debugging | ✅ | ✅ | — |
| designing | ✅ | ✅ | — |
| install-plugin | ✅ | ✅ | — |
| migrating | ✅ | ✅ | — |
| modeling | ✅ | ✅ | — |
| onboarding | ✅ | ✅ | — |
| plan-generator | ✅ | ✅ | — |
| reviewing | ✅ | ✅ | — |
| sage-design-system | ✅ | ✅ | — |
| sage-lando | ✅ | ✅ | — |
| sageing | ⚠ | ✅ | 2.5 |
| verifying | ✅ | ✅ | — |
| wp-block-native | ✅ | ✅ | — |
| wp-capabilities | ✅ | ✅ | — |
| wp-cli-ops | ✅ | ✅ | — |
| wp-hooks-lifecycle | ✅ | ✅ | — |
| wp-performance | ✅ | ✅ | — |
| wp-phpstan | ✅ | ✅ | — |
| wp-rest-api | ✅ | ✅ | — |
| wp-security | ✅ | ✅ | — |

## Audit Criteria

A description is ✅ if it names ≥5 concrete identifiers (lando commands, PHP class names, config keys, file paths) and covers the primary use case clearly.

A description is ⚠ if it has 3–4 identifiers, is too generic, or uses inline prose instead of the standard block scalar `description: >` format with comma-separated identifiers.

A description is ❌ if it has fewer than 3 identifiers, or is purely descriptive prose with no concrete terms.

## Skills Rewritten in 2.5

### sageing

**Reason:** The original description used an inline single-line format that appended identifiers after a sentence-terminating period with a comma (`...Read this first in any Sage project., WordPress MCP Adapter, ...`). This formatting is structurally inconsistent with every other skill in the plugin and reduces YAML readability and parser reliability. The identifier count was technically sufficient but the format was ⚠.

**Before:**
```yaml
description: Meta-skill for Sage/Acorn projects; explains the gerund workflow ecosystem, Lando commands, architectural preferences, plan system, design tool integration, and when to use which skill. Read this first in any Sage project., WordPress MCP Adapter, discover-abilities, execute-ability, Acorn AI, mcp-query-patterns, query-first workflow
```

**After:**
```yaml
description: >
  Meta-skill for Sage/Acorn projects — gerund workflow ecosystem, Lando commands,
  architectural preferences, plan system, design tool integration, skill routing,
  WordPress MCP Adapter, discover-abilities, execute-ability, mcp-query-patterns,
  query-first workflow, Acorn, Bedrock, Sage theme, roots ecosystem, when to use
  which skill — read this first in any Sage/Acorn project session
```
