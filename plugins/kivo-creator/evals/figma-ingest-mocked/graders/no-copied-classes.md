---
type: regex
target: trace
pattern: 'specs/[^"]*\.json[^}]*(px-\[|text-\[|var\(--color)'
match: not_contains
weight: 2
---
