# RD Station

RD Station is a marketing automation platform. A site often feeds it through forms, pop-ups, landing pages and a tracking script. In this slice it is a manual, read-only source: the person exports lists, and the survey records that they exist.

## Prerequisites

- Access to the RD Station Marketing account with permission to view assets and integrations.
- `rdstation` in `.rebuild/config.json` set to the folder where the exports are kept, for example `"rdstation": "exports/rdstation"`. `connect.mjs` then records the source as `manual`.

## Paths

1. **MCP.** Not used for this source.
2. **API.** Not used in this slice. Never write an RD Station API token or client secret in the config, the run files or a prompt.
3. **Manual.** Export or copy the lists below and save them in the folder named in the config. Menu names differ between plans; what matters is the list.

## Read test

None. The source is recorded as `manual` with the identity `export` when `rdstation` is set in the config. Nothing parses these files in this slice.

## Human steps

| What to list | Why it matters for parity | File name |
|---|---|---|
| Landing pages with their URLs and whether each is hosted on the site's domain | Landing pages on the domain are URLs the inventory must decide on | `rdstation-landing-pages.csv` |
| Forms and pop-ups with the pages that embed them | Each embedded form is a feature in the `integrations` area | `rdstation-forms.csv` |
| Integrations (for example the WordPress or shop connector) and the conversion events they send | Events leaving the site are parity items in the `tracking` domain | `rdstation-integrations.csv` |

Also note where the RD Station tracking script is loaded on the live site (Tag Manager, theme options or a plugin); the legacy inventory must find it.
