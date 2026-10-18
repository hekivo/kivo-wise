<?php
// Fixture stand-in for the site configuration that Radicle keeps under bedrock/.
// The only lines the detector reads are the two defines below.
$root_dir = dirname(__DIR__);
define('ACORN_BASEPATH', $root_dir);
Config::define('WP_DEFAULT_THEME', 'radicle');
