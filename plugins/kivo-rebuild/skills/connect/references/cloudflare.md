# Cloudflare

Cloudflare serves two purposes in a rebuild: DNS records for verification (Search Console), and an Access service token that lets the survey reach a protected staging host.

## Prerequisites

- `cloudflare.zone_id` in `.rebuild/config.json` (the zone's Overview page, right column).
- An API token with these permissions, created in My Profile > API Tokens: Zone > Zone > Read (read test), Zone > DNS > Edit (verification records), Account > Access: Service Tokens > Edit (staging access token). Give it the narrowest zone and account.
- The token lives in 1Password. Reference it in an env file and run scripts under `op run`:

  ```
  CLOUDFLARE_API_TOKEN=op://Engineering/cloudflare-token/credential
  ```

  `cloudflare.token_ref` in the config records the reference for the next person. The scripts read only the environment variable.
- `op` signed in with write access to the vault that will hold the staging token.

## Paths

1. **MCP.** Not used for this source.
2. **API.** `op run --env-file=<file> -- node <root>/scripts/connect.mjs --project=. --only=cloudflare`.
3. **Manual.** Create the DNS record and the service token in the Cloudflare dashboard; put the token in 1Password with the field labels below.

## Read test

A `GET` of the zone. It passes on HTTP 200, with the identity `api token`.

## Human steps

- `CLOUDFLARE_API_TOKEN not set`: the script ran outside `op run`.
- `HTTP 403`: the token lacks the Zone Read permission or does not cover this zone.
- Allow the service token through the staging application: Zero Trust > Access > Applications > the staging application > Policies > add a policy with the action Service Auth that includes this service token. Creating the token alone does not open the host.

## Setup actions

| Operation | Params | Result | Undo |
|---|---|---|---|
| `createTxtRecord` | `zone`, `name`, `content` | `record` (id) | DNS > Records > delete the TXT record |
| `createAccessServiceToken` | `account`, `name`, `vault`, `duration` (optional, default `8760h`) | `client_id`, `stored` (`op://<vault>/<name>`) | Zero Trust > Access > Service Auth > delete the token, and delete the 1Password item |

`createTxtRecord` takes the verification token from an earlier action:

```json
{ "id": "A2", "provider": "cloudflare", "op": "createTxtRecord", "resource": "example.test DNS",
  "params": { "zone": "<zone id>", "name": "example.test", "content": { "$from": "A1.token" } },
  "change": "Adds the Search Console verification record", "undo": "Delete the TXT record" }
```

### How the service token secret is handled

Cloudflare returns the client secret once, when the token is created. `createAccessServiceToken` keeps it in memory and writes it to 1Password as a JSON item template on the standard input of `op item create --vault <vault> -`. The secret is never in a command line, a file, a log, the plan or the result. The item has the title `<name>`, the category API Credential, a field `CF-Access-Client-Id` and a concealed field `CF-Access-Client-Secret`.

If 1Password refuses the item after Cloudflare created the token, the secret is lost. The error names the orphaned client id: delete that token in Zero Trust > Access > Service Auth, fix `op` access, and run `setup-apply.mjs` again.

Afterwards set `staging_access.headers_ref` in the config to `op://<vault>/<name>`. The survey scripts then read both headers from that item at run time and send them with every staging request. The vault name must not contain a slash.
