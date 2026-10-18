#!/usr/bin/env bash
set -euo pipefail
# Seed the workspace with the detector fixture "radicle".
src="$(cd "$(dirname "$0")/../.." && pwd)/test/fixtures/projects/radicle"
cp -R "$src/." .
# Drop a detector cache left in the fixture by local hook runs (git-ignored, stale root).
rm -rf .kivo-wise

# The case_study post type and an existing Pest suite that boots WordPress (Radicle style).
cat > config/post-types.php <<'PHP'
<?php

return [
    "post_types" => [
        "project" => ["names" => ["singular" => "Project"]],
        "case_study" => [
            "show_in_rest" => true,
            "names" => ["singular" => "Case Study", "plural" => "Case Studies", "slug" => "case-studies"],
        ],
    ],
    "taxonomies" => [],
];
PHP
# Plain bash (no node/python: the scaffold runs with a minimal HOME).
cat > composer.json <<'JSON'
{
  "name": "demo/radicle-site",
  "type": "project",
  "require": {
    "php": ">=8.3",
    "roots/acorn": "^6.0",
    "roots/acorn-post-types": "^1.0",
    "roots/bedrock-autoloader": "^1.0",
    "roots/wordpress": "6.9.4",
    "roots/wp-config": "^1.0"
  },
  "require-dev": {
    "pestphp/pest": "^3.8"
  },
  "autoload": {
    "psr-4": {
      "App\\": "app/"
    }
  },
  "scripts": {
    "test": "pest"
  },
  "config": {
    "allow-plugins": {
      "pestphp/pest-plugin": true
    }
  },
  "extra": {
    "acorn": {
      "providers": [
        "App\\Providers\\ThemeServiceProvider",
        "App\\Providers\\BlocksServiceProvider"
      ]
    },
    "installer-paths": {
      "public/content/mu-plugins/{$name}/": ["type:wordpress-muplugin"],
      "public/content/plugins/{$name}/": ["type:wordpress-plugin"],
      "public/content/themes/{$name}/": ["type:wordpress-theme"]
    },
    "wordpress-install-dir": "public/wp"
  }
}
JSON
cat > composer.lock <<'JSON'
{
  "_readme": ["fixture lock: only the packages the detector reads"],
  "packages": [
    { "name": "johnbillion/extended-cpts", "version": "5.1.0" },
    { "name": "roots/acorn", "version": "v6.3.0" },
    { "name": "roots/acorn-post-types", "version": "v1.0.0" },
    { "name": "roots/wordpress", "version": "6.9.4" }
  ],
  "packages-dev": [
    { "name": "pestphp/pest", "version": "v3.8.2" },
    { "name": "phpunit/phpunit", "version": "11.5.15" }
  ]
}
JSON
mkdir -p tests/Feature
cat > phpunit.xml <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<phpunit bootstrap="vendor/autoload.php" colors="true">
    <testsuites>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>
</phpunit>
XML
cat > tests/Pest.php <<'PHP'
<?php

/*
 * Loads WordPress once per run, against the database configured in .env. The tracked
 * mu-plugin (public/content/mu-plugins/00-acorn-boot.php) boots Acorn on after_setup_theme,
 * so tests run with hooks, the container, the registered post types and the database live.
 */

Dotenv\Dotenv::createUnsafeImmutable(dirname(__DIR__))->safeLoad();
putenv('WP_ENV=testing');

define('WP_USE_THEMES', false);
require_once dirname(__DIR__) . '/public/wp-config.php';
PHP
cat > tests/Feature/HomeTest.php <<'PHP'
<?php

it('registers the project post type', function () {
    expect(post_type_exists('project'))->toBeTrue();
});

it('renders the home page', function () {
    $response = wp_remote_get(home_url('/'), ['sslverify' => false]);

    expect(wp_remote_retrieve_response_code($response))->toBe(200);
});
PHP
