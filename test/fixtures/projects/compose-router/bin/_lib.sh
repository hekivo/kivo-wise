#!/usr/bin/env bash
# Shared helpers for the bin/ scripts: run a command in a Compose service,
# adding -T when stdin is not a TTY (pipes, CI, stdio MCP clients).
set -euo pipefail
compose_exec() {
  local service="$1"; shift
  if [ -t 0 ]; then docker compose exec "$service" "$@"; else docker compose exec -T "$service" "$@"; fi
}
