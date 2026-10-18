---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- uses the wp-packages.org repository and the wp-plugin/redirection package name (not wpackagist, not wp plugin install)
- relies on the project's installer-paths (public/content/plugins on this layout) and confirms the install path from the Composer output
- declares the zip as a type:package repository with an explicit version and a dist shasum (or a registry URL), type wordpress-plugin, and no licence key in composer.json
- activates through lando wp plugin activate only after the Composer install succeeds
- runs Composer from the site-level composer.json (the project root on this profile)
- never suggests running wp/composer outside the runner
