#!/usr/bin/env bash
set -euo pipefail
# Seed the workspace with the detector fixture "composer-mu-plugin".
src="$(cd "$(dirname "$0")/../../.." && pwd)/test/fixtures/projects/composer-mu-plugin"
cp -R "$src/." .
# Drop a detector cache left in the fixture by local hook runs (git-ignored, stale root).
rm -rf .kivo-wise
d=wp-content/mu-plugins/acme-core
mkdir -p $d/app/Livewire $d/resources/views/livewire
cat > $d/app/Livewire/SearchBar.php <<'PHP'
<?php

namespace AcmeCore\Livewire;

use Livewire\Component;

class SearchBar extends Component
{
    public string $query = '';

    public function updatedQuery(): void
    {
        $this->resetPage();
    }

    public function render()
    {
        return view('livewire.search-bar', [
            'results' => get_posts(['s' => $this->query, 'numberposts' => 5]),
        ]);
    }
}
PHP
cat > $d/resources/views/livewire/search-bar.blade.php <<'BLADE'
<div>
    <input type="text" wire:model="query" placeholder="Search">
    <ul>
        @foreach ($results as $post)
            <li wire:key="{{ $post->ID }}">{{ $post->post_title }}</li>
        @endforeach
    </ul>
</div>
BLADE
