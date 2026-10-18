<?php

use Roots\Acorn\Application;

require __DIR__ . '/vendor/autoload.php';

Application::configure()->withProviders([App\Providers\ThemeServiceProvider::class])->boot();
