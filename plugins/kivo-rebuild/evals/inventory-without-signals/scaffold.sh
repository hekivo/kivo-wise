#!/usr/bin/env bash
set -euo pipefail
fx="$(cd "$(dirname "$0")/../fixtures" && pwd)"
cp -R "$fx/projects/acme-store/." .
# No search data, and no inventory built yet: the case checks the rebuild from urls.json alone.
rm -f .rebuild/runs/2026-01-02-acme/signals.json .rebuild/runs/2026-01-02-acme/inventory.json
