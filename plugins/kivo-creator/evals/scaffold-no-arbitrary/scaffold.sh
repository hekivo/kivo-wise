#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fx="$here/../fixtures"
cp -R "$fx/projects/acme-mu-plugin/." .
mkdir -p .creator/run-1/specs
printf '*\n' > .creator/.gitignore
cp "$fx/runs/landing/specs/04-stats.json" .creator/run-1/specs/
cp "$here/plan.json" .creator/run-1/match-plan.json
