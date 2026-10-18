#!/usr/bin/env bash
set -euo pipefail
# Seed the workspace with the detector fixture "radicle".
src="$(cd "$(dirname "$0")/../.." && pwd)/test/fixtures/projects/radicle"
cp -R "$src/." .
# Drop a detector cache left in the fixture by local hook runs (git-ignored, stale root).
rm -rf .kivo-wise
