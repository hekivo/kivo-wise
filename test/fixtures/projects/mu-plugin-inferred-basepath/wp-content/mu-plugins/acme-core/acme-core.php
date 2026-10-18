<?php
/**
 * Plugin Name: Acme Core (fixture)
 */

use Roots\Acorn\Application;

require_once __DIR__ . '/vendor/autoload.php';

add_action('after_setup_theme', function () {
    Application::configure()->boot();
});
