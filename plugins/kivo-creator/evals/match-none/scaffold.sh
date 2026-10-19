#!/usr/bin/env bash
set -euo pipefail
fx="$(cd "$(dirname "$0")/../fixtures" && pwd)"
cp -R "$fx/projects/acme-mu-plugin/." .
mkdir -p .creator/run-1/specs
printf '*\n' > .creator/.gitignore
cp "$fx/runs/landing/specs/03-testimonial.json" .creator/run-1/specs/
