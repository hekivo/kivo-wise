---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- identifies the Acorn Vite middleware rewriting the manifest to the active theme's public/build because the plugin manifest path does not end with /build
- fixes config/assets.php so the plugin manifest path and url end in build, without adding assets/bundles keys that may not exist
- sets the Vite production base to the plugin's public URL path and keeps the default publicDirectory/buildDirectory
- does not create a tailwind.config.js and does not edit built files by hand
- verifies with Vite::asset() through the runner and by requesting the URL, then rebuilds through lando node
- never suggests running wp/composer/npm outside the runner
