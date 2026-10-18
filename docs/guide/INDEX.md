# Kivo Wise

kivo-wise is a plugin for AI assistants working on WordPress sites built on the Roots stack. It detects the project profile (`sage-theme`, `acorn-mu-plugin` or `radicle-app`), loads a short factual context at session start, and routes each request to one profile-aware skill. All project commands run through the project's runner (Lando).

For installation and setup, see the [README](../../README.md).

## Which skill for which task

`roots-router` makes this choice for you; this table is the same map.

| If you want to... | Skill |
|---|---|
| Know what kind of project this is | `roots-triage` |
| Get a map of an unfamiliar project | `roots-onboarding` |
| Change providers, composers, Blade, config | `acorn-stack` |
| Create a block, post type, field group or provider | `acorn-scaffolding` |
| Work with ACF validation, save flow or admin JS | `acf-native` |
| Add a Livewire component | `acorn-livewire` |
| Add a route or JSON endpoint | `acorn-routes-api` |
| Run work in the background, cache or log | `acorn-background` |
| Store data with Eloquent or migrations | `acorn-data` |
| Place a hook correctly | `wp-hooks-lifecycle` |
| Escape output, check input and permissions | `wp-security-escaping` |
| Fix Vite, Tailwind or asset problems | `tailwind-vite-assets` |
| Install a plugin with Composer | `wp-composer-plugins` |
| Run or write tests | `testing-wp` |
| Find the cause of a broken page | `roots-debugging` |
| Review a diff before the merge request | `roots-reviewing` |
| Look up official documentation | `docs-brain` |
| Run a command in Lando | `lando-wp` |

## Reference

| Page | What it covers |
|---|---|
| [skills.md](skills.md) | The 22 skills and the third-party skills |
| [agents.md](agents.md) | The four read-only agents |
| [commands.md](commands.md) | `/roots-detect` and `/roots-status` |
| [hooks.md](hooks.md) | What each hook does and how to debug it |
| [token-efficiency.md](token-efficiency.md) | How the plugin keeps its context small |
| [troubleshooting.md](troubleshooting.md) | Environment problems: symptom, cause, fix |
| [provenance.md](../provenance.md) | Where each skill's content came from |
