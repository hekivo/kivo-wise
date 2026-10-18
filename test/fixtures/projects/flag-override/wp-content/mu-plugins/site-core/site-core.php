<?php
/**
 * Plugin Name: Site Core (fixture)
 */

use Roots\Acorn\Application;

define('ACORN_BASEPATH', __DIR__);

add_action('after_setup_theme', function () {
    Application::configure()->boot();
}, 5);
