<?php

namespace AcmeCore\Providers;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;

class BladeServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Blade::directive('textarea', fn ($expression) => "<?php echo nl2br(e({$expression})); ?>");
    }
}
