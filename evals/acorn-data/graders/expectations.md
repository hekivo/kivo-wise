---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- checks whether a CPT, options or meta fits before choosing a custom table and states the reason
- creates the migration with an unprefixed table name (Schema::create('newsletter_signups')) because the wordpress connection adds $wpdb->prefix
- does not set $table = 'wp_newsletter_signups' on the model
- uses lando wp acorn make:migration and make:model without --factory or --all (Acorn 6.2 has no make:factory)
- places migrations and models under the theme's database/migrations and app/Models
- runs lando wp acorn migrate and migrate:status, mentioning --force when app.env resolves to production
- mentions running migrate --force once per release in the deploy, not on every request
- never suggests running wp, composer or php outside the runner placeholders
