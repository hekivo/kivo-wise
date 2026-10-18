<?php

namespace App\Providers;

use Roots\Acorn\ServiceProvider;

class BlocksServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        add_action('init', function () {
            register_block_type(resource_path('blocks/hero'));
        });
    }
}
