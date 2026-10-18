---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only.

Judge the substance, not the wording. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing or any is contradicted. The response must be in English.

- reads functions.php and the files under inc/ and finds register_post_type, add_action, add_filter, global $wpdb and WP_Query usages
- notes the classic template files (page.php, single.php) as candidates for Blade
- produces numbered phases ordered by risk, each item naming the source WordPress pattern and its Acorn replacement
- includes a section for patterns that should stay plain WordPress
- does not invent Acorn classes or methods that do not exist
