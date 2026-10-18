#!/usr/bin/env bash
set -euo pipefail
# Seed the workspace with the detector fixture "sage-theme".
src="$(cd "$(dirname "$0")/../.." && pwd)/test/fixtures/projects/sage-theme"
cp -R "$src/." .
# Drop a detector cache left in the fixture by local hook runs (git-ignored, stale root).
rm -rf .kivo-wise
[ -f .lando.yml ] || printf "name: demo\nrecipe: wordpress\nconfig:\n  via: nginx\n" > .lando.yml
