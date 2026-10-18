# Troubleshooting — environment gotchas

Real failures you hit when standing up and running a Roots/Acorn/Lando project with
this plugin, with the **symptom → cause → fix** for each. These are
environment/setup issues, not skill bugs — but they silently sink a session if you
don't recognise them.

---

## 1. Host edits don't show up in the browser (Lando + Docker ≥ 28)

**Symptom.** You edit `app.css` / a Blade view on the host, rebuild, reload — and
nothing changes. `lando theme-build` produces a build with an **identical hash**;
new Acorn routes return **404**; `grep` inside the container
(`lando ssh -s appserver -c 'grep ...'`) shows the **old** file content while the
host already has the new one.

**Cause.** **Lando's host↔container mount is broken by Docker Engine ≥ 28**
(Lando supports `>=18 <28`). `lando start` *prints* the warning
("you have version 29.x but Lando wants …") and then keeps running, so it's easy
to miss. The volume effectively becomes a snapshot taken at `lando start`, not a
live mount.

**One-command diagnosis.**
```bash
echo "SENTINEL" >> resources/css/app.css
lando ssh -s appserver -c 'grep -c SENTINEL /app/.../resources/css/app.css'   # 0 → mount is broken
```

**Fix.** Run Docker **< 28** (e.g. 27.5.x) and `lando rebuild`:
```bash
sudo apt-get install -y --allow-downgrades \
  docker-ce=5:27.5.1-1~ubuntu.24.04~noble \
  docker-ce-cli=5:27.5.1-1~ubuntu.24.04~noble \
  docker-ce-rootless-extras=5:27.5.1-1~ubuntu.24.04~noble
sudo apt-mark hold docker-ce docker-ce-cli docker-ce-rootless-extras
lando start
```
Alternatives: use the wp-kit `.devcontainer`, or a host with a compatible Docker.

---

## 2. ACF blocks do not register

**Symptom.** An ACF Composer block or field group is missing, and `acf_register_block_type` is undefined.

**Cause.** No ACF or Secure Custom Fields is installed, so the block cannot register.

**Fix.** Install it (ACF Pro through Composer, or the free fork), then sync `acf-composer`:
```bash
lando wp plugin install secure-custom-fields --activate
lando composer update log1x/acf-composer
lando wp acorn optimize:clear
```
Verify: `lando wp eval 'var_dump(function_exists("acf_register_block_type"));'`.

---

## 3. `composer install` fails: "package not present in the lock file"

**Symptom.** `composer install` errors that `log1x/acf-composer` (or similar) is in
`composer.json` but not in `composer.lock`.

**Cause.** `composer.json` was edited (often by a skill adding a dependency) without
updating the lock.

**Fix.** Update the specific package(s) — `update`, not `install`:
```bash
lando ssh -s appserver -c 'cd /app/<theme-path> && composer update log1x/acf-composer'
```

---

## 4. Fonts don't load (Tailwind v4 + Vite drops `@import`)

**Symptom.** You add `@import url("https://fonts.googleapis.com/…")` to `app.css`,
set `--font-display`, rebuild — and the page still renders the system font. The
built CSS contains **zero** occurrences of `googleapis`.

**Cause.** A CSS `@import` placed **after** `@import "tailwindcss"` is at an invalid
position once Tailwind's import expands, so Vite/Lightning CSS **drops it**.

**Fix.** Load the font with a `<link>` in the layout `<head>` (robust, and the
production-correct approach with `preconnect`):
```blade
{{-- resources/views/layouts/app.blade.php, in <head> --}}
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300..700&display=swap" rel="stylesheet">
```
Then point the tokens at it: `--font-display: "Montserrat", …;`. (Or put the
`@import` **before** `@import "tailwindcss"`.)

---

## 5. A new Acorn route (e.g. `/kitchensink`) returns 404

**Symptom.** The route is in `routes/web.php` but the URL 404s.

**Cause.** It's wrapped in a `WP_DEBUG` guard and debug is off, and/or routes are
cached.

**Fix.**
```bash
lando wp config set WP_DEBUG true --raw
lando flush          # clears wp/acorn/redis caches + rewrites
```

---

## 6. Default WordPress content leaks below your blocks

**Symptom.** "Archives / Categories / Recent posts" widgets render under your
custom homepage.

**Cause.** The layout still renders the default `sections/footer.blade.php`
(`dynamic_sidebar('sidebar-footer')`) with default widgets.

**Fix.** Clear the default widgets, or render a footer block instead:
```bash
lando wp widget reset --all
```

---

> **Meta-lesson.** Symptoms 1, 4 and 5 all *look* like a Vite/Acorn cache bug — they
> aren't. When an edit "doesn't take", check the **mount** (symptom 1) and the
> **load path** (symptoms 4-5) before blaming caches.
