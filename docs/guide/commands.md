# Commands

Two slash commands ship with the plugin. Both only run the detector and report; neither changes project code.

## `/roots-detect`

Runs `scripts/detect-roots-project.mjs` and shows the layout, every Acorn app with its profile, the active app, the runner and the warnings. With `--write` it saves `{ profile, app, runner }` to `.roots-stack.json` at the project root, asking before it overwrites a different flag. Use it when the detection is wrong or to pin the profile.

```
/roots-detect
/roots-detect --write
/roots-detect --path=../other-project
```

## `/roots-status`

Prints at most 20 lines: layout, profile, namespace, flag file, WordPress/PHP/Acorn versions, runner commands, service health (Lando or DDEV) and the detector warnings. Use it when something looks off at the start of a session.
