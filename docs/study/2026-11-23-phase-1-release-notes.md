# Release notes — phase 1 of the Compose runner (2026-11-23)

What happened between the last phase 1 merge and the release. Times are local (UTC-03:00).

## Timeline

| Event | Time |
|---|---|
| Component 03 (#62) enqueued / marked merged (3ba0ce0) | 00:56:05 / 00:57:17 |
| release-please run on 3ba0ce0 updated `chore: release main` (#58): kivo-wise 3.2.0, kivo-creator 0.2.0, kivo-rebuild 0.2.0 | 00:58:24 |
| #58 closed and reopened to start its checks | 00:58:38 |
| #58 `Tests` failed (`test/rebuild/manifests.test.mjs`, "release-please knows the package") | 00:59:04 |
| Fix branch opened from `origin/main` 3ba0ce0 | 00:59:51 |

Component 03 took 12 minutes from branch to merge (00:44:53 to 00:57:17).

## CI failures and fixes

1. **release-please timed out once.** The run after component 01 failed with "The request is taking too
   long to generate" from the commits API while backfilling file lists. The next push re-ran it and it
   passed; no action needed.
2. **The release pull request had no checks.** release-please opens and updates it with the workflow
   token, and events from that token start no workflows. Closing and reopening it as a person started
   the `pull_request` checks.
3. **A test pinned a released version.** `test/rebuild/manifests.test.mjs` asserted that
   `.release-please-manifest.json` holds `0.1.0` for kivo-rebuild, so every release of that package
   fails `Tests`. The assertion now compares the manifest with the plugin's `.claude-plugin/plugin.json`,
   and `test/release-manifest.test.mjs` checks the same parity for every release-please package. Both
   pass on `main` and on the release branch (checked by laying the release branch files over this
   change locally).

## Improvements found

- Run release-please with a GitHub App token so its pull request runs the required checks without a
  manual close and reopen.
- The changelog lists every feature twice (the merge commit and the branch commit carry the same
  conventional title). Squash merges, or merge commits titled differently from the branch commits,
  would give one entry per change.
- Version literals in tests turn every release into a CI failure; a lint over `test/` for semver
  literals next to manifest reads would catch the pattern.
