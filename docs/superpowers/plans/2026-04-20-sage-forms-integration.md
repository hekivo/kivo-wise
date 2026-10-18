> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Sage Forms Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-deliverable sage-forms system — a reference skill (knowledge), a user-invocable specialist agent (refactor + scaffold), and a Phase 0c extension in block-scaffolding (coordinated scaffold on form detection).

**Architecture:** The `sage-forms` skill is the single source of truth for HTML Forms + Sage integration patterns. Both the `forms` agent and `block-scaffolding` Phase 0c consume it. Tasks build the skill first (no consumers can work without it), then the agent, then the block-scaffolding extension. All artefacts are Markdown files with YAML frontmatter — no runtime code changes.

**Tech Stack:** Markdown `SKILL.md` / agent files with plugin-namespace frontmatter. Consumed by Claude Code, VS Code Copilot, and Cursor agents at runtime.

---

## File Structure

```
skills/sage-forms/
  SKILL.md                              # entry point; short summaries + references
  references/
    installation.md                     # composer commands + auto-discovery
    blade-form-views.md                 # ACF block field + Blade view + x-form.*
    hf-validation.md                    # JS module API + layers + error injection
    traps.md                            # T1 pattern escape, T2 type=tel, T3 ValidityState

agents/
  forms.md                              # superpowers-sage:forms specialist agent

skills/block-scaffolding/SKILL.md       # MODIFIED — insert Phase 0c + Phase 4 conditional
```

One skill directory, one agent file, one extension to an existing skill. No test directories (documentation-only changes). Verification per task is "read the file back and confirm expected anchors are present".

---

## Task 1: `skills/sage-forms/SKILL.md` (entry point)

**Files:**
- Create: `skills/sage-forms/SKILL.md`

- [ ] **Step 1.1: Verify parent directory does not yet exist**

Run: `ls skills/sage-forms 2>&1`
Expected: `ls: cannot access 'skills/sage-forms': No such file or directory`

- [ ] **Step 1.2: Create `skills/sage-forms/SKILL.md`**

Write the file with exactly this content:

````markdown
---
name: superpowers-sage:sage-forms
description: >
  HTML Forms + Sage integration — log1x/sage-html-forms, hf_get_form,
  addPostObject html-form, Blade form views, x-form.* shared components,
  hf-validation JS module, hf-success hf-error hf-submitted events,
  Constraint Validation API, form traps pattern escaping type-tel
  ValidityState non-enumerable — stateless contact forms with progressive
  JS validation on top of the HTML Forms WordPress plugin.
user-invocable: false
---

# HTML Forms + Sage Integration

Stateless form rendering via the HTML Forms WordPress plugin, bridged into Sage by `log1x/sage-html-forms`. Forms live as a CPT (`html-form`), are referenced from ACF blocks via `addPostObject`, and render through a Blade filter that routes to project-controlled form views.

## When to Use

| Approach | Best for |
|---|---|
| **HTML Forms + sage-html-forms** | Stateless contact/lead forms; editors pick the form from a dropdown; submissions handled by the HF plugin |
| **Livewire form** | Reactive state, multi-step wizards, inline validation tied to server state |
| **Blade + native `<form>`** | Single-field or trivial forms with no submission pipeline |

## When NOT to Use

- Form requires multi-step state → use Livewire (`acorn-livewire` skill)
- Form payload drives a Laravel controller action → Acorn Routes + Blade form, not HTML Forms
- Form must be embedded outside a block context (e.g. header newsletter) → Blade component + native `<form>` is simpler

## Prerequisites

- Sage 11+ / Acorn 4+ on Bedrock with Lando
- ACF Composer installed (for the block field declaration)
- Shared `x-form.*` components present in `resources/views/components/form/` (the design-system form primitives)

## Installation Summary

```bash
lando composer require wpackagist-plugin/html-forms
lando theme-composer require log1x/sage-html-forms
```

Acorn's package discovery auto-registers the service provider — no manual wiring. Full details: [references/installation.md](references/installation.md).

## Integration Pattern Summary

The form is a `html-form` CPT post. A block exposes an ACF `addPostObject` field scoped to that CPT so the editor picks the form. The block view renders it via `hf_get_form($form->ID)->get_html()`, which the sage-html-forms provider intercepts and routes to a Blade view at `resources/views/forms/{form-slug}.blade.php`. The Blade form view uses the project's `x-form.*` components.

```blade
{{-- Block view (snippet) --}}
@if ($form)
    {!! hf_get_form($form->ID)->get_html() !!}
@endif
```

```blade
{{-- resources/views/forms/{form-slug}.blade.php --}}
<x-html-forms :form="$form">
    <x-form.field label="Name" for="name" :required="true">
        <x-form.input type="text" name="name" :required="true" minlength="2" />
    </x-form.field>
    {{-- ...more fields... --}}
    <x-button type="submit" variant="primary" class="w-full">Send</x-button>
</x-html-forms>
```

Full walkthrough: [references/blade-form-views.md](references/blade-form-views.md).

## Validation Module Summary

Client-side validation is a reusable ES module imported by the block's JS — never globally enqueued. The module exposes one function:

```js
initHfValidation(formEl, { messages, validators, onSuccess, onError });
```

Four layers: native HTML5 constraints, `blur` validation, `input` lazy re-validation while `aria-invalid="true"`, and post-submit scroll via the HTML Forms plugin's DOM events (`hf-success`, `hf-error`, `hf-submitted`).

Full API and implementation: [references/hf-validation.md](references/hf-validation.md).

## Traps (Critical)

Three documented bugs that silently break forms in this stack. Full symptom/root cause/fix for each: [references/traps.md](references/traps.md).

- **T1 — `pattern` attribute backslash escaping in Blade components.** `$attributes->merge()` double-escapes backslashes; `patternMismatch` never fires. Workaround: use a JS validator, not a `pattern` attribute.
- **T2 — `type="tel"` skips `patternMismatch` in Chrome.** Use `type="text" inputmode="tel"` instead.
- **T3 — `ValidityState` is non-enumerable.** Never spread with `{ ...field.validity }`. Access properties directly.

## File Map (canonical per form integration)

| File | Role |
|---|---|
| `app/Blocks/{ClassName}.php` | ACF block — `addPostObject` field + `with()` mapping |
| `resources/views/blocks/{slug}.blade.php` | Block view — calls `hf_get_form($form->ID)->get_html()` |
| `resources/views/forms/{form-slug}.blade.php` | Form view — `x-html-forms` + `x-form.*` structure |
| `resources/js/blocks/{slug}.js` | Block custom element — imports `initHfValidation`, configures per form |
| `resources/js/modules/hf-validation.js` | Reusable validation module (one per project, not per form) |

## Consumers

- `agents/forms.md` (user-invocable specialist — analyzes and refactors existing forms, or scaffolds new ones)
- `skills/block-scaffolding/SKILL.md` Phase 0c (coordinated scaffold when a block embeds a form)

Both consumers treat this skill as authoritative — no pattern, template, or trap is documented outside this skill.
````

- [ ] **Step 1.3: Verify file created with expected anchors**

Run: `grep -c "^##" skills/sage-forms/SKILL.md`
Expected: `9` (nine H2 sections: When to Use, When NOT to Use, Prerequisites, Installation Summary, Integration Pattern Summary, Validation Module Summary, Traps (Critical), File Map, Consumers)

Run: `grep -c "references/" skills/sage-forms/SKILL.md`
Expected: `4` (one pointer to each of the four reference files)

- [ ] **Step 1.4: Commit**

```bash
git add skills/sage-forms/SKILL.md
git commit -m "feat(skills): add sage-forms SKILL.md entry point"
```

Expected: commit succeeds.

---

## Task 2: `skills/sage-forms/references/installation.md`

**Files:**
- Create: `skills/sage-forms/references/installation.md`

- [ ] **Step 2.1: Create the file**

Write with exactly this content:

````markdown
# sage-forms — Installation

Detailed installation of HTML Forms + sage-html-forms on a Sage/Acorn/Bedrock/Lando project.

## 1. Install the WordPress plugin (via Bedrock Composer)

```bash
lando composer require wpackagist-plugin/html-forms
```

This adds the plugin to `composer.json` at the Bedrock root and places it under `web/app/plugins/html-forms/`. Activate it via the admin UI or WP-CLI:

```bash
lando wp plugin activate html-forms
```

Verify activation:

```bash
lando wp plugin list --status=active | grep html-forms
```

Expected: one row with `html-forms` and status `active`.

## 2. Install the Sage bridge

```bash
lando theme-composer require log1x/sage-html-forms
```

`composer.json` in the theme now contains:

```json
"log1x/sage-html-forms": "^1.1"
```

## 3. Verify Acorn auto-discovery

The bridge package ships a Service Provider that Acorn discovers automatically — there is no manual `config/app.php` edit. Confirm the provider is active:

```bash
lando acorn about
```

Look for `Log1x\SageHtmlForms\Providers\SageHtmlFormsServiceProvider` in the "Providers" section. If present, the filter `hf_form_html` is registered and `hf_get_form($id)->get_html()` calls will route to `resources/views/forms/{form-slug}.blade.php`.

## 4. Confirm the filter is registered

```bash
lando wp eval "var_dump(has_filter('hf_form_html'));"
```

Expected: `int(10)` (priority 10). If `false`, the bridge did not boot — run `lando flush` and re-check. If still `false`, the theme's `config/app.php` may be suppressing package discovery (rare; investigate `Theme` key).

## 5. Create the first `html-form` CPT post

Use WP-CLI or the admin UI. With WP-CLI:

```bash
lando wp post create \
  --post_type=html-form \
  --post_title="Contact" \
  --post_name=contact \
  --post_status=publish
```

The post's slug (`contact`) becomes the Blade view filename: `resources/views/forms/contact.blade.php`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `hf_get_form()` is undefined | HTML Forms plugin not active | `lando wp plugin activate html-forms` |
| Form renders as plain HTML, not the Blade view | `hf_form_html` filter not registered | Run `lando flush`; verify provider via `lando acorn about` |
| `class not found: SageHtmlFormsServiceProvider` | Vendor autoload stale | `lando theme-composer dump-autoload` |
| Blade view updates not reflected | Blade cache | `lando flush` (clears Acorn + Blade + OPcache) |

## References

- [htmlformsplugin.com](https://htmlformsplugin.com/) — plugin documentation and submission pipeline
- [log1x/sage-html-forms on GitHub](https://github.com/Log1x/sage-html-forms) — bridge source
````

- [ ] **Step 2.2: Verify file created**

Run: `grep -c "^## " skills/sage-forms/references/installation.md`
Expected: `6` (six H2 sections)

- [ ] **Step 2.3: Commit**

```bash
git add skills/sage-forms/references/installation.md
git commit -m "feat(skills): add sage-forms installation reference"
```

Expected: commit succeeds.

---

## Task 3: `skills/sage-forms/references/blade-form-views.md`

**Files:**
- Create: `skills/sage-forms/references/blade-form-views.md`

- [ ] **Step 3.1: Create the file**

Write with exactly this content:

````markdown
# sage-forms — Blade Form Views

Complete pattern for rendering forms via Blade using HTML Forms + sage-html-forms. Covers the block field declaration, `with()` mapping, block view, form Blade view, and shared `x-form.*` component usage.

## Block Field Declaration

In the block's controller (`app/Blocks/{ClassName}.php`), declare a single `addPostObject` field scoped to the `html-form` CPT:

```php
public function fields(): array
{
    $fields = Builder::make('{slug}');

    $fields
        ->addPostObject('form', [
            'label'         => __('Form', 'sage'),
            'post_type'     => ['html-form'],
            'return_format' => 'object',
        ]);

    return $fields->build();
}
```

Key choices:

- `post_type` is `['html-form']` — scopes the dropdown to form posts only
- `return_format` is `'object'` — the view receives a `WP_Post` object, not an ID
- The field name is `form` — convention for every form-embedding block

## `with()` Mapping

Pass the form post to the view:

```php
public function with(): array
{
    return [
        'form' => get_field('form') ?: null,
    ];
}
```

The `?: null` fallback keeps the block renderable in the editor before the editor picks a form.

## Block View

Guard and render:

```blade
{{-- resources/views/blocks/{slug}.blade.php --}}
@if ($form)
    {!! hf_get_form($form->ID)->get_html() !!}
@endif
```

Required patterns:

- `@if ($form)` guard — avoids a fatal if the editor has not selected a form yet
- `{!! ... !!}` unescaped output — the HTML Forms plugin already renders sanitized markup
- No form-specific HTML in the block view — the form view owns that markup

## Form Blade View

The sage-html-forms bridge routes rendering to `resources/views/forms/{form-slug}.blade.php`, where `{form-slug}` is the `post_name` of the selected `html-form` post.

```blade
{{-- resources/views/forms/contact.blade.php --}}
<x-html-forms :form="$form">
    <x-form.field label="Name" for="name" :required="true">
        <x-form.input type="text" name="name" placeholder="Your full name" :required="true" minlength="2" />
    </x-form.field>

    <x-form.field label="WhatsApp" for="phone" :required="true">
        <x-form.input type="text" inputmode="tel" name="phone" placeholder="(00) 00000-0000" :required="true" />
    </x-form.field>

    <x-form.field label="Project type" for="project_type">
        <x-form.input type="text" name="project_type" placeholder="Residential, commercial, automation..." />
    </x-form.field>

    <x-form.field label="Message" for="message">
        <x-form.textarea name="message" placeholder="Tell us about your project..." :rows="5" />
    </x-form.field>

    <x-button type="submit" variant="primary" class="w-full">Submit</x-button>
</x-html-forms>
```

## `x-form.*` Component Catalogue

The design system provides form primitives in `resources/views/components/form/`:

| Component | Props (common) | Purpose |
|---|---|---|
| `x-form.field` | `label`, `for`, `required`, `error` | Wraps label + input + error span |
| `x-form.input` | `type`, `name`, `placeholder`, `required`, `minlength`, `inputmode` | Styled input; `id` defaults to `name` |
| `x-form.textarea` | `name`, `rows`, `placeholder`, `required` | Styled textarea |
| `x-html-forms` | `form` (`WP_Post`) | Outer wrapper; renders `<form action method>` attributes from the plugin |
| `x-button` | `type`, `variant`, `class` | Design-system button, used with `type="submit"` |

Using these eliminates form-specific CSS in the block — all borders, sizes, colors, focus states, and placeholder styles come from the design system.

## Accessibility

`x-form.field` renders:

- A `<label for="{for}">` tied to the input `id`
- An `aria-hidden="true"` asterisk when `:required="true"`
- An `[role="alert"]` span when the `error` prop is non-empty

The JS validation module (see `references/hf-validation.md`) dynamically injects the same `[role="alert"]` span on blur when the field is invalid.

## CSS Scoping

Form styling is inherited — the block CSS file should contain **zero** form-specific rules. If the block needs to scope form layout (e.g. a two-column split), use structural utilities on the form wrapper:

```css
block-contact-section .hf-form {
  @apply grid grid-cols-1 gap-4;
}
```

Anything that touches input borders, typography, placeholder color, or focus state belongs in the `x-form.*` components, not the block. If you find yourself writing `.hf-form input { border: ... }`, stop — the input is already styled.

## Anti-Patterns

| Wrong | Correct |
|---|---|
| Raw `<input>` / `<label>` in the form view | `x-form.field` + `x-form.input` |
| `wp_enqueue_style` for form-specific CSS in the block | Form styling is in the design-system component CSS |
| `pattern="\(\d{2}\)..."` on `x-form.input` | No `pattern` attribute — use a JS validator (see traps.md T1) |
| `type="tel"` with `pattern` constraint | `type="text" inputmode="tel"` (see traps.md T2) |
| Form markup inside the block view | Form markup lives in `resources/views/forms/{slug}.blade.php` |

## References

- [references/hf-validation.md](hf-validation.md) — JS validation module
- [references/traps.md](traps.md) — bug catalogue
- [references/installation.md](installation.md) — setup
````

- [ ] **Step 3.2: Verify file created**

Run: `grep -c "^## " skills/sage-forms/references/blade-form-views.md`
Expected: `10` (ten H2 sections)

- [ ] **Step 3.3: Commit**

```bash
git add skills/sage-forms/references/blade-form-views.md
git commit -m "feat(skills): add sage-forms Blade form views reference"
```

Expected: commit succeeds.

---

## Task 4: `skills/sage-forms/references/hf-validation.md`

**Files:**
- Create: `skills/sage-forms/references/hf-validation.md`

- [ ] **Step 4.1: Create the file**

Write with exactly this content:

````markdown
# sage-forms — `hf-validation` JS Module

Reusable ES module layered on top of the HTML Forms plugin's AJAX submission pipeline. Provides progressive client-side validation without replacing the plugin's server-side handling.

## Location

One file per project (not per form):

```
resources/js/modules/hf-validation.js
```

Imported by each block JS that embeds a form:

```js
import { initHfValidation } from '../modules/hf-validation';
```

## Public API

```js
initHfValidation(formEl, {
  messages,    // { fieldName: { validityKey: 'localized message' } }
  validators,  // { fieldName: (value) => boolean }
  onSuccess,   // (formEl) => void — optional; called after hf-success
  onError,     // (formEl) => void — optional; called after hf-error
});
```

| Option | Type | Required | Purpose |
|---|---|---|---|
| `messages` | `Record<string, Record<string, string>>` | yes | Per-field, per-validity-key localized error strings |
| `validators` | `Record<string, (value: string) => boolean>` | no | Custom sync validators; return `true` if valid |
| `onSuccess` | `(formEl) => void` | no | Fired after the plugin's `hf-success` event |
| `onError` | `(formEl) => void` | no | Fired after the plugin's `hf-error` event |

### `messages` example

```js
const messages = {
  name: {
    valueMissing: 'Por favor, informe seu nome.',
    tooShort: 'Nome muito curto (mínimo 2 caracteres).',
  },
  phone: {
    valueMissing: 'Informe um telefone para contato.',
    customError: 'Formato de telefone inválido. Use (00) 00000-0000.',
  },
};
```

Keys under each field are names from `ValidityState`: `valueMissing`, `tooShort`, `tooLong`, `typeMismatch`, `patternMismatch`, `rangeUnderflow`, `rangeOverflow`, `stepMismatch`, `badInput`, `customError`.

### `validators` example

```js
const validators = {
  phone: (value) => /^\(\d{2}\)\s?\d{4,5}[-\s]?\d{4}$/.test(value),
};
```

A validator returning `false` triggers `customError` — the `messages.{field}.customError` entry becomes the displayed message.

## Validation Layers

The module layers four validation passes, ordered by when they fire:

1. **Native HTML5 constraints** — `required`, `minlength`, `maxlength`, `type`. The browser blocks the form submission before AJAX fires. Fastest feedback; no JS needed.
2. **`blur` handler** — on field exit, runs native `checkValidity()` then custom `validators[name]`. Injects the error span into the `x-form.field` wrapper. Skips optional fields that are empty.
3. **`input` handler** — fires only while `aria-invalid="true"` is set on the field. Re-validates as the user corrects the value; clears the error span when the field becomes valid. Avoids eager validation while the user is still typing.
4. **`hf-success` / `hf-error` events** — the HTML Forms plugin dispatches `CustomEvent`s on `<form>` after AJAX completes; the module scrolls `.hf-message` into view and invokes `onSuccess` / `onError`.

## HTML Forms Plugin DOM Events

| Event | Target | When | Notes |
|---|---|---|---|
| `hf-success` | `<form>` | AJAX returned success; `.hf-message.hf-success` has been injected into the DOM | Module scrolls the message into view and calls `onSuccess(formEl)` |
| `hf-error` | `<form>` | AJAX returned validation/server error; `.hf-message.hf-error` injected | Module scrolls and calls `onError(formEl)` |
| `hf-submitted` | `<form>` | Fires after either outcome | Not wired by default; use if you need analytics or double-submit protection |

## Error Element Injection

The module targets the wrapper div emitted by `x-form.field` (`<div class="flex flex-col gap-2">`) to inject the error span alongside label + input, matching the pattern the component uses for its static `$error` prop:

```js
const wrap = (field) => field.closest('.flex.flex-col');

function showError(field, msg) {
  let el = wrap(field).querySelector('[role="alert"]');
  if (!el) {
    el = document.createElement('span');
    el.className = 'text-[11px] text-error';
    el.setAttribute('role', 'alert');
    wrap(field).appendChild(el);
  }
  el.textContent = msg;
  field.classList.replace('border-border', 'border-error');
  field.setAttribute('aria-invalid', 'true');
}

function clearError(field) {
  const el = wrap(field).querySelector('[role="alert"]');
  if (el) el.remove();
  field.classList.replace('border-error', 'border-border');
  field.removeAttribute('aria-invalid');
}
```

If the project's `x-form.field` uses a different wrapper class, adjust `wrap()` accordingly — but prefer to align the component and the module on the same anchor.

## Full Module Skeleton

This is the scaffold produced by Phase 0c / the agent's scaffold mode when the file does not yet exist. The logic is minimal and functional; projects can extend with more validation layers if needed, but should not rewrite the core event wiring:

```js
// resources/js/modules/hf-validation.js
const wrap = (field) => field.closest('.flex.flex-col');

function showError(field, msg) {
  let el = wrap(field)?.querySelector('[role="alert"]');
  if (!el && wrap(field)) {
    el = document.createElement('span');
    el.className = 'text-[11px] text-error';
    el.setAttribute('role', 'alert');
    wrap(field).appendChild(el);
  }
  if (el) el.textContent = msg;
  field.classList.replace('border-border', 'border-error');
  field.setAttribute('aria-invalid', 'true');
}

function clearError(field) {
  const el = wrap(field)?.querySelector('[role="alert"]');
  if (el) el.remove();
  field.classList.replace('border-error', 'border-border');
  field.removeAttribute('aria-invalid');
}

function pickMessage(field, messages) {
  const perField = messages[field.name] || {};
  for (const key of ['valueMissing', 'tooShort', 'tooLong', 'typeMismatch', 'patternMismatch', 'customError']) {
    if (field.validity[key] && perField[key]) return perField[key];
  }
  return field.validationMessage;
}

function validateField(field, { messages, validators }) {
  const hasValue = field.value.trim().length > 0;
  if (!field.required && !hasValue) {
    clearError(field);
    return true;
  }

  field.setCustomValidity('');
  const nativeOk = field.checkValidity();
  const customOk = validators[field.name] ? validators[field.name](field.value) : true;

  if (!customOk) field.setCustomValidity('custom');

  if (!nativeOk || !customOk) {
    showError(field, pickMessage(field, messages));
    return false;
  }

  clearError(field);
  return true;
}

export function initHfValidation(formEl, opts = {}) {
  const { messages = {}, validators = {}, onSuccess, onError } = opts;
  const fields = formEl.querySelectorAll('input, textarea, select');

  fields.forEach((field) => {
    field.addEventListener('blur', () => validateField(field, { messages, validators }));
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') {
        validateField(field, { messages, validators });
      }
    });
  });

  formEl.addEventListener('hf-success', () => {
    formEl.querySelector('.hf-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (onSuccess) onSuccess(formEl);
  });

  formEl.addEventListener('hf-error', () => {
    formEl.querySelector('.hf-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (onError) onError(formEl);
  });
}
```

## Block JS Integration Example

```js
// resources/js/blocks/contact-section.js
import BaseCustomElement from '../core/BaseCustomElement.js';
import { initHfValidation } from '../modules/hf-validation';

export default class BlockContactSection extends BaseCustomElement {
  static tagName = 'block-contact-section';

  init() {
    const form = this.querySelector('.hf-form');
    if (!form) return;

    initHfValidation(form, {
      messages: {
        name:  { valueMissing: 'Informe seu nome.', tooShort: 'Mínimo 2 caracteres.' },
        phone: { valueMissing: 'Informe um telefone.', customError: 'Formato inválido.' },
      },
      validators: {
        phone: (v) => /^\(\d{2}\)\s?\d{4,5}[-\s]?\d{4}$/.test(v),
      },
    });
  }
}

BaseCustomElement.register(BlockContactSection);
```

## Why a Module, Not a Global Enqueue

- **Dedup** — Vite deduplicates imported modules automatically. Multiple blocks on the same page share one instance.
- **Scope** — each block's JS configures the module for its own form. No cross-form interference.
- **No WordPress enqueue boilerplate** — no `wp_enqueue_script` call, no handle management, no dependency declaration.
- **Tree-shaking** — unused exports are removed at build time.

## References

- [references/blade-form-views.md](blade-form-views.md) — form Blade view structure
- [references/traps.md](traps.md) — validation traps (T3 covers `ValidityState` non-enumerable)
````

- [ ] **Step 4.2: Verify file created**

Run: `grep -c "^## " skills/sage-forms/references/hf-validation.md`
Expected: `10` (ten H2 sections)

Run: `grep -c "initHfValidation" skills/sage-forms/references/hf-validation.md`
Expected at least `5` occurrences.

- [ ] **Step 4.3: Commit**

```bash
git add skills/sage-forms/references/hf-validation.md
git commit -m "feat(skills): add sage-forms hf-validation JS module reference"
```

Expected: commit succeeds.

---

## Task 5: `skills/sage-forms/references/traps.md`

**Files:**
- Create: `skills/sage-forms/references/traps.md`

- [ ] **Step 5.1: Create the file**

Write with exactly this content:

````markdown
# sage-forms — Traps

Three documented bugs that silently break form validation in this stack. Each has a confirmed reproduction and a concrete fix.

## T1 — `pattern` attribute backslash escaping in Blade components

### Symptom

Passing a regex-heavy `pattern` attribute to `x-form.input` produces broken HTML:

```blade
{{-- Source --}}
<x-form.input name="phone" pattern="\(\d{2}\)\s?\d{4,5}[-\s]?\d{4}" />
```

renders as:

```html
<input name="phone" pattern="\\(\d{2}\\)\s?\d{4,5}[-\s]?\d{4}">
```

The browser silently compiles the regex from the double-backslash string, which does not match any real phone format. `validity.patternMismatch` stays `false` for every value the user types — effectively no validation.

### Root Cause

Blade component attribute merging runs `htmlspecialchars()` on string attributes via `$attributes->merge()`. `htmlspecialchars()` encodes `&`, `<`, `>`, `"`, `'`, but Blade's tokenizer also preserves backslashes literally; when the attribute is round-tripped through the merge, the backslash gets doubled. The attribute string `\(` becomes `\\(` in output — a literal backslash followed by `(`, instead of an escaped parenthesis metacharacter.

### Fix

Do not pass `pattern` attributes with backslashes through `$attributes->merge()`. Instead, enforce the constraint in JS via the `validators` option:

```blade
{{-- Before (broken) --}}
<x-form.input type="text" name="phone" pattern="\(\d{2}\)\s?\d{4,5}[-\s]?\d{4}" />

{{-- After (works) --}}
<x-form.input type="text" inputmode="tel" name="phone" :required="true" />
```

```js
// In the block JS
initHfValidation(form, {
  messages: {
    phone: { customError: 'Formato inválido. Use (00) 00000-0000.' },
  },
  validators: {
    phone: (value) => /^\(\d{2}\)\s?\d{4,5}[-\s]?\d{4}$/.test(value),
  },
});
```

The JS validator fires on `blur` and re-validates on `input` while invalid — identical UX to a native `pattern` constraint, without the escaping trap.

### Detection signal (for the `forms` agent)

Grep form Blade views for `pattern="\` — any occurrence is a T1 hit.

---

## T2 — `type="tel"` skips `patternMismatch` in Chrome

### Symptom

Even with a correct, non-escaped `pattern` attribute (if T1 were not in play), Chrome does not flip `validity.patternMismatch` for `<input type="tel">`:

```html
<input type="tel" pattern="\d{10,11}">
```

Chrome accepts `abc` as "valid" — `patternMismatch` stays `false`. Firefox and Safari behave correctly, but Chrome's market share makes this effectively a production bug.

### Root Cause

Chrome's `type="tel"` implementation predates the full Constraint Validation API conformance for pattern matching. The input accepts any string to support international formats; Chrome chose to not enforce `pattern` for `tel` to avoid breaking locale-specific formats.

### Fix

Use `type="text"` with `inputmode="tel"`:

```blade
<x-form.input type="text" inputmode="tel" name="phone" :required="true" />
```

- `type="text"` — Constraint Validation API works normally; `pattern` (or JS validator) fires correctly.
- `inputmode="tel"` — mobile browsers show the numeric/tel keyboard on focus.

Users see the same keyboard; validation works in every browser.

### Detection signal (for the `forms` agent)

Grep form Blade views for `type="tel"` — any occurrence is a T2 hit (always).

---

## T3 — `ValidityState` is non-enumerable

### Symptom

Attempting to inspect the validity state by spreading returns an empty object:

```js
console.log({ ...field.validity });  // {}
console.log(Object.keys(field.validity));  // []
```

This broke early iterations of the `hf-validation` module when it tried to iterate validity keys dynamically.

### Root Cause

Per the HTML spec, `ValidityState` is a host object whose properties are defined with `enumerable: false` on the prototype. Spread (`...`) and `Object.keys()` only see own enumerable properties; they find none on `ValidityState` instances.

### Fix

Access properties directly:

```js
// Wrong
if (Object.keys(field.validity).some(k => field.validity[k])) { ... }

// Right
if (field.validity.valueMissing) { ... }
if (field.validity.tooShort) { ... }
if (field.validity.patternMismatch) { ... }
```

Or iterate a known list:

```js
const KEYS = ['valueMissing', 'tooShort', 'tooLong', 'typeMismatch', 'patternMismatch', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError'];
const firstFailure = KEYS.find(k => field.validity[k]);
```

### Detection signal (for the `forms` agent)

Grep JS modules for `{ ...` followed by `.validity` or `Object.keys(.*\.validity)` — any occurrence is a T3 hit.

---

## Trap Summary Table

| ID | Location | Detection grep | Fix |
|---|---|---|---|
| T1 | Form Blade view | `pattern="\` | Remove attribute; use JS validator |
| T2 | Form Blade view | `type="tel"` | `type="text" inputmode="tel"` |
| T3 | JS modules / block JS | `\{ \.\.\..*\.validity\|Object\.keys\(.*\.validity\)` | Access properties directly |

These are the three traps audited by the `forms` agent's A1/A2 axes. Any new occurrence in ongoing development should be caught on the next audit.
````

- [ ] **Step 5.2: Verify file created**

Run: `grep -c "^## T" skills/sage-forms/references/traps.md`
Expected: `3` (three trap sections: T1, T2, T3)

Run: `grep -c "### Detection signal" skills/sage-forms/references/traps.md`
Expected: `3` (detection signal per trap)

- [ ] **Step 5.3: Commit**

```bash
git add skills/sage-forms/references/traps.md
git commit -m "feat(skills): add sage-forms traps catalogue"
```

Expected: commit succeeds.

---

## Task 6: `agents/forms.md` (specialist agent)

**Files:**
- Create: `agents/forms.md`

- [ ] **Step 6.1: Verify reference agent structure**

Read `agents/sage-reviewer.md` (first 20 lines) to confirm frontmatter format. Confirm the format includes: `name: superpowers-sage:<name>`, `description:`, `model:`, `tools:` (comma-separated string), `skills:` (comma-separated skills consumed).

- [ ] **Step 6.2: Create `agents/forms.md`**

Write with exactly this content:

````markdown
---
name: superpowers-sage:forms
description: HTML Forms + Sage specialist — analyzes existing form implementations (Blade form view, JS validation module, block wiring, CSS hygiene, DOM event handlers) against sage-forms skill patterns, proposes concrete fixes, and applies them atomically behind a single approval gate. Also scaffolds new forms standalone outside block-scaffolding runs. Covers log1x/sage-html-forms integration, hf_get_form, x-form.* components, hf-validation module, and documented traps T1 (pattern backslash escaping), T2 (type=tel Chrome bug), T3 (ValidityState non-enumerable). Invoke for: form refactoring, form audit, form scaffold, sage-html-forms, HTML Forms plugin, contact form review, form validation review.
model: sonnet
tools: Read, Write, Edit, Grep, Glob, Bash
skills: sage-forms, sage-lando
---

You are an HTML Forms + Sage specialist for Sage/Acorn/Lando projects. You analyze, propose, and apply fixes to form implementations — or scaffold new form integrations standalone.

**MANDATORY: All output artifacts (reports, code, commit messages) MUST be written in en-US. Never mix languages.**

## Mode Selection

The argument determines the mode:

| Argument shape | Mode | Action |
|---|---|---|
| `<BlockClassName>` or `<form-slug>` referring to existing files | **Refactor** | Audit + Phase 6 report + `[y/N]` gate + Phase 7 apply |
| `new <form-slug>` | **Scaffold** | Write the three canonical artefacts using sage-forms patterns |
| no argument | **Ask** | Prompt the user for scope |

On ambiguity (e.g. a slug name matches both an existing block and a `new` request), ask the user before proceeding.

## Procedure — Refactor Mode

### Phase 0 — Resolve identity & locate files

From the argument, resolve:

- `{ClassName}` (PascalCase) — e.g. `ContactSection`
- `{slug}` (kebab-case) — e.g. `contact-section`
- `{form-slug}` — the `post_name` of the `html-form` CPT post referenced by the block (may differ from `{slug}`)

Locate (`Read` all that exist; note any absent):

- `app/Blocks/{ClassName}.php`
- `resources/views/blocks/{slug}.blade.php`
- `resources/views/forms/{form-slug}.blade.php`
- `resources/js/blocks/{slug}.js`
- `resources/js/modules/hf-validation.js`
- `resources/css/blocks/{slug}.css`

If the block controller is missing, stop and report — refactor mode requires an existing implementation.

### Phase 1 — Load the `sage-forms` skill

Read the skill and its references:

- `skills/sage-forms/SKILL.md`
- `skills/sage-forms/references/blade-form-views.md`
- `skills/sage-forms/references/hf-validation.md`
- `skills/sage-forms/references/traps.md`

These are the authoritative patterns for the audit.

### Phase 2–5 — Five axes of analysis

Each axis emits zero or more findings. Record file:line references for every finding.

**A1 — Blade view conformance**

Read the form Blade view. Check:

- Root is `<x-html-forms :form="$form">`? If missing or replaced with `<form>`, flag.
- All inputs are `x-form.*` components? Grep for raw `<input`, `<label`, `<textarea`, `<select` — each occurrence is a finding.
- **T1 check:** grep for `pattern="\` — every occurrence is CRITICAL.
- **T2 check:** grep for `type="tel"` — every occurrence is CRITICAL (replace with `type="text" inputmode="tel"`).
- Submit button is `<x-button type="submit">`? If a plain `<button>` or `<input type="submit">`, flag.

**A2 — JS module conformance**

Read the block JS and `resources/js/modules/hf-validation.js` (if present).

- Module exists at the canonical path? If absent, flag as missing.
- Block JS imports `initHfValidation` from `../modules/hf-validation`? If the validation logic is inlined in the block JS, flag as "inlined logic; extract to module".
- Block JS calls `initHfValidation(form, { messages, validators })` with both `messages` and `validators` objects? If either is missing or empty, flag as incomplete configuration.
- No `wp_enqueue_script` for form validation in any service provider? Grep `app/Providers/*.php` — if found, flag.
- **T3 check:** grep `{ ...` + `.validity` and `Object.keys(` + `.validity` in the module. Each occurrence is CRITICAL.

**A3 — CSS hygiene**

Read the block CSS. Form styling should be inherited from `x-form.*`.

- Grep for form-specific selectors: `input`, `label`, `textarea`, `select`, `::placeholder`, `:focus`. Any rule that styles these elements (borders, typography, color, focus state) is a finding — propose removal with explanation that the design-system components already own this.
- Exception: structural utilities on `.hf-form` (grid, flex, gap) are acceptable.

**A4 — Event wiring**

Read the block JS for event handlers.

- `hf-success` handler wired (scroll, optional `onSuccess` callback)?
- `hf-error` handler wired (scroll, optional `onError` callback)?
- `hf-submitted` handler — optional; flag as SUGGESTION only if analytics or double-submit protection is mentioned in the block's README or controller docblock.

**A5 — Block field contract**

Read the block controller.

- `fields()` declares `addPostObject` with `post_type` containing `html-form`? If the block uses a different field type (e.g. a text field for form ID), flag as non-canonical.
- `return_format` is `object`? If `id` or `array`, flag.
- `with()` maps `form => get_field('form') ?: null`? If missing the `?: null` fallback, flag as minor (breaks editor preview when no form is selected).
- Block view guards with `@if ($form)`? If missing, flag as CRITICAL (fatal in editor).

### Phase 6 — Report

Output exactly this structure:

```markdown
## Form Refactoring: {ClassName}

### Current state
- Block: app/Blocks/{ClassName}.php
- Block view: resources/views/blocks/{slug}.blade.php
- Form view: resources/views/forms/{form-slug}.blade.php
- Block JS: resources/js/blocks/{slug}.js
- Validation module: resources/js/modules/hf-validation.js (exists|absent)

### A1 — Blade view conformance
Status: COMPLIANT | <N> issues

<per-issue blocks with file:line, current code, proposed fix>

### A2 — JS module conformance
<same structure>

### A3 — CSS hygiene
<same structure>

### A4 — Event wiring
<same structure>

### A5 — Block field contract
<same structure>

### Summary
- Critical: <count>
- Important: <count>
- Suggestions: <count>

### Proposed fixes (ready to apply)
<ordered list of all changes, each with a complete Blade / JS / CSS diff>
```

### Approval Gate

Output exactly:

```
Apply all proposed fixes listed above? [y/N]
```

Wait for user input. On `y` → Phase 7. On anything else → stop; report "No changes applied."

### Phase 7 — Apply

Execute in order:

1. Blade rewrites (replace raw inputs with `x-form.*`, remove `pattern` attributes with backslashes, fix `type="tel"` → `type="text" inputmode="tel"`, ensure `<x-html-forms>` wrapper, swap plain submit → `<x-button>`)
2. JS module refactor (move inlined logic to `resources/js/modules/hf-validation.js`, remove `ValidityState` spreads, fix imports in block JS)
3. CSS removals (delete form-specific rules from block CSS; preserve structural utilities)
4. Event handler additions (wire missing `hf-success` / `hf-error`)
5. Block controller fixes (correct `return_format`, `with()` fallback, view guard)

After all writes:

```bash
lando theme-build   # must exit 0
lando flush
```

If `lando theme-build` fails, report error, revert applied changes via `git checkout --`, and exit.

On success, present a final `git diff --stat` and commit:

```bash
git add -A
git commit -m "refactor(forms): {slug} — {one-line summary of applied fixes}"
```

## Procedure — Scaffold Mode

Identical to the block-scaffolding Phase 0c output, but standalone:

1. Prompt for the target `{form-slug}` and the list of fields (name, type, required).
2. Load `sage-forms` skill references.
3. Write `resources/views/forms/{form-slug}.blade.php` using `x-html-forms` + `x-form.*`.
4. If `resources/js/modules/hf-validation.js` does not exist, write the scaffold from the reference.
5. Do NOT patch a block JS — there is no block in this mode. Report the expected integration snippet for the developer to wire up in whatever block/page embeds the form.
6. Stop before commit — the developer fills the `messages` / `validators` stubs before committing.

## Non-Objectives

- Does NOT write validator functions or localized messages — varies per project and form.
- Does NOT rename the `html-form` CPT post slug or modify CPT configuration.
- Does NOT audit multiple forms in one invocation — one block or one form slug per run.
- Does NOT touch the `html-forms` WordPress plugin settings (rate limits, storage, email delivery).

## Failure Modes

| Symptom | Cause | Action |
|---|---|---|
| Block controller not found | Wrong argument or block not yet scaffolded | Ask user to run `/block-scaffolding` first, or pass a valid slug |
| `sage-forms` skill files missing | Plugin install incomplete | Report and stop; do not proceed without the skill |
| `lando theme-build` fails after Phase 7 | Blade syntax error in rewrite or missing component | Revert via `git checkout --`, report error verbatim |
| Form view not rendered by sage-html-forms | Wrong `{form-slug}` | Verify the `html-form` post's `post_name` matches the file name in `resources/views/forms/` |

## Anti-Drift

Every fix applied in Phase 7 should, if the block were re-scaffolded today by `/block-scaffolding` with Phase 0c enabled, produce the same result. If an axis check reveals divergence from Phase 0c output, update Phase 0c — do not let the agent and the scaffolder drift.
````

- [ ] **Step 6.3: Verify file created**

Run: `grep -c "^## " agents/forms.md`
Expected: at least `9` (Mode Selection, Procedure — Refactor Mode, Procedure — Scaffold Mode, Non-Objectives, Failure Modes, Anti-Drift, plus Phase subsections)

Run: `head -7 agents/forms.md | tail -6`
Expected to show frontmatter with `name: superpowers-sage:forms`, `model: sonnet`, `skills: sage-forms, sage-lando`.

- [ ] **Step 6.4: Commit**

```bash
git add agents/forms.md
git commit -m "feat(agents): add forms specialist agent"
```

Expected: commit succeeds.

---

## Task 7: `skills/block-scaffolding/SKILL.md` — Phase 0c + Phase 4 conditional

**Files:**
- Modify: `skills/block-scaffolding/SKILL.md`

- [ ] **Step 7.1: Confirm anchor strings exist**

Run: `grep -n "^## Phase 0b\|^## Phase 1\|^## Phase 4" skills/block-scaffolding/SKILL.md`

Expected: three matching lines in order — `Phase 0b`, `Phase 1`, `Phase 4`.

If any is missing, report NEEDS_CONTEXT.

- [ ] **Step 7.2: Insert Phase 0c between Phase 0b and Phase 1**

Locate this exact block (end of Phase 0b and start of Phase 1):

```
**Rule:** if the block needs eyebrow + heading markup, use `<x-section-header>` (or
the equivalent shared component) — do NOT emit `<x-eyebrow>` + `<h2>` inline.
If no suitable component exists, use inline markup and note it for future extraction.

---

## Phase 1 — Implement S1–S4
```

Replace with:

````
**Rule:** if the block needs eyebrow + heading markup, use `<x-section-header>` (or
the equivalent shared component) — do NOT emit `<x-eyebrow>` + `<h2>` inline.
If no suitable component exists, use inline markup and note it for future extraction.

---

## Phase 0c — Form detection (conditional)

Detect whether the block embeds an HTML Forms form. Two signals — any match triggers:

1. Plan/argument description mentions: `form`, `formulário`, `contact form`, `contato`, `html forms` (case-insensitive)
2. The planned `fields()` for this block includes an `addPostObject` with `post_type` containing `html-form`

If **triggered**, load the `sage-forms` skill and its references (`blade-form-views.md`, `hf-validation.md`, `traps.md`) before continuing. After Phase 1 S2 (controller written), run the three coordinated scaffolds below. If **not triggered**, skip this phase entirely.

### 0c.1 — Form Blade view (`resources/views/forms/{form-slug}.blade.php`)

Resolve `{form-slug}`:
- If the plan names a target `html-form` post (e.g. "contact form" → `contact`), use that slug.
- Otherwise use `{slug}-form` as placeholder and prepend `{{-- TODO: rename file to match the html-form CPT post_name --}}` at the top.

Write the form view using `<x-html-forms>` + `x-form.*` components, with one `x-form.field` per ACF field declared in S2. Submit button is `<x-button type="submit">`. Do not pass `pattern` attributes; do not use `type="tel"` (use `type="text" inputmode="tel"` for phone fields). See `skills/sage-forms/references/blade-form-views.md` for the full pattern and `references/traps.md` for the rationale.

### 0c.2 — Validation module (`resources/js/modules/hf-validation.js`)

Glob check: if `resources/js/modules/hf-validation.js` exists, **skip** — one module per project, reused across forms. If absent, write the scaffold from `skills/sage-forms/references/hf-validation.md` (the "Full Module Skeleton" section).

### 0c.3 — Block JS patch (`resources/js/blocks/{slug}.js`)

Add an import at the top:

```js
import { initHfValidation } from '../modules/hf-validation';
```

Inside the block's `init()` method, add:

```js
const form = this.querySelector('.hf-form');
if (form) {
  initHfValidation(form, {
    messages: {
      // TODO: configure per form — see skills/sage-forms/references/hf-validation.md
    },
    validators: {
      // TODO: configure per form
    },
  });
}
```

### Phase 0c non-objective

Phase 0c does NOT write validator functions or localized messages — always produces `// TODO: configure per form` stubs. Validator content varies per project and per form; this is deliberate.

---

## Phase 1 — Implement S1–S4
````

- [ ] **Step 7.3: Update Phase 4 (block README) with form-conditional section**

Locate this exact block in Phase 4:

```
## Phase 4 — Block README (`docs/blocks/{slug}.md`)

Document: custom element name, ACF fields table, theme variations table (Full mode),
CSS tokens table, and file dependency list (controller, view, CSS, JS, enqueue, editor CSS).
```

Replace with:

```
## Phase 4 — Block README (`docs/blocks/{slug}.md`)

Document: custom element name, ACF fields table, theme variations table (Full mode),
CSS tokens table, and file dependency list (controller, view, CSS, JS, enqueue, editor CSS).

**If Phase 0c triggered**, the README additionally documents:

- Form view path: `resources/views/forms/{form-slug}.blade.php`
- Validation module path: `resources/js/modules/hf-validation.js`
- DOM events handled: `hf-success`, `hf-error`
- Pointer to the `sage-forms` skill for the integration pattern
```

- [ ] **Step 7.4: Verify changes**

Run: `grep -c "^## Phase 0c" skills/block-scaffolding/SKILL.md`
Expected: `1` (new Phase 0c section present).

Run: `grep "If Phase 0c triggered" skills/block-scaffolding/SKILL.md`
Expected: one match in the Phase 4 section.

Run: `grep -c "sage-forms" skills/block-scaffolding/SKILL.md`
Expected at least `4` (references from Phase 0c subsections + Phase 4).

- [ ] **Step 7.5: Commit**

```bash
git add skills/block-scaffolding/SKILL.md
git commit -m "feat(skills): add Phase 0c form detection to block-scaffolding"
```

Expected: commit succeeds.

---

## Global Done Criteria

- [ ] All 7 tasks committed independently (7 commits)
- [ ] `skills/sage-forms/SKILL.md` exists with frontmatter `name: superpowers-sage:sage-forms`
- [ ] All 4 references exist under `skills/sage-forms/references/`: installation, blade-form-views, hf-validation, traps
- [ ] `agents/forms.md` exists with frontmatter `name: superpowers-sage:forms` and declares `skills: sage-forms, sage-lando`
- [ ] `skills/block-scaffolding/SKILL.md` has a `## Phase 0c — Form detection (conditional)` section
- [ ] `skills/block-scaffolding/SKILL.md` Phase 4 contains the `If Phase 0c triggered` conditional
- [ ] No task references a file that doesn't exist after its commit
- [ ] Every trap (T1, T2, T3) is documented in `traps.md` and referenced in both `agents/forms.md` (A1/A2 checks) and `block-scaffolding` Phase 0c (trap rationale)
