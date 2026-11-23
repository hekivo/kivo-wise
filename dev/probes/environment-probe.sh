#!/usr/bin/env bash
# Read-only probe for the Compose runner design (docs/specs/2026-11-22-kivo-wise-compose-runner-design.md).
#
# Run it once in each place the design has only documented facts for: a cloud agent session, a
# GitHub Codespace and an editor devcontainer built from the wp-kit template. It answers the facts
# marked "documented; cloud probe pending" (Q-021, Q-022, Q-026).
#
# Safety rules:
# - Prints only the presence of environment variables, never their values, except for the
#   identity signals listed in SIGNAL_VALUES, which are documented as non-secret booleans or names.
# - Network checks print the host and the HTTP status code only; no body, no headers. A 400 or 401
#   from a registry root still means the host is reachable; 000 (no connection) or a 403 from the
#   session proxy means the host is not on the allowlist.
# - Writes nothing outside the output file given as the first argument (default: stdout).
#
# Usage: dev/probes/environment-probe.sh [output-file]

set -u

OUT="${1:-/dev/stdout}"

# Signals whose values are safe to print.
SIGNAL_VALUES=(CLAUDE_CODE_REMOTE CODESPACES REMOTE_CONTAINERS KIVO_WP_CONTEXT)
# Signals reported as set/unset only.
SIGNAL_PRESENCE=(CLAUDE_CODE_REMOTE_SESSION_ID CODESPACE_NAME GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN COMPOSER_AUTH COMPOSE_FILE COMPOSE_PROJECT_NAME DOCKER_HOST)

# Hosts a wp-kit project needs: package registries, WordPress.org, container registries,
# the licensed ACF endpoint and the documentation hosts used as the corpus fallback.
HOSTS=(
  https://repo.packagist.org/packages.json
  https://wpackagist.org/
  https://api.wordpress.org/core/version-check/1.7/
  https://downloads.wordpress.org/
  https://registry.npmjs.org/
  https://registry-1.docker.io/v2/
  https://ghcr.io/v2/
  https://pkg-containers.githubusercontent.com/
  https://connect.advancedcustomfields.com/
  https://developer.wordpress.org/
  https://roots.io/
  https://docs.docker.com/
  https://containers.dev/
)

probe() {
  echo "# environment probe $(date -u +%Y-%m-%dT%H:%M:%SZ)"

  echo "## identity signals"
  for name in "${SIGNAL_VALUES[@]}"; do
    if [ -n "${!name+x}" ]; then echo "$name=${!name}"; else echo "$name unset"; fi
  done
  for name in "${SIGNAL_PRESENCE[@]}"; do
    if [ -n "${!name+x}" ]; then echo "$name set"; else echo "$name unset"; fi
  done
  [ -f /.dockerenv ] && echo "/.dockerenv present" || echo "/.dockerenv absent"
  [ -f /run/.containerenv ] && echo "/run/.containerenv present" || echo "/run/.containerenv absent"

  echo "## os"
  if [ -r /etc/os-release ]; then grep -E '^(ID|VERSION_ID)=' /etc/os-release; fi
  uname -m

  echo "## node (hooks need 20+)"
  if command -v node >/dev/null 2>&1; then
    echo "node $(node --version) at $(command -v node)"
  else
    echo "node not on PATH"
  fi
  for d in /opt/node20 /opt/node21 /opt/node22; do [ -x "$d/bin/node" ] && echo "$d/bin/node $("$d/bin/node" --version)"; done

  echo "## docker"
  if command -v docker >/dev/null 2>&1; then
    echo "docker CLI at $(command -v docker)"
    docker version --format 'server {{.Server.Version}}' 2>/dev/null || echo "docker daemon not reachable"
    docker compose version --short 2>/dev/null | sed 's/^/compose /' || echo "docker compose plugin missing"
  else
    echo "docker CLI not on PATH"
  fi

  echo "## project"
  for f in compose.yaml compose.yml docker-compose.yaml docker-compose.yml compose.override.yaml .devcontainer/devcontainer.json bin/wp bin/_lib.sh; do
    [ -e "$f" ] && echo "$f present" || echo "$f absent"
  done

  echo "## network (HTTP status only)"
  if command -v curl >/dev/null 2>&1; then
    for url in "${HOSTS[@]}"; do
      code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$url" 2>/dev/null)
      echo "${code:-000} $url"
    done
  else
    echo "curl not on PATH"
  fi
}

probe > "$OUT" 2>&1
