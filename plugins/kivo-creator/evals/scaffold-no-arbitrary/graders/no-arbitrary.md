---
type: regex
target: { source: file, path: .creator/run-1/scaffold/wp-content/mu-plugins/acme-core/resources/views/blocks/stats.blade.php }
pattern: '\b(?:text|bg|p[tbxy]?|m[tbxy]?|gap|leading|font)-\[[^\]]+\]|\bstyle\s*='
match: not_contains
weight: 2
---
