<?php

namespace App\Blocks;

use Log1x\AcfComposer\Block;
use Log1x\AcfComposer\Builder;

/**
 * @creator-when The first section of a landing page: main heading, lead text, one image and a call to action.
 */
class Hero extends Block
{
    public $name = 'Hero';

    public $description = 'Page opening with a heading, a lead, an image and a button.';

    public function fields(): array
    {
        $fields = Builder::make($this->slug);

        $fields
            ->addText('title')
            ->addTextarea('lead')
            ->addImage('image')
            ->addLink('cta');

        return $fields->build();
    }
}
