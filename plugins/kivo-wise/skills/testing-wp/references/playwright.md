# Playwright

Deep reference for browser and API tests. Loaded on demand from `SKILL.md`.

## Configuration to read first

`playwright.config.js` (or `.ts`) in the Acorn base path or project root. Look for:

- `testDir` (commonly `tests/e2e`), `use.baseURL` and the environment variable that overrides it, `projects`, retries and workers, trace/video settings.
- Whether a gitignored environment file seeds `process.env` (never put real secrets in it or in specs).
- Projects named like "live" or "cleanup": they hit real environments or create real data and must be selected explicitly with `--project`.

## Install and run

Browsers are installed once per machine: `{{runner.node}} run pw:install` if the project defines that script, otherwise the Playwright install command through the runner.

| Goal | Command (through the runner) |
|---|---|
| Headless, whole default project | `{{runner.node}} run pw:test` (or the project's equivalent script) |
| One project | add `--project=<name>` |
| One spec | add the spec path |
| UI mode / headed | on the **host**, from the project folder, not in the container: containers have no display |

Headed runs on the host use the host's Node and browsers, pointed at the same site URL (for Lando, the `*.lndo.site` address). If the project has an environment switch for headed mode, use it (for example a variable read by the config); otherwise pass `--headed`.

## Spec patterns

- **API tests** use Playwright's `request` fixture: no browser launched, fast, good for REST routes. Assert status, JSON shape and cache headers. Keep them next to the endpoint documentation.
- **Page tests** use `page.goto(path)` with relative URLs so `baseURL` decides the environment. Use role- and text-based locators; avoid brittle CSS paths.
- **Block or component showcase pages** (a dev-only route that renders one component with fixtures) give stable targets for visual and behavioural specs.
- **Waits**: wait for a condition (`expect(locator).toBeVisible()`), never a fixed sleep.

## Visual checks

1. Fix the viewport (for example 1440 by 900) and the language/locale in the config or the test.
2. Take element-scoped screenshots (`locator.screenshot()`) of the component under test; full-page screenshots drift with unrelated content.
3. Compare against a stored reference (`toHaveScreenshot`) or against a design export. When comparing to a design, compare layout (columns, alignment), content (exact text), colours, typography, spacing and icons, and report each axis separately with the concrete difference ("3 columns expected, 2 rendered").
4. Update stored references only on purpose, in their own commit, after looking at the diff.

## Environment and caching

- Remote pages may come from an edge or page cache. When results differ from local, read the cache headers on the response before assuming a code problem; if the config supports cache-bypass headers, enable them for the run.
- Never run specs that create accounts, send forms to third parties or write to shared systems against anything but a disposable environment, and only when asked.

## Reporting

State: project and spec(s) run, headless or headed, base URL, pass/fail counts, and any retries. Attach the trace or screenshot path for failures. If the pipeline does not run browser tests, say that local runs are the only pre-merge signal.
