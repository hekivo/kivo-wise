#!/usr/bin/env bash
set -euo pipefail
# Seed the workspace with the detector fixture "sage-theme".
src="$(cd "$(dirname "$0")/../../.." && pwd)/test/fixtures/projects/sage-theme"
cp -R "$src/." .
# Drop a detector cache left in the fixture by local hook runs (git-ignored, stale root).
rm -rf .kivo-wise
[ -f .lando.yml ] || printf "name: demo\nrecipe: wordpress\nconfig:\n  via: nginx\n" > .lando.yml
mkdir -p resources/css resources/views/components resources/views/blocks
cat > tailwind.config.js <<'JS'
module.exports = { content: ['./resources/**/*.blade.php'], theme: { extend: {} } };
JS
cat > vite.config.js <<'JS'
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [tailwindcss()] });
JS
cat > resources/css/app.css <<'CSS'
@import "tailwindcss";
@config "../../tailwind.config.js";

@theme {
  --color-fg: #111;
  --color-brand: #0a5;
}

.card { @apply rounded p-4 bg-brand; margin-top: theme(spacing.4); }
CSS
cat > resources/views/components/button.blade.php <<'BLADE'
@props(['tone' => 'brand'])
<button {{ $attributes->class(['px-4 py-2 text-fg', 'bg-'.$tone.'-500' => true]) }}>{{ $slot }}</button>
BLADE
cat > resources/views/blocks/hero.blade.php <<'BLADE'
<section class="bg-[#0a5a3c] text-white p-[37px]"><h1 class="text-fg">{{ $title }}</h1></section>
BLADE
