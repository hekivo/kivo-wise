#!/usr/bin/env bash
set -euo pipefail
fx="$(cd "$(dirname "$0")/../fixtures" && pwd)"
cp -R "$fx/projects/acme-store/." .
# A recorded failed read test: the case checks the guidance, not the network.
cat > .rebuild/connections.json <<'EOF'
{
  "schema_version": 1,
  "kind": "connections",
  "generated_at": "2026-01-02T09:00:00.000Z",
  "items": [
    {
      "source": "gsc",
      "path": "api",
      "ok": false,
      "identity": "reader@acme-proj.iam.example.test",
      "error": "reader@acme-proj.iam.example.test is not a user of sc-domain:example.test: add it in Search Console > Settings > Users and permissions (Restricted is enough)",
      "tested_at": "2026-01-02T09:00:00.000Z"
    }
  ],
  "tools": { "gcloud": true, "gh": false, "op": false, "playwright": false }
}
EOF
