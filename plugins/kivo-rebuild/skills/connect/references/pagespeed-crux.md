# PageSpeed and CrUX

PageSpeed Insights gives a lab score and, when Google has enough traffic data, real-user field data (CrUX) for the page and its origin. The survey records it as the live site's baseline.

## Prerequisites

- `live` in `.rebuild/config.json`.
- Anonymous calls work but are rate limited. For more than a few pages, create an API key: Google Cloud console > APIs & Services > Credentials > Create credentials > API key, restricted to the PageSpeed Insights API. Store it in 1Password and reference it from an env file:

  ```
  PAGESPEED_API_KEY=op://Engineering/pagespeed-key/credential
  ```

  Run the script as `op run --env-file=<file> -- node <root>/scripts/connect.mjs --project=. --only=pagespeed`. Never export the value in the shell and never put it in a command line.

## Paths

1. **MCP.** Not used for this source.
2. **API.** The read test calls `runPagespeed` for the live URL, mobile strategy, performance category, with the key when `PAGESPEED_API_KEY` is set.
3. **Manual.** Open pagespeed.web.dev for the home page and two high-traffic templates, mobile and desktop, and copy the numbers below by hand.

## Read test

One `runPagespeed` call for the live URL. It passes on HTTP 200. The identity is `api key` or `anonymous`. Errors never include the key.

## Human steps

- `HTTP 429`: the anonymous quota is used up; create the key and run under `op run`.
- Field data missing for a page: Google has too little traffic for that URL; use the origin-level data or a higher-traffic page.

## What to record

For the home page and one sample of each high-traffic template, on mobile and desktop: LCP, INP and CLS from the field data (CrUX) when present, and the lab performance score. Write them in the run's notes for the review; they are the baseline the new site is compared with in later slices. The CrUX API itself (`chromeuxreport.googleapis.com`) is not called by the scripts in this slice.
