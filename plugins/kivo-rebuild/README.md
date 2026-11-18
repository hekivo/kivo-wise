# kivo-rebuild

Rebuild an existing WordPress site on the Roots stack without losing what the live site does. kivo-rebuild connects
the search and measurement sources, surveys the live site into a URL inventory with a proposed decision per URL,
groups URLs by the template that renders them, inventories the legacy features and classifies each one against the
new project.

```
connect ─▶ crawl ─▶ signals ─▶ inventory ─▶ templates ─▶ (review) ─▶ features ─▶ parity ─▶ (gaps) ─▶ board
```

Requires the [kivo-wise](../../README.md) plugin and Node.js 20+.
