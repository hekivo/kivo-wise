#!/usr/bin/env bash
set -euo pipefail
fx="$(cd "$(dirname "$0")/../fixtures" && pwd)"
cp -R "$fx/projects/acme-store/." .
run=.rebuild/runs/2026-01-02-acme
mkdir -p "$run/fragments/features"
# The feature list of the content area: the fragment, and the features.json that merging it produces.
cat > "$run/fragments/features/content.json" <<'EOF'
{
  "items": [
    {
      "id": "F-content-home-banners",
      "area": "content",
      "name": "Home page banners",
      "source": "legacy/db/banners.json (post type acme_banner)",
      "behaviour": "The home page shows one banner slide for each published acme_banner post, with its image and link.",
      "evidence": "banners.json lists 4 published acme_banner posts, each with an image and a link",
      "data": { "banners": 4 }
    }
  ]
}
EOF
cat > "$run/features.json" <<'EOF'
{
  "schema_version": 1,
  "kind": "features",
  "run_id": "2026-01-02-acme",
  "generated_at": "2026-01-02T11:00:00.000Z",
  "items": [
    {
      "id": "F-content-home-banners",
      "area": "content",
      "name": "Home page banners",
      "source": "legacy/db/banners.json (post type acme_banner)",
      "behaviour": "The home page shows one banner slide for each published acme_banner post, with its image and link.",
      "evidence": "banners.json lists 4 published acme_banner posts, each with an image and a link",
      "data": { "banners": 4 }
    }
  ]
}
EOF
