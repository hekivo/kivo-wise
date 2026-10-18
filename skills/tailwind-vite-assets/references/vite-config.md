# Vite configuration per profile

Deep reference for `vite.config.js` and `config/assets.php`. Loaded on demand from `SKILL.md`.

All three profiles use the same plugin set. Only `base`, the output folder and the dev-server settings change. The examples below are templates; adapt names and ports.

## Common options of `laravel-vite-plugin`

| Option | Default | Meaning |
|---|---|---|
| `input` | required | Entry files: CSS and JS the browser or editor loads |
| `publicDirectory` | `public` | Folder (relative to the Acorn base path) that holds build output and the `hot` file |
| `buildDirectory` | `build` | Sub-folder of the public directory for compiled files |
| `hotFile` | `<public>/hot` | Marker file written while the dev server runs |
| `refresh` | false | Full reload when matching files change (`true` watches Blade/PHP view paths) |
| `assets` | none | Extra globs copied into the build and added to the manifest (images, fonts) |

Keep `publicDirectory` and `buildDirectory` at the defaults. Acorn's `Vite` class assumes `public/build` below the base path.

## `sage-theme`

```js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import laravel from 'laravel-vite-plugin';
import { wordpressPlugin, wordpressThemeJson } from '@roots/vite-plugin';

if (!process.env.APP_URL) process.env.APP_URL = 'http://example.test';

export default defineConfig({
  // Public URL path of <theme>/public/build on THIS site.
  base: '/wp-content/themes/<theme>/public/build/',
  plugins: [
    tailwindcss(),
    laravel({
      input: ['resources/css/app.css', 'resources/js/app.js',
              'resources/css/editor.css', 'resources/js/editor.js'],
      refresh: true,
      assets: ['resources/images/**', 'resources/fonts/**'],
    }),
    wordpressPlugin(),
    wordpressThemeJson(),
  ],
  resolve: { alias: { '@images': '/resources/images', '@fonts': '/resources/fonts' } },
});
```

The Sage starter sets `base` for a Bedrock layout (`/app/themes/sage/public/build/`). On a layout without Bedrock the content folder is `wp-content`, so the base changes. A wrong base shows up as correct manifest URLs but broken font/image references inside CSS.

`wordpressThemeJson` reads the Tailwind theme and writes `theme.json` into the build; the starter then points WordPress at it with a `theme_file_path` filter. Drop the plugin on a theme that hand-maintains `theme.json`.

## `acorn-mu-plugin`

```js
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/wp-content/mu-plugins/<plugin>/public/build/' : '/',
  plugins: [tailwindcss(), laravel({ input: ['resources/css/app.css', 'resources/js/app.js'], refresh: true })],
  server: { host: '0.0.0.0', port: 5173, strictPort: true, hmr: { host: 'localhost', port: 5173 } },
}));
```

A plugin has no theme manifest, so publish `config/assets.php` in the plugin:

```php
return [
    'default' => 'my-plugin',
    'manifests' => [
        'my-plugin' => [
            'path' => MY_PLUGIN_PATH.'public/build',
            'url'  => MY_PLUGIN_URL.'public/build',
        ],
    ],
];
```

Rules:

- Both `path` and `url` must end with `build`. Acorn's Vite middleware leaves such a manifest alone; with a path that does not end in `build` it swaps in the active theme's `public/build`, and every `Vite::asset()` URL points to the wrong place.
- Omit the `assets` and `bundles` keys. Vite reads its own manifest; a listed file that does not exist yet makes manifest loading throw before the first build.
- `Vite::asset()` prepends the build directory itself; Acorn then collapses a doubled `/build/build/` in the final URL, which is why the `url` ending in `build` still works.
- Define the path and URL constants early (before Acorn boots), for example in the mu-plugin's main file.
- If the plugin enqueues with `wp_enqueue_*` instead of `@vite`, call `Vite::asset()` for each file and pass the URL; the dev server is detected by the hot file, so keep the hot file inside the plugin's `public/`.

Multi-entry discovery (all files in `resources/css/blocks/`, `resources/js/blocks/`) can be done with a small `fs` scan building the `input` array; a new file becomes an entry on the next build. Keep a fixed list for the base entries and scan only for folders that grow.

## `radicle-app`

```js
export default defineConfig({
  base: '/build/',
  server: { host: '0.0.0.0', port: 5174, strictPort: true, hmr: { host: 'localhost', port: 5174 } },
  plugins: [tailwindcss(), laravel({ input: [/* css and js entries */], refresh: true }), wordpressPlugin()],
});
```

The Acorn base path is the project root, so `public/build` is directly under the webroot and the public URL is `/build/`. The project ships `config/assets.php`; check that its manifest `path` ends in `build`. Native blocks are bundled the same way: list each block's `index.js` and `style` file as entries and let `wordpressPlugin()` externalise `@wordpress/*`; the generated `editor.deps.json` gives the script dependencies to pass to `wp_enqueue_script`.

## Verifying the manifest

- `public/build/manifest.json` has one object per entry with a `file` property (and `css` arrays).
- `{{runner.wp}} eval 'echo Illuminate\Support\Facades\Vite::asset("resources/css/app.css");'` prints the URL the browser will request; open it.
