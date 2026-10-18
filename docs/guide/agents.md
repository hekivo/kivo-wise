# Agents

Agents are read-only specialists that Claude starts in an isolated context. They are named `kivo-wise:<name>`. None of them writes code.

| Agent | Use it for |
|---|---|
| `acorn-reviewer` | An independent convention review of a diff or folder, with a fixed report and file:line findings |
| `livewire-debugger` | A Livewire 4 component that fails to mount, update, validate or dispatch, including stale cached HTML after a deploy |
| `roots-architect` | Mapping what exists, applying the native-first check and returning a decision record placed in the active profile's folders |
| `tailwind-v4-auditor` | A Tailwind 4 audit: v3 leftovers, arbitrary values, class strings built in PHP, cascade and core stylesheet conflicts |

Ask for one by name ("run the acorn-reviewer on this diff") or let a skill dispatch it: `roots-reviewing` uses `acorn-reviewer`, `roots-debugging` uses `livewire-debugger` for Livewire problems.
