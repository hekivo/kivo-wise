# Playwright

Playwright drives a real browser. This slice only records whether it is available; later slices use it for rendered checks and screenshots of live and new pages.

## Prerequisites

- Node.js 20+ and the project's package manager. Run commands through the project's runner (Lando or DDEV) when the project uses one.
- `@playwright/test` installed in the project (`node_modules/@playwright/test`).

## Paths

1. **MCP.** A Playwright MCP server, when connected, is enough for single checks (open a page, read its rendered text, take a screenshot). Nothing in this slice depends on it.
2. **API.** `connect.mjs` looks for `node_modules/@playwright/test` and records `ok` when it exists. Install it with the project's package manager, then download the browsers: `npx playwright install chromium`.
3. **Manual.** Without Playwright, rendered checks are done by a person in a browser.

## Read test

The presence of `node_modules/@playwright/test` in the project. No browser is launched.

## Human steps

- `install @playwright/test in the project`: add it as a dev dependency and install the browsers, then run `connect.mjs --only=playwright` again. A missing Playwright does not fail the survey; the connection is recorded with path `none`.
