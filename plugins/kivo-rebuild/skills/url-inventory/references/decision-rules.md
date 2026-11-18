# Decision rules

`build-inventory.mjs` proposes one decision per URL with the first rule that matches, in the order below. The row keeps the rule id (`rule_id`) and the reason. R99 always matches and cannot be disabled. A proposal is not a decision: `final` stays empty until a person sets it.

Decisions: `keep` (the URL exists on the new site), `redirect` (it goes to `target`), `gone` (answers 404 or 410 on purpose), `noindex` (exists but is kept out of search), `review` (a person must decide).

## Rule table

| Id | Matches when | Proposes | Needs |
|---|---|---|---|
| R01 | the path is in the approved redirects | redirect to the approved target | `redirects_csv` |
| R02 | the URL comes only from search and its last segment has a file extension from `rules.file_ext` | review: file outside the sitemap (with the live status) | signals |
| R03 | from search only, with a query string | review: query-string variant | signals |
| R04 | from search only, and the live site answers 3xx | redirect to the live location: live site redirects, needs an edge rule | signals, live check |
| R05 | from search only, and the live site answers 404 or 410 | review: already gone on the live site | signals, live check |
| R06 | from search only, any other case | review: outside the sitemap | signals |
| R07 | staging is configured and answers 404, `import_date` is set, `lastmod` is after it, and the type is not a tag type | keep: changed on the live site after the import (cutover delta) | staging check, `import_date` |
| R08 | the path starts with a junk prefix | gone: test, draft or plugin page | `rules.junk_prefixes` |
| R09 | tag type and staging answers 200 | keep: tag archive resolves | staging check |
| R10 | tag type and there is no Search Console data | review: tag archive without search data | none |
| R11 | tag type with clicks | review: keep or redirect to a category | signals |
| R12 | tag type with impressions but no clicks | noindex: shown in search but never clicked | signals |
| R13 | tag type, never shown in search | gone: never shown in search | signals |
| R14 | staging answers 200 | keep: same URL on the new project | staging check |
| R15 | staging answers 3xx | redirect to the staging location: staging already redirects | staging check |
| R16 | no staging configured, and the live site answers 200 or has no data | keep: exists on the live site | none |
| R17 | no staging configured, and the live site answers 3xx | redirect to the live location | live check |
| R18 | no staging configured, and the live site answers 404 or 410 | gone: already gone on the live site | live check |
| R99 | always | review: no rule fits | none |

"From search only" means the URL is not in the sitemap and was added from the search signals with clicks above zero.

## Redirect targets

A target on the live or staging host is stored as a path (`/new-page/`). A target on any other host stays absolute (`https://other.example.test/page`). The same applies to the targets of R04, R15 and R17 and to the approved targets of R01.

## Config keys that change the rules

| Key | Effect |
|---|---|
| `rules.disable` | Rule ids to skip, for example `["R12"]`. R99 cannot be skipped. |
| `rules.junk_prefixes` | Path prefixes for R08, for example `["/test", "/draft"]`. |
| `rules.tag_types` | Sitemap types treated as tag archives (R09 to R13). Default `["post_tag"]`. |
| `rules.file_ext` | File extensions for R02. Default `pdf`, `doc`, `docx`, `xls`, `xlsx`, `zip`. |
| `redirects_csv` | Path to a CSV with the columns `source,target,approved`, relative to the project. Only rows with a non-empty `approved` count. |
| `import_date` | Date of the data import into the new project (`YYYY-MM-DD`), for R07. |
| `staging` | When set, R16 to R18 are skipped in favor of the staging rules R14 and R15. |

## What is not covered

The rules know the status of the URL, its type and its search numbers. They do not read page content. Duplicate content, thin pages and canonical conflicts need a person, which is why R99 and the `review` outcomes exist.
