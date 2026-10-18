<?php
/**
 * Plugin Name: Acme Core (fixture)
 * Description: Synthetic stand-in for an Acorn mu-plugin that owns the site's business logic.
 */

use AcmeCore\Support\Helpers\AppConfigurator;

define('ACME_CORE_PATH', plugin_dir_path(__FILE__));
define('ACORN_BASEPATH', ACME_CORE_PATH);

require_once ACME_CORE_PATH . 'vendor/autoload.php';

if (! class_exists(\Roots\Acorn\Application::class)) {
    return;
}

add_action('after_setup_theme', function () {
    $app = AppConfigurator::configure();
}, 10);
