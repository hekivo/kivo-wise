---
name: template-map
description: Use when the inventory's URLs must be grouped by the template that renders them so a reviewer checks one sample per group instead of thousands of pages - maps URLs to groups from the project's real templates and blocks, ranks samples by clicks, and keeps review status across re-runs. For deciding per URL use url-inventory.
license: MIT
compatibility: Node 20+. Reads the run's inventory.json, the config and the project's theme or app views.
---

# Template map

Writes `templates.json`: one group per distinct template with the URL count, the clicks, up to three sample URLs and a review status (`todo`, `ok`, `issues`, `na`).

## When to use

- After the inventory is built.
- The project's templates are not the defaults and the groups must be written for the real files.
- Not for the per-URL decisions (`url-inventory`).

## Inputs required

1. A run with `inventory.json`.
2. `.roots-stack.json` (kivo-wise `/roots-detect --write`) and the theme's `resources/views`, to name the real template files.
3. The kivo-rebuild plugin root (two levels above this skill's folder).

## Procedure

1. Run `node <root>/scripts/map-templates.mjs --project=.`. It prints the URL count per group and its template. Without `templates` in the config it uses default groups: home, product, product category, blog post, blog tag, page and search-only.
2. When `templates` is missing or the defaults do not fit the project (no shop, different views), read `.roots-stack.json` and `resources/views`, and write `templates` in `.rebuild/config.json`. Each entry is `{"group": "kebab-name", "label": "...", "template": "resources/views/<file>", "blocks": ["..."], "match": {"type": "...", "prefix": "...", "regex": "..."}}`. Use one group per distinct template. For block-based pages list the blocks in `blocks`. The first group whose `match` fits a URL wins, so put narrow matches before broad ones.
3. Re-run. URLs that no group matches fall into a group named `unmapped`; that name is reserved and cannot be used in the config. Look at `unmapped` first: it means a template is missing from the map.
4. A re-run keeps each group's `status`, `note` and `issue`. Samples are recomputed, so any hand-picked samples are lost.
5. Optionally dispatch the `template-sampler` agent for a group to replace the clicks-ranked samples with up to three that cover distinct variants. Do it last, after the groups are final. It changes only that group's `samples`.
6. Show the groups ordered by clicks and say which sample URLs a reviewer should open.

## Verification

- `node <root>/scripts/validate.mjs --project=.` passes.
- The counts of all groups add up to the number of inventory rows.
- No group is named `unmapped` with a large share of the URLs, or the person has been told why.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `template group name "unmapped" is reserved` | The config uses that name | Rename the group |
| Most URLs in `unmapped` | `match.type` values do not match the sitemap types | Print the distinct `type` values of the inventory and match on those, or on `prefix` |
| Samples changed after a re-run | Samples are recomputed from clicks | Run the sampler again after the final mapping |
| A product page lands in the page group | An earlier broad group matched first | Move the narrow group up |
| Invalid group name | The name has capitals or spaces | Use lowercase letters, digits and hyphens |

## Escalation

Ask before writing `templates` in the config when the project has several themes or the stack file names more than one app.
