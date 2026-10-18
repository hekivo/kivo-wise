#!/usr/bin/env bash
set -euo pipefail
# Seed the workspace with the detector fixture "composer-mu-plugin".
src="$(cd "$(dirname "$0")/../.." && pwd)/test/fixtures/projects/composer-mu-plugin"
cp -R "$src/." .
# Drop a detector cache left in the fixture by local hook runs (git-ignored, stale root).
rm -rf .kivo-wise
