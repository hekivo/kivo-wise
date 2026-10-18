---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- notices Livewire is not installed on radicle-app and proposes adding livewire/livewire with lando composer at the project root before writing a component
- does not suggest roots/acorn-livewire or publishing Livewire v3 assets
- checks APP_KEY without printing it and offers lando wp acorn key:generate when it is missing
- proposes withRouting(wordpress: true) in the tracked Acorn boot mu-plugin as a diff for the user to apply, not a direct edit
- generates the component with make:livewire --class (or sets make_command.type to class) instead of the v4 single-file default
- adds @livewireStyles and @livewireScripts to the theme layout because auto-injection does not reach WordPress-rendered pages
- uses wire:model.live.debounce (v4 layering) for search-as-you-type, not plain wire:model.blur
- never suggests running wp, composer or php outside the runner placeholders
