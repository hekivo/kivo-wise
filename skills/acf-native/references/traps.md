# Traps

Deep reference for mistakes seen in real Acorn + ACF projects and how to avoid them. Loaded on demand from SKILL.md.

| Trap | What happens | Do instead |
|---|---|---|
| Re-implementing ACF validation | A custom "can this publish?" endpoint plus `editor.preSavePost` duplicates required / maxlength / max rows and drifts from the field settings | Field settings + `acf/validate_value/key=…`; a server guard only for form-less saves |
| Name-based filters collide | A theme or plugin filters `acf/load_field/name=icon` (or another common name) and rewrites `choices` for every field with that name | Filter by `key=` (runs after `name=`) or avoid generic names when the choices are yours |
| `acf-hidden` wrapper class | Does not hide a field on its own | Code-managed meta (not an ACF field) or `acf/prepare_field` returning `false` |
| `update_post_meta()` unslashes | JSON containing `\"` is corrupted when stored | `update_post_meta($id, $key, wp_slash($value))` |
| ACF Composer field keys | Keys derive from group and field names (`field_<group>_<name>`); renaming a group renames every key and orphans the `_<name>` reference meta | Plan renames with a migration that rewrites `_<name>` |
| Block editor REST save | `wp_insert_post_data` in the REST request sees old meta and refuses a valid first publish | See [save-flow.md](save-flow.md) |
| Request-wide caches | A memoised list is stale for the second post of a bulk edit | Do not memoise state the request can change |
| Persistent object cache | Values survive deploys and direct DB edits | `{{runner.wp}} cache flush` after direct DB changes |
| ACF Composer manifest | Field or block changes do not show after deploy | Clear the ACF Composer cache along with the Acorn caches (`{{runner.cache}}`; see acorn-stack) |
| Assuming ACF on `radicle-app` | `acf/*` hooks silently never fire | Check the plugin list first; use `register_post_meta` and WordPress hooks |
