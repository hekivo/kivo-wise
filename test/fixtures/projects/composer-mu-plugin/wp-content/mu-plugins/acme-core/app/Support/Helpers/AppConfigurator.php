<?php

namespace AcmeCore\Support\Helpers;

use Roots\Acorn\Application;

class AppConfigurator
{
    public static function configure(): Application
    {
        return Application::configure()
            ->withProviders([
                \AcmeCore\Providers\AppServiceProvider::class,
                \Log1x\Poet\PoetServiceProvider::class,
                \Log1x\AcfComposer\Providers\AcfComposerServiceProvider::class,
            ])
            ->withRouting(
                web: ACME_CORE_PATH . 'routes/web.php',
                wordpress: true,
            )
            ->withPaths(
                ACME_CORE_PATH . 'app',
                ACME_CORE_PATH . 'config',
                ACME_CORE_PATH . 'storage',
                ACME_CORE_PATH . 'resources',
                ACME_CORE_PATH . 'public',
            )
            ->boot();
    }
}
