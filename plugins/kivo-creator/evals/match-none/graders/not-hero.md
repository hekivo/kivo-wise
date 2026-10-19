---
type: regex
target: { source: file, path: .creator/run-1/match-plan.json }
pattern: '"decision":\s*\{[^}]*"block":\s*"acf/hero"'
match: not_contains
weight: 2
---
