# Tailwind CSS 4 in Roots projects

Deep reference for CSS-first Tailwind. Loaded on demand from `SKILL.md`. All behaviours below were checked by compiling with Tailwind 4.3.3.

## No `tailwind.config.js`

| v3 config | v4 CSS |
|---|---|
| `content: [...]` | `@source "../views/**/*.blade.php";` (paths relative to the CSS file) |
| `theme.extend` | `@theme { --color-brand: #123456; }` |
| `@tailwind base; components; utilities;` | `@import "tailwindcss";` |
| `important` | `@import "tailwindcss" important;` |
| `prefix: 'tw-'` | `@import "tailwindcss" prefix(tw);` which makes utilities `tw:flex` |

Tailwind 4 detects sources automatically from the project, skipping git-ignored paths. Add `@source` for Blade, PHP and JS that live outside the detected tree or in ignored folders (a plugin's `app/`, another package's views).

## Token namespaces

`@theme` variables use fixed prefixes. A utility exists only if its namespace matches.

| Namespace | Generates |
|---|---|
| `--color-*` | `bg-*`, `text-*`, `border-*`, ... |
| `--font-*` | `font-*` families (`--font-heading` gives `font-heading`) |
| `--text-*` | font sizes |
| `--spacing-*` | `p-*`, `m-*`, `gap-*`, `w-*`, `max-w-*` ... |
| `--container-*` | `max-w-*` container scale, container queries |
| `--max-width-*` | `max-w-*` |
| `--breakpoint-*` | responsive variants |
| `--radius-*`, `--shadow-*`, `--ease-*`, `--animate-*` | corresponding utilities |

`@import "tailwindcss" theme(static);` keeps every theme variable in the output. Without `static`, variables that no utility uses are dropped, so a token you read only from custom CSS (`var(--color-brand)`) can vanish. Use `static` when CSS outside Tailwind reads the variables, and for tokens that WordPress or JS read.

## Validated traps

1. **`--font-family-*` does nothing.** The v3 style name produces no utility; no error. Use `--font-*`.
2. **`max-w-<key>` prefers spacing over container.** With `--spacing-sm: 8px` declared, `max-w-sm` becomes `max-width: var(--spacing-sm)`, even if `--container-sm` is also declared. Order of lookup is `--max-width-*`, `--spacing-*`, `--container-*`. Avoid t-shirt names that exist in both scales; name the container token something else (`--container-narrow`) or declare `--max-width-sm`. Check by grepping the built CSS for `max-width`.
3. **Unlayered rules beat utilities.** `h2 { font-size: ... }` outside any `@layer` wins over `class="text-4xl"` in `@layer utilities`, whatever the specificity. Put base typography in `@layer base`, or use a modifier class defined at the same cascade level. Do not mix both approaches in one project.
4. **`@import` of the main stylesheet in component CSS duplicates everything.** Use `@reference "../app.css";` to get tokens and `@apply` without emitting the stylesheet again.
5. **Dynamic class names are invisible.** `class="col-{{ $n }}"` is never generated. Write complete names, a lookup array, or pass a CSS variable inline and use `grid-cols-[var(--cols)]` once.
6. **Arbitrary values bypass the design system.** Prefer a token. When a value repeats (`bg-[#131313]`), add it to `@theme` and use the token name. Make this a review rule.

## Design tokens

- One source of truth: tokens live in `@theme` (optionally in a partial `_theme.css` imported by both `app.css` and `editor.css` so the editor and the front end match).
- Name tokens by role (`--color-surface`, `--color-accent`), not by value (`--color-dark-gray`).
- Typography and spacing scales belong in tokens too; components then use utilities or `var(--token)`.
- When tokens come from a design tool, write each token with a comment naming its source so a later audit can compare.

## Scoping Tailwind inside someone else's markup

Use this when the CSS ships in a plugin or must not restyle an existing theme.

| Technique | How | Effect |
|---|---|---|
| No reset | Import `tailwindcss/theme.css` and `tailwindcss/utilities.css` instead of `tailwindcss` | The Preflight reset (`box-sizing` and friends) is not emitted, so elements outside your components keep their look. The full import includes Preflight |
| Prefix | `@import "tailwindcss/utilities.css" prefix(tw);` | Classes become `tw:flex`, so they cannot collide with the host's class names |
| Wrapper root | Put component rules under a root class or custom element, with nesting, e.g. `.my-wrapper { ... }` | Rules apply only inside regions you own |
| Layer order | `@layer theme, base, components, utilities;` first, then imports | Predictable cascade between your layers |

Pick the lightest technique that stops the leak. Keep selectors short (two or three nesting levels) and avoid styling bare element selectors outside a wrapper.

## Per-component CSS

```css
@reference "../app.css";

my-card { --card-bg: var(--color-surface); }
my-card .title { @apply text-lg font-semibold; }
```

Name the file after the component so a loader can enqueue it only where used. Declare each component file as a Vite entry (or discover the folder in `vite.config.js`).
