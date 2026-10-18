# ACF JavaScript API

Deep reference for the ACF JS API in admin and block-editor scripts. Loaded on demand from SKILL.md.

Source of truth: `plugins/advanced-custom-fields-pro/assets/build/js/acf-input.min.js` and `acf.min.js` (minified; search for the action or filter name). Build admin scripts with the project's Vite setup and enqueue them from PHP on `acf/input/admin_enqueue_scripts`, with `acf-input` as a dependency. Prefer vanilla JS; the ACF API itself returns jQuery objects where noted.

## Fields

```js
const field = acf.getField('field_external_id');      // by key
field.val();                                         // read
field.val('123');                                    // write (triggers change)
field.on('change', 'select', () => {});
acf.getFields({ parent: $row, name: 'eyebrow' });    // sub fields of a repeater row
```

## Lifecycle actions

ACF builds `<action>_field` plus `/type=`, `/name=` and `/key=` variants for each field lifecycle action (`ready`, `load`, `append`, `remove`, `show`, `hide`, …).

| Action | When |
|---|---|
| `ready` | ACF finished initialising the page |
| `ready_field/key=<key>` | a field is ready |
| `append` / `new_field` | new markup added (repeater row, block) |
| `show_field` / `hide_field` | conditional logic toggled a field |
| `validation_begin` | ACF starts validating the form |
| `invalid_field` / `valid_field` | a field got or lost an error |

## Filters

| Filter | Use |
|---|---|
| `select2_args` `(args, $select, settings, field)` | `templateResult` / `templateSelection`, `ajax.transport` to your own endpoint |
| `select2_ajax_data` | extra params for ACF's own select2 AJAX |
| `validation_complete` `(json, $form)` | inspect or adjust the AJAX validation result |

## Repeater

```js
const repeater = acf.getField('field_content_stages');
const $row = repeater.add();                 // returns the new row (jQuery)
repeater.$rows();                            // current rows (jQuery)
repeater.remove(window.jQuery(rowElement));  // expects a jQuery row
```

## Block editor

- ACF wraps `wp.data.dispatch('core/editor').savePost`: it validates over AJAX only when the edited status is `publish` or `future`, and returns early for autosave and preview. Do **not** add `wp.hooks.addFilter('editor.preSavePost', …)` to validate ACF fields; use `acf/validate_value` on the server.
- Notices: `wp.data.dispatch('core/notices').createNotice(...)`.
