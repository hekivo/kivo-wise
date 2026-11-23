#!/usr/bin/env bash
set -euo pipefail
# Seed the workspace with the detector fixture "compose-bin" (Sage theme on the kivo-wp
# Compose contract: compose.yaml with x-kivo-wp, the gitignored override, bin/ scripts).
src="$(cd "$(dirname "$0")/../.." && pwd)/test/fixtures/projects/compose-bin"
cp -R "$src/." .
# Drop a detector cache left in the fixture by local hook runs (git-ignored, stale root).
rm -rf .kivo-wise
