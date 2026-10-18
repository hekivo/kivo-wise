# Installer paths and mu-plugin loading

Deep reference for `extra.installer-paths`. Loaded on demand from `SKILL.md`.

## The three standard maps

Bedrock layout:

```json
"extra": {
  "installer-paths": {
    "web/app/mu-plugins/{$name}/": ["type:wordpress-muplugin"],
    "web/app/plugins/{$name}/": ["type:wordpress-plugin"],
    "web/app/themes/{$name}/": ["type:wordpress-theme"]
  },
  "wordpress-install-dir": "web/wp"
}
```

Composer-managed WordPress with `wp-content/` at the repository root:

```json
"extra": {
  "wordpress-install-dir": "wp",
  "installer-paths": {
    "wp-content/plugins/{$name}/": ["type:wordpress-plugin"],
    "wp-content/themes/{$name}/": ["type:wordpress-theme"],
    "wp-content/mu-plugins/{$name}/": ["type:wordpress-muplugin"]
  }
}
```

Radicle-style layout (content folder under the public webroot): the same three keys with the prefix `public/content/` and `wordpress-install-dir` set to `public/wp`.

Order matters: Composer applies the first matching rule, so put name-specific rules (a single package forced into mu-plugins) before the generic type rules.

## Forcing a plugin into the mu-plugins folder

Add the package name to the list of the mu-plugin entry:

```json
"web/app/mu-plugins/{$name}/": [
  "type:wordpress-muplugin",
  "wp-plugin/akismet"
]
```

Use this only when the plugin must always be active and must not be deactivated from the admin. Remember that the loader requirement below applies.

## Why a subfolder mu-plugin does nothing

WordPress builds the mu-plugin list by reading the mu-plugins folder and keeping entries that end in `.php`; directories are skipped (`wp_get_mu_plugins`). So `mu-plugins/my-plugin/my-plugin.php` is never included by core. Solutions:

- A loader that scans subfolders (Bedrock's autoloader package, or a tracked top-level PHP file such as a boot file that requires the subfolder entry point).
- A top-level shim file `mu-plugins/my-plugin.php` that requires `my-plugin/my-plugin.php`.

Acorn applications booted from a mu-plugin rely on exactly this: the boot file must be top-level or reached through the loader. Order of loading is alphabetical by file name, so a boot file named with a numeric prefix loads before the others.

## Composer plugin allow-list

Composer 2.2+ refuses to run installer plugins that are not listed. Under `config.allow-plugins` the project needs at least the WordPress core installer used by its layout (for example `roots/wordpress-core-installer`) and `composer/installers`. If an installer is blocked, packages silently fall back to `vendor/`.

## Auditing

- List what Composer thinks is installed: `{{runner.composer}} show --path` (name and absolute path of every package).
- Compare with the folder: a package whose path is under `vendor/` but whose type is `wordpress-plugin` lacks an installer-paths match.
- `{{runner.composer}} validate --strict` catches malformed repository entries.
