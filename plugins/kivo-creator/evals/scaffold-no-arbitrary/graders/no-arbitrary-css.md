---
type: regex
target: { source: file, path: .creator/run-1/scaffold/wp-content/mu-plugins/acme-core/resources/css/blocks/stats.css }
pattern: '\b(?:text|bg|p[tbxy]?|m[tbxy]?|gap|leading|font)-\[[^\]]+\]|font-size\s*:\s*13px'
match: not_contains
---
