# GA4

GA4 supplies sessions and key events per page path. It is also where the new site's property, web stream and key events are created.

## Prerequisites

- The numeric property id in `ga4.property_id` (Admin > Property settings > Property ID).
- A service account in `ga4.service_account` and the Token Creator role for the operator on it. Token minting, scopes and the fallback rules are in `gsc.md`.
- The Google Analytics Data API (read) and Google Analytics Admin API (setup) enabled in the service account's project:

  ```bash
  gcloud services enable analyticsdata.googleapis.com analyticsadmin.googleapis.com --project=acme-proj
  ```

## Paths

1. **MCP.** When a GA4 MCP server is connected, run its report for the dimension `pagePath` and the metrics `sessions` and `keyEvents`. This slice only records that the MCP source answered; the join of GA4 numbers into `signals.json` uses the API.
2. **API.** `node <root>/scripts/ga4.mjs --project=.` runs the Data API `runReport` for `pagePath` with `sessions` and `keyEvents`, 100,000 rows per page, over the last 16 months by default.
3. **Manual.** Not supported for GA4 numbers in this slice. Skip the source; the inventory does not need it to decide.

## Read test

A `runReport` for the last seven days with the `sessions` metric and one row.

## Human steps

- `HTTP 403`: Admin > Property access management > Add > the service account's e-mail > role Viewer.
- Unknown property: check `ga4.property_id` is the number only, without `properties/`.
- For setup: the service account needs the Editor role on the account (Admin > Account access management) and the person who plans the setup must know the account number.

## Setup actions

Setup uses the write scope `analytics.edit`.

| Operation | Params | Result | Undo |
|---|---|---|---|
| `createProperty` | `account`, `displayName`, `timeZone`, `currencyCode` | `property` (`properties/<id>`) | Admin > Property settings > Move to trash can |
| `createWebStream` | `property`, `displayName`, `defaultUri` | `stream`, `measurementId` | Admin > Data streams > the stream > Delete |
| `createKeyEvent` | `property`, `eventName` | `keyEvent` | Admin > Key events > turn the event off |

`createWebStream` and `createKeyEvent` take the property from the action that created it:

```json
{ "id": "A2", "provider": "ga4", "op": "createWebStream", "resource": "new property",
  "params": { "property": { "$from": "A1.property" }, "displayName": "Acme Store web", "defaultUri": "https://www.example.test" },
  "change": "Creates the web data stream", "undo": "Delete the stream in Admin > Data streams" }
```

The reference is resolved when the plan is applied, from the result of `A1`; a reference to a later or unknown action is rejected by `setup-plan.mjs`. Copy the live site's key event names (Admin > Events > Key events) into one `createKeyEvent` action each. The measurement id in the result goes into the new site's tag configuration; it is not a secret.
