> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Sage Forms Integration — Design Spec

**Date:** 2026-04-20
**Status:** approved
**Source:** `interioresdecora/docs/feedback/2026-04-20-sage-html-forms-integration.md`

---

## Scope

Codify the discovered patterns for integrating [HTML Forms](https://htmlformsplugin.com/) + [log1x/sage-html-forms](https://github.com/Log1x/sage-html-forms) into Sage 11 / Acorn 5 projects. Three deliverables form a single coherent system where knowledge lives in one skill consumed by two points of entry.

1. **`skills/sage-forms/`** — reference skill; single source of truth for the integration pattern.
2. **`agents/forms.md`** — user-invocable specialist; analyzes existing form implementations and applies fixes (refactor-style), or scaffolds new forms standalone.
3. **`skills/block-scaffolding/SKILL.md`** — new Phase 0c that detects form embedding in a block and, when triggered, consumes the `sage-forms` skill to scaffold the Blade form view + JS validation module + block JS wiring.

The skill is authoritative. The agent and the block-scaffolding Phase 0c are consumers. Neither duplicates skill content.

---

## Architecture Decisions

### AD-1 — Knowledge lives in one place

Both the agent and `block-scaffolding` need the same integration patterns. Duplicating them in two places guarantees drift. The `sage-forms` skill is the canonical reference; both consumers load it on demand.

**Decision:** Skill is the knowledge layer. No pattern, template, or trap is documented outside the skill.

**Rejected alternative:** Embedding the patterns directly in the agent file (smaller surface, but creates drift the moment `block-scaffolding` needs the same info).

### AD-2 — Agent follows the `block-refactoring` model

The user explicitly wants the agent to propose AND apply fixes, not just validate. That is exactly the `block-refactoring` behaviour. Reusing the same model (Phase 6 report → single `[y/N]` gate → Phase 7 atomic apply) means the agent inherits well-tested patterns already present in the plugin.

**Decision:** Agent's refactor mode mirrors `block-refactoring` phase structure.

**Rejected alternative:** "Propose-only" validator (lower value; user would still have to apply manually).

### AD-3 — Validators and messages remain project-specific

The user explicitly flagged: "validação varia a cada escopo e projeto". The Phase 0c scaffold and the agent's scaffold mode both create stubs for `messages` and `validators` — never fill them with guessed content. The `hf-validation.js` module body is minimal and functional; the project-specific configuration lives in the block's JS init.

**Decision:** Scaffold structure, not content. All project-specific decisions land as `// TODO: configure per form` stubs.

**Rejected alternative:** Ship an opinionated `validators` catalogue in the plugin (would be wrong 80% of the time; adds maintenance burden).

### AD-4 — Phase 0c detection is additive, not a new block mode

`block-scaffolding` already has Minimal and Full modes. Adding a third mode would cross-cut with both. Instead, Phase 0c is a **detection step** that runs after Phase 0b and, if triggered, adds artefacts to the scaffold — without changing the block's own shape.

**Decision:** Phase 0c is an additive pass that runs after Phase 0b; modes (Full/Minimal) remain orthogonal.

**Rejected alternative:** "Form mode" as a third block mode (crosses orthogonal axes; combinatorial complexity with Full/Minimal × Form/No-form).

---

## Change 1 — `skills/sage-forms/` (reference skill)

Follows the progressive-disclosure pattern of `acorn-livewire`: a lean `SKILL.md` plus four focused reference files loaded on demand.

### `skills/sage-forms/SKILL.md`

Frontmatter:

```yaml
---
name: superpowers-sage:sage-forms
description: >
  HTML Forms + Sage integration — log1x/sage-html-forms, hf_get_form,
  addPostObject html-form, Blade form views, x-form.* shared components,
  hf-validation JS module, hf-success hf-error hf-submitted events,
  Constraint Validation API, form bugs traps, pattern escaping, type="tel",
  ValidityState non-enumerable.
user-invocable: false
---
```

Body sections (short, with pointers to references):

1. **When to use** — HTML Forms CPT-based flow with stateless submission. Editor UX: pick a form from a dropdown on the block.
2. **When NOT to use** — highly interactive form with state (use Livewire). Multi-step wizard (use Livewire). Simple single-field inline form (use Blade component + native `<form>`).
3. **Installation summary** — one `lando composer require` for the plugin, one `lando theme-composer require` for the bridge. No manual ServiceProvider registration. Pointer to `references/installation.md` for details.
4. **Integration pattern summary** — block field via `addPostObject` scoped to `html-form`; view renders via `hf_get_form($id)->get_html()`. Pointer to `references/blade-form-views.md`.
5. **Validation module summary** — `initHfValidation(formEl, opts)` API signature, event hooks. Pointer to `references/hf-validation.md`.
6. **Traps** — the three bugs at one-line each, with pointer to `references/traps.md`.

### `skills/sage-forms/references/installation.md`

Composer commands, Acorn auto-discovery explanation, verification step (run `lando wp plugin list | grep html-forms` and confirm package autoload via `vendor/log1x/sage-html-forms/src/Providers/SageHtmlFormsServiceProvider.php`).

### `skills/sage-forms/references/blade-form-views.md`

- Block field declaration pattern with `addPostObject`
- `with()` mapping: `'form' => get_field('form') ?: null`
- Block view: `@if ($form) {!! hf_get_form($form->ID)->get_html() !!} @endif`
- `hf_form_html` filter hookup: form Blade view at `resources/views/forms/{form-slug}.blade.php`
- Full `x-form.*` catalogue usage with examples (`x-form.field`, `x-form.input`, `x-form.textarea`, `x-button type="submit"`)
- CSS scoping: form inherits from `block-{slug}`; no form-specific rules needed in block CSS
- Accessibility: `x-form.field` renders `<label for>`; `aria-hidden="true"` asterisk on required fields

### `skills/sage-forms/references/hf-validation.md`

Full `hf-validation.js` module reference:

- Module export: `initHfValidation(formEl, { messages, validators, onSuccess, onError })`
- Four validation layers: native HTML5, `blur` handler, `input` handler (lazy re-validation), `hf-success`/`hf-error` post-submit
- Error element injection — anchoring to `x-form.field` wrapper (`.flex.flex-col`)
- Custom Events from HTML Forms plugin: `hf-success`, `hf-error`, `hf-submitted` — when each fires, what's in the DOM at that moment
- Example block JS integration: importing the module, configuring messages/validators for a specific form

### `skills/sage-forms/references/traps.md`

Three documented bugs with symptom, root cause, and fix:

**T1 — `pattern` attribute backslash escaping in Blade components**
- Symptom: `pattern="\(\d{2}\)..."` becomes `pattern="\\(\d{2}\\)..."` in HTML; regex broken; `patternMismatch` never fires.
- Root cause: `$attributes->merge()` runs `htmlspecialchars()` which double-escapes backslashes.
- Fix: Do not pass `pattern` attribute. Use a JS validator function instead.

**T2 — `type="tel"` skips `patternMismatch` in Chrome**
- Symptom: Even with a working `pattern` attribute, Chrome never flips `validity.patternMismatch` for `type="tel"`.
- Fix: Use `type="text" inputmode="tel"`. Still gets numeric keyboard on mobile; Constraint Validation API works correctly.

**T3 — `ValidityState` is non-enumerable**
- Symptom: `{ ...field.validity }` returns `{}`. Spread/`Object.keys()` yields nothing.
- Fix: Access properties directly (`field.validity.valueMissing`, `field.validity.tooShort`, etc.).

---

## Change 2 — `agents/forms.md` (user-invocable specialist)

Agent frontmatter (matches existing plugin agents — `sage-reviewer`, `sage-debugger`):

```yaml
---
name: superpowers-sage:forms
description: HTML Forms + Sage specialist — analyzes existing form implementations (Blade view, JS validation module, block wiring) against sage-forms skill patterns, proposes fixes, applies atomically on single approval gate; also scaffolds new forms standalone outside block-scaffolding runs. Covers log1x/sage-html-forms integration, hf_get_form, x-form.* components, hf-validation module, and documented traps (pattern escaping, type="tel", ValidityState).
model: sonnet
tools: Read, Write, Edit, Grep, Glob, Bash
skills: sage-forms, sage-lando
---
```

**Naming note:** The agent file lives at `agents/forms.md` but the plugin-manifest-resolved name is `superpowers-sage:forms`. When invoked through the Agent tool, the `subagent_type` is `superpowers-sage:forms`. Short-form invocation `/forms` works when the plugin exposes it as a user-invocable agent via the manifest.

### Invocation

- `Agent` tool with `subagent_type: "superpowers-sage:forms"` and argument `<BlockClassName or form-slug>` — **refactor mode**: analyze existing implementation.
- Same with argument `new <form-slug>` — **scaffold mode**: create form artefacts from scratch (outside a block scaffolding run).
- Invoked with no argument — ask user for scope.

### Procedure (refactor mode)

1. **Phase 0 — Resolve identity & locate files**
   - Given block or form slug, locate:
     - Block controller (`app/Blocks/{ClassName}.php`)
     - Form Blade view (`resources/views/forms/{form-slug}.blade.php`)
     - Block JS (`resources/js/blocks/{slug}.js`)
     - Validation module (`resources/js/modules/hf-validation.js`)
     - Block CSS (`resources/css/blocks/{slug}.css`)
   - Read all present files. Note missing ones.

2. **Phase 1 — Read the `sage-forms` skill** to load authoritative patterns. Read `references/blade-form-views.md`, `references/hf-validation.md`, and `references/traps.md`.

3. **Phase 2–5 — Five axes of analysis** (each axis emits 0+ findings):

   **A1 — Blade view conformance**
   - Does the view use `<x-html-forms :form="$form">` wrapper?
   - Are all inputs via `x-form.*` components? No raw `<input>`/`<label>`?
   - No `pattern` attribute with backslashes? (T1 trap check)
   - No `type="tel"` without `inputmode="tel"`? (T2 trap check)

   **A2 — JS module conformance**
   - Is validation in `resources/js/modules/hf-validation.js`? (Or importable path?)
   - Is it imported by the block JS? Not globally enqueued via `wp_enqueue_script`?
   - Is `initHfValidation()` called with both `messages` and `validators` configured?
   - No `{ ...field.validity }` spread anywhere? (T3 trap check)

   **A3 — CSS hygiene**
   - Does the block CSS contain form-specific rules (input borders, label sizes, placeholder colour)?
   - If yes, these should be removed — styling inherits from `x-form.*` via the design system.

   **A4 — Event wiring**
   - Is `hf-success` handled (scroll to message, state reset)?
   - Is `hf-error` handled (scroll to message)?
   - Is `hf-submitted` wired if the project needs analytics / double-submit protection? (Optional; flag as suggestion, not issue.)

   **A5 — Block field contract**
   - Does the block's `fields()` declare an `addPostObject` scoped to `html-form`?
   - Does `with()` pass the form object to the view?
   - Does the view guard with `@if ($form)` before `hf_get_form()`?

4. **Phase 6 — Report**

   Structured report in the form:

   ```markdown
   ## Form Refactoring: {ClassName or slug}

   ### A1 — Blade view conformance
   - Status: {COMPLIANT | N issues found}
   - Issues: [list with file:line and proposed fix]

   ### A2 — JS module conformance
   - Status: ...
   - Issues: ...

   ### A3 — CSS hygiene
   - Status: ...
   - Proposed removals: [list]

   ### A4 — Event wiring
   - Status: ...
   - Missing handlers: [list]

   ### A5 — Block field contract
   - Status: ...
   - Issues: ...

   ### Proposed fixes
   For each issue above, a ready-to-apply diff (Blade / JS / CSS) is included.
   ```

5. **Approval Gate**

   ```
   Apply all proposed fixes listed above? [y/N]
   ```

6. **Phase 7 — Apply (on `y`)**
   - Apply Blade rewrites (replace raw inputs with `x-form.*`, remove bad `pattern` attrs, fix `type` + `inputmode`)
   - Apply JS module refactor (move from global enqueue to module import, remove `ValidityState` spreads)
   - Remove CSS rules flagged in A3
   - Add missing event handlers from A4
   - Run `lando theme-build` — must exit 0
   - Run `lando flush`
   - Present final diff for review
   - Commit: `refactor(forms): {slug} — {summary}`

### Procedure (scaffold mode)

Same logic as the block-scaffolding Phase 0c (Change 3), standalone. Writes three artefacts (form Blade view, `hf-validation.js` if absent, block JS patch) using sage-forms skill patterns. Stops before committing — leaves the developer to fill the `messages`/`validators` stubs before committing.

### Non-objectives

- Does NOT write the actual validator functions or localized messages — these vary per project/form.
- Does NOT rename form slugs or change CPT configuration.
- Does NOT audit multiple forms in one invocation — one block/form per run.

---

## Change 3 — `skills/block-scaffolding/SKILL.md` — Phase 0c (form detection)

Inserted between Phase 0b (shared component inventory) and Phase 1 (implement S1–S4).

### Detection signals (OR — any match triggers)

1. Plan description mentions: `form`, `formulário`, `contact form`, `contato`, `html forms`
2. Block specification for `fields()` includes `addPostObject` with `post_type` containing `html-form`

### If triggered

1. **Load `sage-forms` skill** — invoke the reference skill to load integration patterns.

2. **Scaffold additional artefacts** (in order):

   a. **`resources/views/forms/{form-slug}.blade.php`** — Blade form view.
   - `{form-slug}` derivation:
     - If the plan names a target form post (e.g. "contact form" → `contato`), use that slug.
     - Otherwise use a placeholder (`{slug}-form`) and add a comment: `{{-- TODO: rename file to match the html-form CPT post slug --}}`.
   - Structure: `<x-html-forms :form="$form">` wrapper + `x-form.field`/`x-form.input`/`x-form.textarea` per ACF field declared in the block + `<x-button type="submit">` submit.

   b. **`resources/js/modules/hf-validation.js`** — validation module.
   - Skipped if file already exists (glob check first).
   - Stub exports `initHfValidation(formEl, { messages, validators, onSuccess, onError })` with minimal functional body covering the four validation layers from `references/hf-validation.md`.

   c. **Patch `resources/js/blocks/{slug}.js`** — block custom element.
   - Add import: `import { initHfValidation } from '../modules/hf-validation';`
   - Inside `init()`, add:
     ```js
     const form = this.querySelector('.hf-form');
     if (form) {
       initHfValidation(form, {
         messages: {
           // TODO: configure per form — see sage-forms skill references/hf-validation.md
         },
         validators: {
           // TODO: configure per form
         },
       });
     }
     ```

3. **Update Phase 4 (block README)** — if Phase 0c triggered, README includes:
   - Form view path: `resources/views/forms/{form-slug}.blade.php`
   - Validation module path: `resources/js/modules/hf-validation.js`
   - Events handled: `hf-success`, `hf-error`
   - Link to `sage-forms` skill

### Non-objective

Phase 0c does NOT write validator functions or localized messages — always produces stubs. This is deliberate: validator content varies per project and form.

---

## Validation Strategy

- **Functional:** After any change from agent or Phase 0c, `lando theme-build` exits 0.
- **Convention:** The `sage-forms` skill patterns are the single source of truth. Reviewers auditing form code reference this skill.
- **Regression:** Existing forms in projects not using this skill are unaffected. The agent is opt-in; Phase 0c is detection-gated.
- **Trap coverage:** T1–T3 are detected by the agent's A1/A2 axes. If any of the three ships in new code, the agent flags it on re-audit.

---

## Suggested Implementation Sequencing

1. **Create `skills/sage-forms/`** — skill first (knowledge layer; consumers depend on it).
   - Write `SKILL.md` with frontmatter + section summaries
   - Write the four `references/*.md` files (installation, blade-form-views, hf-validation, traps)
   - Commit as standalone change

2. **Create `agents/forms.md`** — specialist second (consumes the skill).
   - Frontmatter + procedure for both modes (refactor + scaffold)
   - Commit

3. **Extend `block-scaffolding/SKILL.md`** — Phase 0c third.
   - Detection signals section + scaffold steps
   - Update Phase 4 (block README) conditional
   - Commit

Each step is independent and testable: the skill can be read in isolation, the agent can be invoked without block-scaffolding, and block-scaffolding's Phase 0c loads the skill at runtime.

---

## Open Questions (deferred)

- **`pattern` attribute safe path in Blade components** — is there a raw-string helper or dedicated `pattern` prop with `{!! !!}` that could resolve T1? Flagged for future spec; current workaround (JS validator) is documented in `traps.md`.
- **`<x-html-forms>` wrapper custom element awareness** — currently form CSS scopes via `block-{slug} .hf-form`. Should the wrapper expose the block's custom element tag? Future spec.
- **Multi-form blocks** — a single block with more than one embedded form is not supported by Phase 0c or the agent's scaffold mode. Explicitly out of scope; flag as unsupported case and ask user to split blocks if detected.
