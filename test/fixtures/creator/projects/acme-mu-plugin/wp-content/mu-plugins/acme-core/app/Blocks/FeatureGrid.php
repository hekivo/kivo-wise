<?php

namespace AcmeCore\Blocks;

use Log1x\AcfComposer\Block;
use Log1x\AcfComposer\Builder;

/**
 * @creator-when A grid of product features, each with an icon, a title and a short text.
 */
class FeatureGrid extends Block
{
    public $name = 'Feature Grid';

    public $description = 'Up to six features in a grid.';

    public function fields(): array
    {
        $fields = Builder::make($this->slug);

        $fields
            ->addText('title')
            ->addRepeater('items', ['min' => 1, 'max' => 6])
                ->addText('title')
                ->addTextarea('text')
                ->addImage('icon')
            ->endRepeater();

        return $fields->build();
    }
}
