#!/usr/bin/env bash
set -euo pipefail
# Seed the workspace with the detector fixture "sage-theme".
src="$(cd "$(dirname "$0")/../../.." && pwd)/test/fixtures/projects/sage-theme"
cp -R "$src/." .
# Drop a detector cache left in the fixture by local hook runs (git-ignored, stale root).
rm -rf .kivo-wise
[ -f .lando.yml ] || printf "name: demo\nrecipe: wordpress\nconfig:\n  via: nginx\n" > .lando.yml
mkdir -p inc
cat > functions.php <<'PHP'
<?php
require_once get_theme_file_path('inc/cpt.php');
require_once get_theme_file_path('inc/queries.php');
add_action('wp_enqueue_scripts', fn () => wp_enqueue_style('legacy', get_stylesheet_uri()));
add_filter('the_content', fn ($c) => $c . '<!-- legacy -->');
PHP
cat > inc/cpt.php <<'PHP'
<?php
add_action('init', function () {
    register_post_type('case_study', ['public' => true, 'label' => 'Case Studies', 'show_in_rest' => true]);
});
PHP
cat > inc/queries.php <<'PHP'
<?php
function legacy_signups() {
    global $wpdb;
    return $wpdb->get_results("SELECT * FROM {$wpdb->prefix}signups");
}
function legacy_featured() {
    return new WP_Query(['post_type' => 'case_study', 'posts_per_page' => 3]);
}
PHP
printf '<?php get_header(); get_template_part("parts/loop"); get_footer();' > page.php
printf '<?php get_header(); the_content(); get_footer();' > single.php
