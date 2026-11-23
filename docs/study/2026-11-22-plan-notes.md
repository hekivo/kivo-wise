# Plan notes — Compose `bin/` runner support (2026-11-22)

Third pass, after the owner approved S-1 to S-8: the component plan. Earlier passes are in
`2026-11-22-planning-notes.md`.

## Impediments

1. **kion has no place for a graduated plan's outline.** A component needs at least one acceptance
   criterion, so later phases cannot be stored in `plan.json` as outlines. They live as prose in the root
   `plan.md`, which `kion validate` does not check, and `kion next` cannot tell that phase 2 is still to be
   detailed.
2. **The names check covers only prefixed tokens.** With `names.prefixes: [kivo-wise]` the validator checks
   `kivo-wise:…`, `kivo-wise-…` and `kivo-wise/…`. The shared names of this plan (`compose-wp`,
   `runtime.compose`, `sessionKind`, fixture paths) were registered anyway, but a typo in one of them would
   pass validation. A hook reason that starts with the plugin prefix also trips the check, because the
   token `kivo-wise:` matches the prefix pattern.
3. **Two components touching the same goldens cannot run in parallel.** The session-start goldens print
   every route in `routing.json`, so adding the `compose-wp` route changes the same files the runner-line
   component rewrites. The skill component was moved to its own batch after the hooks component.
4. **The spec header is stale.** The spec file still says "Status: draft. No section is approved" while
   `.kion/spec.json` records all eight sections approved. The header was left as is because editing an
   approved spec is the owner's call.

## Improvements found

### kivo-kion

- Allow a phase record (`phase`, `goal`, `sections`, `depends`, `open`) without components, so a
  graduated plan's outline is state, rendered and checked like the rest.
- `kion next` could say "phase N closed; detail phase N+1" when every component of a phase is done.
- An option to check unprefixed registered names: any backticked token that looks like a registered name
  but is not one exactly (edit distance 1) could be a warning.
- A `files` field on a component would let the validator flag two components of the same batch that edit
  the same path.

### kivo-wise

- The session-start skills line grows with every new skill; it is clamped last, but the list is already
  close to the 1,500-character budget on a Lando project. A runner-aware list (show `compose-wp` or
  `lando-wp`, not both) would save room.
- The prompt router hook matches keywords without the runner, so shared terms (`xdebug`, `db-import`)
  cannot route to the right runner skill. Passing `runtime.runner` to the hook's match would fix that.
- The hooks in the Codex mirror cannot import the detector (`scripts/` is not mirrored), so the session
  kind is implemented twice and held together by a parity test.
