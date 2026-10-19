#!/usr/bin/env bash
set -euo pipefail
fx="$(cd "$(dirname "$0")/../fixtures" && pwd)"
cp -R "$fx/projects/acme-mu-plugin/." .
