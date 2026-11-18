# Parity classes

How each legacy feature is classified against the new project, how urgent a gap is, and what evidence the auditor must write down. The classes are the values of `class` in `parity.json`; the priorities are the values of `priority`.

## Classes

| Class | Test | Evidence in `location`, `note` or `decision` |
|---|---|---|
| `done` | A visitor, editor or integration can do the same thing in the new project today. | `file:line` in the new project where it is implemented. |
| `partial` | The new project does part of it: a behavior, a field, a variant or some of the data is missing. | `file:line` of what exists, and a `note` naming exactly what is missing. |
| `missing-planned` | Not built, but a plan item, ticket or decision to build it exists. | The plan reference (file path and heading, or ticket id) in `location`. |
| `missing-not-planned` | Not built and nothing records a plan to build it. This is the gap class. | A `note` with how it was searched for (paths and terms) and why it is considered missing. |
| `dropped` | A recorded decision says not to carry it over. | The decision reference in `decision` (file path and heading, or ticket id). |
| `data-only` | No behavior is needed in the new project, but the data the feature held must survive. | The data count in the `note` (for example `1,240 entries`) and where it goes. |

When unsure between two classes, pick the worse one (`partial` over `done`, `missing-not-planned` over `missing-planned`) and say why in `note`. A feature is never `dropped` without a decision reference.

## Priorities

| Priority | Rule |
|---|---|
| `P0` | A sale or a legal duty breaks at launch: checkout, payment, tax and invoice rules, consent, required notices. |
| `P1` | A visible regression on a high-traffic template, or data would be lost: search, filters, redirects, tracking that feeds paid media, form destinations. |
| `P2` | Visible on low-traffic pages or to editors only. |
| `P3` | Nice to have. |

A `done` feature still gets a priority: it records how bad the loss would have been.

## Item shape

Each item of a fragment has only these keys: `feature` (the `F-` id from `features.json`), `class`, `priority`, `location`, `owner`, `note`, `decision`. Any other key makes the merge fail. `owner` is a person or team name given by the person asking; leave it empty when unknown, never invent one.

## Domains

Each auditor takes one domain. Every feature area belongs to one.

| Domain | Covers |
|---|---|
| `storefront` | What shoppers browse: templates, product display, search, filters, menus |
| `checkout` | Cart, checkout, shipping, payments, transactional e-mail |
| `content` | Post types, options pages, redirects, editorial features |
| `integrations` | ERP, CRM, feeds, forms, outbound calls, plugins that connect systems |
| `tracking` | Analytics, tags, pixels, consent, conversion events |
| `infrastructure` | Scheduled jobs, security, performance, server rules |
