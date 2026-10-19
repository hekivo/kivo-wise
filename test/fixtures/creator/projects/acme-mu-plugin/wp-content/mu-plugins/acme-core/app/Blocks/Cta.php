<?php

namespace AcmeCore\Blocks;

use Log1x\AcfComposer\Block;
use Log1x\AcfComposer\Builder;

/**
 * @creator-when A closing call to action with one or two buttons and no image.
 */
class Cta extends Block
{
    public $name = 'Call to Action';

    public $slug = 'cta';

    public $description = 'Heading, short text and up to two buttons.';

    public function fields(): array
    {
        $fields = Builder::make($this->slug);

        $fields
            ->addText('title')
            ->addTextarea('text')
            ->addLink('primary')
            ->addLink('secondary');

        return $fields->build();
    }
}
