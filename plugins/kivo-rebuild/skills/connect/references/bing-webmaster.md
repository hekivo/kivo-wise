# Bing Webmaster Tools

Bing Webmaster Tools holds Bing's search data and its crawl view of the site. In this slice it is a manual, read-only source: the person exports files, and the survey records that they exist.

## Prerequisites

- Access to the site's property in Bing Webmaster Tools (verified owner or a user with read access).
- `bing` in `.rebuild/config.json` set to the folder where the exports are kept, for example `"bing": "exports/bing"`. `connect.mjs` then records the source as `manual`.

## Paths

1. **MCP.** Not used for this source.
2. **API.** Not used in this slice.
3. **Manual.** Export the files below and save them in the folder named in the config.

## Read test

None. The source is recorded as `manual` with the identity `export` when `bing` is set in the config. Nothing parses these files in this slice.

## Human steps

Save each export with the file name shown, so later slices can find it:

| Screen | File name |
|---|---|
| Search Performance > Pages > export to CSV, widest date range | `bing-pages.csv` |
| Sitemaps > the list of submitted sitemaps and their status (copy or export) | `bing-sitemaps.csv` |
| Site Explorer or Crawl Information: crawl errors and blocked pages (export) | `bing-crawl-errors.csv` |

If Search Console is already connected, Bing data is a second opinion on which URLs get search traffic. Do not treat it as a replacement.
