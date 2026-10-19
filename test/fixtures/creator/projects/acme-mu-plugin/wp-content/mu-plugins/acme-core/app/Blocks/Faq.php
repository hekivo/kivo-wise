<?php

namespace AcmeCore\Blocks;

use Log1x\AcfComposer\Block;
use Log1x\AcfComposer\Builder;

/**
 * @creator-when Questions and answers, shown as an accordion.
 */
class Faq extends Block
{
    public $name = 'FAQ';

    public $slug = 'faq';

    public $description = 'Frequently asked questions with expandable answers.';

    public function fields(): array
    {
        $fields = Builder::make($this->slug);

        $fields
            ->addText('title')
            ->addRepeater('questions', ['min' => 1])
                ->addText('question')
                ->addWysiwyg('answer')
            ->endRepeater();

        return $fields->build();
    }
}
