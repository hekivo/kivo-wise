# Private and commercial packages

Deep reference for premium and private WordPress plugins. Loaded on demand from `SKILL.md`.

## Option 1: private Git repository (vcs)

In the plugin repository, a minimal `composer.json`:

```json
{
  "name": "your-org/example-plugin",
  "type": "wordpress-plugin",
  "require": { "php": ">=8.1" }
}
```

Commit the plugin files, tag the release with a semantic version (`git tag 2.9.14`, then push tags). In the site `composer.json`:

```json
"repositories": [
  { "type": "vcs", "url": "git@github.com:your-org/example-plugin.git" }
],
"require": { "your-org/example-plugin": "2.9.14" }
```

Then `{{runner.composer}} update your-org/example-plugin`. CI needs read access to the repository (deploy key or token in the CI secret store).

## Option 2: package repository with a zip from a registry

```json
"repositories": {
  "vendor-example-plugin": {
    "type": "package",
    "package": {
      "name": "your-org/example-plugin",
      "version": "3.4.1",
      "type": "wordpress-plugin",
      "dist": {
        "type": "zip",
        "url": "https://registry.example.com/packages/example-plugin/3.4.1/example-plugin-3.4.1.zip",
        "shasum": "<sha1 of the zip>"
      }
    }
  }
}
```

- `version` is required and is not read from the zip. Bump it for every new upload and never overwrite an existing version at the same URL, or the checksum will fail for everyone who has the old one cached.
- `shasum` is the SHA-1 of the zip (`sha1sum file.zip`). Composer verifies it on install.
- Use a different `name` prefix for third-party vendor plugins than for your own code so a search shows where each came from.
- Registry credentials go in `auth.json` (`http-basic` or `bearer` keyed by host) or in `COMPOSER_AUTH`; keep `auth.json` in `.gitignore`.

## Option 3: local zip

Same as option 2 with `"url": "./packages/example-plugin.zip"` and the zip committed under `packages/`. For mu-plugins use `"type": "wordpress-muplugin"`. Because the path is relative, Composer must run from the directory that contains `packages/`.

## Vendor Composer repositories (for example ACF Pro)

Some vendors run their own Composer endpoint:

```json
"repositories": {
  "acf-pro": { "type": "composer", "url": "https://connect.advancedcustomfields.com" }
}
```

and authenticate with the licence key through `auth.json` (`http-basic` for the vendor host) or `COMPOSER_AUTH`. The require line is then the vendor package name published by that endpoint (for example `wpengine/advanced-custom-fields-pro`). Never print, log or commit the key.

## Choosing

| Situation | Choice |
|---|---|
| One or two private plugins, small team | Option 1 or 2 |
| Many vendor zips, CI needs repeatable downloads | Option 2 with an artifact registry, or Satis/Private Packagist |
| Prototype | Option 3, then move to option 2 before the first deploy |
| Plugin on wordpress.org | wp-packages.org, not any of the above |

## Updating a vendor zip

1. Upload the new zip to the registry under a new version path.
2. Compute the checksum, add or edit the package entry (new `version`, `url`, `shasum`).
3. `{{runner.composer}} update your-org/example-plugin`.
4. Review `composer.lock`, run `{{runner.cache}}`, and check the plugin's own update routine (database upgrades run on the first admin load).
