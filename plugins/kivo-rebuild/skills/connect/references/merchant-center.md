# Merchant Center

Google Merchant Center holds the product feed and the shop's eligibility for free listings and ads. In this slice it is a manual, read-only source: the person exports files, and the survey records that they exist.

## Prerequisites

- Access to the Merchant Center account with at least standard access.
- `merchant` in `.rebuild/config.json` set to the folder where the exports are kept, for example `"merchant": "exports/merchant"`. `connect.mjs` then records the source as `manual`.

## Paths

1. **MCP.** Not used for this source.
2. **API.** Not used in this slice.
3. **Manual.** Export or copy the items below and save them in the folder named in the config. Menu names change over time; what matters is the content.

## Read test

None. The source is recorded as `manual` with the identity `export` when `merchant` is set in the config. Nothing parses these files in this slice.

## Human steps

| What to capture | Why it matters for parity | File name |
|---|---|---|
| The product list with status and issues (Products > All products, download) | Product URLs that the feed references must keep resolving or redirect | `merchant-products.csv` |
| Diagnostics: item issues and account issues | Existing problems are not regressions of the rebuild | `merchant-diagnostics.csv` |
| How the feed is produced: a plugin, a scheduled fetch of a URL, or a content API (Settings > Data sources) | The feed generator is a feature in the `integrations` area; a scheduled fetch URL is a URL to keep | `merchant-feed-source.md` |
| Shipping and returns settings and linked accounts (Ads, Analytics) | Checkout and tracking parity items | `merchant-settings.md` |
