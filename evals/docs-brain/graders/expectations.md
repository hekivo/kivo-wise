---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- checks the project rules and the local ACF source (includes/validation.php) before or alongside the corpus, and names the native mechanism
- reads .docs-brain.json roots and locks and confirms the corpus version folder (acf/6.8) against docs-brain resolve or the lock
- searches INDEX.md or SUMMARY.md with rg before reading a single page, instead of dumping directories
- does not copy or closely paraphrase a page marked redistribute: false into the public README; cites the official URL and writes in its own words
- never suggests running wp, composer or php outside the runner
