#!/usr/bin/env bash
set -euo pipefail
# Seed the workspace with the detector fixture "composer-mu-plugin".
src="$(cd "$(dirname "$0")/../.." && pwd)/test/fixtures/projects/composer-mu-plugin"
cp -R "$src/." .
# Drop a detector cache left in the fixture by local hook runs (git-ignored, stale root).
rm -rf .kivo-wise

# Docs corpus config and a tiny versioned corpus inside the workspace.
cat > .docs-brain.json <<'JSON'
{ "roots": ["docs-corpus"], "locks": ["composer.lock"] }
JSON
mkdir -p docs-corpus/acf/6.8
cat > docs-corpus/INDEX.md <<'MD'
# Corpus index

| path | title | source | version | url | updated |
| --- | --- | --- | --- | --- | --- |
| acf/6.8/acf-validate_value.md | acf/validate_value | acf | 6.8 | https://www.advancedcustomfields.com/resources/acf-validate_value/ | 2026-09-30 |
| acf/6.8/acf-validate_save_post.md | acf/validate_save_post | acf | 6.8 | https://www.advancedcustomfields.com/resources/acf-validate_save_post/ | 2026-09-30 |
MD
cat > docs-corpus/acf/6.8/SUMMARY.md <<'MD'
# ACF 6.8

## Filters
- [acf/validate_value](acf-validate_value.md)
- [acf/validate_save_post](acf-validate_save_post.md)
MD
cat > docs-corpus/acf/6.8/acf-validate_value.md <<'MD'
---
title: acf/validate_value
source: acf
version: "6.8"
url: https://www.advancedcustomfields.com/resources/acf-validate_value/
upstream_modified: 2026-09-12
fetched_at: 2026-09-30
license: proprietary
redistribute: false
---

# acf/validate_value

Fixture page (eval corpus). Filters the validity of a field value before the post is saved.
Callbacks receive `$valid`, `$value`, `$field` and `$input_name`. Returning `true` accepts the
value; returning a string marks it invalid and shows that string as the error for that field.
Variations: `acf/validate_value/type={type}`, `acf/validate_value/name={name}`,
`acf/validate_value/key={key}`. Keep a previous error by returning `$valid` when it is not `true`.
MD
cat > docs-corpus/acf/6.8/acf-validate_save_post.md <<'MD'
---
title: acf/validate_save_post
source: acf
version: "6.8"
url: https://www.advancedcustomfields.com/resources/acf-validate_save_post/
upstream_modified: 2026-09-12
fetched_at: 2026-09-30
license: proprietary
redistribute: false
---

# acf/validate_save_post

Fixture page (eval corpus). Runs once per save after the field values were validated; call
`acf_add_validation_error()` to add a form-level or field-level error.
MD

# Installed ACF source (excerpt of the real filter calls, version from composer.lock).
acf=wp-content/plugins/advanced-custom-fields-pro
mkdir -p "$acf/includes"
cat > "$acf/acf.php" <<'PHP'
<?php
/**
 * Plugin Name: Advanced Custom Fields PRO
 * Version:     6.8.10
 */
// Fixture: header only.
PHP
cat > "$acf/includes/validation.php" <<'PHP'
<?php
// Fixture: excerpt of ACF PRO 6.8.10 includes/validation.php (acf_validate_value).
function acf_validate_value( $value, $field, $input ) {
	$valid   = true;
	$message = sprintf( __( '%s value is required', 'acf' ), $field['label'] );

	if ( $field['required'] ) {
		if ( empty( $value ) && ! is_numeric( $value ) ) {
			$valid = false;
		}
	}

	// @param bool $valid The valid status. Return a string to display a custom error message.
	$valid = apply_filters( "acf/validate_value/type={$field['type']}", $valid, $value, $field, $input );
	$valid = apply_filters( "acf/validate_value/name={$field['_name']}", $valid, $value, $field, $input );
	$valid = apply_filters( "acf/validate_value/key={$field['key']}", $valid, $value, $field, $input );
	$valid = apply_filters( 'acf/validate_value', $valid, $value, $field, $input );

	// allow $valid to be a custom error message
	if ( ! empty( $valid ) && is_string( $valid ) ) {
		$message = $valid;
		$valid   = false;
	}

	if ( ! $valid ) {
		acf_add_validation_error( $input, $message );
		return false;
	}

	return true;
}
PHP
