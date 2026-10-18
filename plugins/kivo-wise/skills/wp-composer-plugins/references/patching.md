# Patching third-party plugins

Deep reference for `cweagans/composer-patches`. Loaded on demand from `SKILL.md`.

## When to patch

Only for a real gap that upstream has not fixed: a bug, a PHP version deprecation, or a library conflict. First check whether a hook, filter or setting of the plugin solves it (native-first); a patch is maintenance debt on every update.

## Install and allow

```bash
{{runner.composer}} require cweagans/composer-patches
```

and in `composer.json`:

```json
"config": { "allow-plugins": { "cweagans/composer-patches": true } }
```

Check which major version resolved: `{{runner.composer}} show cweagans/composer-patches`. The configuration differs.

## Create a patch

1. Work on a throw-away copy of the installed plugin folder (for example `git init` inside it and commit the pristine state).
2. Make the change, then `git diff > patches/<plugin>-<short-reason>.patch` from a path where the diff headers are relative to the plugin root.
3. Remove the temporary `.git` folder. Do not leave a nested repository in the plugin folder.

## Declare it

Version 2.x (list of objects, also what the Roots docs show):

```json
"extra": {
  "patches": {
    "vendor/package-name": [
      { "description": "Why this patch exists", "url": "patches/package-name-fix.patch" }
    ]
  }
}
```

Version 1.x (description mapped to path):

```json
"extra": {
  "patches": {
    "vendor/package-name": {
      "Why this patch exists": "patches/package-name-fix.patch"
    }
  },
  "composer-exit-on-patch-failure": true
}
```

`composer-exit-on-patch-failure` makes an unapplicable patch stop the install instead of continuing silently; keep it on. For 2.x read the package README for how failures are reported before relying on it.

## Apply and verify

`{{runner.composer}} install` applies patches after downloading; the output lists each `Applying patches for ...`. To re-apply after editing a patch, delete the installed package folder and run `{{runner.composer}} install` again.

## Patching a package that lives in an Acorn app's `vendor/`

The patch entry lives in the `composer.json` that owns the dependency (for a nested Acorn application, that application's file, not the site root). Run Composer with `--working-dir` pointing at it.

## Retiring a patch

On each update of the patched package, read the changelog. When upstream ships the fix, delete the patch file and its `extra.patches` entry in the same commit as the update.
