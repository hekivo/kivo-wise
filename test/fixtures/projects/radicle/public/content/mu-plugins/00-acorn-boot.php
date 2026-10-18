<?php
// Fixture: boots the Acorn application from the project root before any theme code runs.
use Roots\Acorn\Application;

add_action(
    'after_setup_theme',
    function () {
        Application::configure()
            ->withProviders(config('app.providers', []))
            ->boot();
    },
    0,
);
