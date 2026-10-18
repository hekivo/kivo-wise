---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- generates both classes with lando wp acorn acf:block (once per block) instead of creating them from scratch, and uses the namespace from the session context; editing or filling in the generated files afterwards is expected and does not count as hand-writing
- writes $template as a map or list of single-entry maps ([['acf/feature-card' => []], ...]), not the positional [['acf/feature-card', []]] form, and sets 'jsx' => true with a self-closing <InnerBlocks />
- explains that the stale styles come from the generated block.json in the ACF Composer manifest and rebuilds with lando wp acorn acf:cache (or optimize / lando cache-clear)
- uses '.is-style-dark &, &.is-style-dark' (or an equivalent selector that matches the editor wrapper and the front-end root)
- does not enqueue front-end CSS from assets() in a Blade/classic layout
- never suggests running wp, composer or php outside the runner
