---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- identifies double escaping: a WordPress esc_url() wrapped in Blade {{ }} (e() with double encoding)
- fixes with {!! esc_url($url) !!} or plain {{ $url }}, never both, and uses $attributes->merge([...], false) when the merged value comes from esc_url()
- adds or points to a guard test that fails on {{ esc_*() }} in the plugin resources/views, run through the test runner
- does not replace the escaping with unfiltered {!! $url !!}
- never suggests running wp/composer outside the runner
