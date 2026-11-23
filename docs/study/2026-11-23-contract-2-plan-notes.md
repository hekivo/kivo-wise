# Planning notes — kivo-wp Compose contract 2 (2026-11-23)

Times are local (UTC-03:00).

## Timeline

| Event | Time |
|---|---|
| Pinned skill copy fixes (#64) enqueued / merged (merge commit 530b1a4) | 20:34:22 / 20:35:32 |
| wp-kit router spec read (S-9 to S-16, decisions D-037 to D-060) | 20:36 |
| Worktree from `origin/main` 530b1a4, spec and plan written | 20:40 |

## Inputs

- wp-kit `docs/specs/2026-11-23-wp-kit-router-design.md` S-14 (requests to kivo-wise) and the decisions
  it rests on (D-034 to D-060, contract bump D-057).
- The runner spec of 2026-11-22 for the shape of `runtime.compose` and for the skill files the change
  touches.

## Findings

- The task brief named the contract decision D-056; in wp-kit's decision log the contract bump is
  D-057 (question Q-056, option `contract-2`) and D-056 is the local devcontainer. The spec cites D-057.
- Today contract 2 is an unknown version: image roles apply, and `app` (Dockerfile, image `kivo-wp/app`)
  loses its `php` role. Shipping before wp-kit 6.1.0 is therefore a gate, not a nicety.
- `testing-wp` and `tailwind-vite-assets` have no Compose content yet (runner plan phase 2); the router
  rows land in the places that phase 2 will extend.
- Nothing in S-14 was ambiguous for kivo-wise: the shape of the `router` report is kivo-wise's own
  choice, and the unverified wp-kit facts (Q-059 `extra_hosts` from containers, Q-060 cloud proxy) are
  written as conditions in the skills, not as facts. No kion question was raised.
- kion keeps one spec per project, so `.kion/` still points at the runner spec; this design is Markdown
  only.
