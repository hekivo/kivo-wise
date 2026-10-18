---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only.

Judge the substance, not the wording. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing or any is contradicted. The response must be in English.

- reads the SearchBar component class and its Blade view before concluding
- identifies the root cause as a wire:model binding without the .live modifier (Livewire defers updates by default) or another concrete cause found in the files
- gives a concrete before/after fix
- includes a prevention test such as Livewire::test(SearchBar::class)->set('query', 'foo')->assertSee(...)
