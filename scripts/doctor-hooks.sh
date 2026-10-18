#!/usr/bin/env bash
# Hook diagnostics for kivo-wise.
# Usage: scripts/doctor-hooks.sh   (run from the project you are debugging)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOOKS_DIR="${ROOT_DIR}/hooks"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}=== kivo-wise hooks diagnostics ===${NC}\n"

echo -e "${BLUE}1. Node${NC}"
if command -v node >/dev/null 2>&1; then
  echo -e "${GREEN}✓ node $(node --version)${NC} (hooks need Node 20 or newer)"
else
  echo -e "${RED}✗ node not found in PATH; every hook is a Node ESM script${NC}"
fi
echo ""

echo -e "${BLUE}2. Hook scripts${NC}"
for hook in lib.mjs session-start.mjs user-prompt-router.mjs protect-files.mjs post-edit-reminder.mjs pre-commit-attribution.mjs; do
  if [ -f "${HOOKS_DIR}/${hook}" ]; then
    echo -e "${GREEN}✓ ${hook}${NC}"
  else
    echo -e "${RED}✗ ${hook} missing${NC}"
  fi
done
echo ""

echo -e "${BLUE}3. Manifests${NC}"
for manifest in hooks.json cursor-hooks.json; do
  file="${HOOKS_DIR}/${manifest}"
  if [ -f "$file" ] && node -e "JSON.parse(require('node:fs').readFileSync('$file','utf8'))" 2>/dev/null; then
    echo -e "${GREEN}✓ ${manifest} (valid JSON)${NC}"
  else
    echo -e "${RED}✗ ${manifest} missing or invalid${NC}"
  fi
done
if node "${ROOT_DIR}/scripts/sync-cursor-hooks.mjs" --check >/dev/null 2>&1; then
  echo -e "${GREEN}✓ cursor-hooks.json in sync with hooks.json${NC}"
else
  echo -e "${YELLOW}⚠ cursor-hooks.json out of sync; run: node scripts/sync-cursor-hooks.mjs${NC}"
fi
echo ""

echo -e "${BLUE}4. Detector${NC}"
DETECTOR="${KIVO_WISE_DETECTOR:-${ROOT_DIR}/scripts/detect-roots-project.mjs}"
if [ -f "$DETECTOR" ]; then
  echo -e "${GREEN}✓ ${DETECTOR}${NC}"
  node "$DETECTOR" --path="$(pwd)" --format=text 2>/dev/null | sed 's/^/    /' || echo -e "${YELLOW}    (detector returned nothing for $(pwd))${NC}"
else
  echo -e "${RED}✗ detector not found at ${DETECTOR}; session-start stays silent${NC}"
fi
if [ -f ".kivo-wise/context.json" ]; then
  echo -e "  cache: .kivo-wise/context.json present (10-minute TTL; delete it to force a re-run)"
fi
echo ""

echo -e "${BLUE}5. Logging${NC}"
if [ "${KIVO_WISE_HOOK_DEBUG:-0}" = "1" ]; then
  echo -e "${GREEN}✓ KIVO_WISE_HOOK_DEBUG=1${NC}"
else
  echo -e "${YELLOW}⚠ debug off; enable with: export KIVO_WISE_HOOK_DEBUG=1${NC}"
fi
LOG_FILE="${KIVO_WISE_HOOK_LOG:-.kivo-wise/hooks.log}"
echo "  log file: ${LOG_FILE}"
if [ -f "$LOG_FILE" ]; then
  tail -5 "$LOG_FILE" | sed 's/^/    /'
fi
echo ""

echo -e "${BLUE}6. Manual runs (JSON on stdin)${NC}"
cat <<'EOT'
  echo '{"cwd":"'"$PWD"'","source":"startup"}' | node hooks/session-start.mjs
  echo '{"prompt":"lando wp acorn optimize:clear"}' | node hooks/user-prompt-router.mjs
  echo '{"cwd":"'"$PWD"'","tool_name":"Write","tool_input":{"file_path":".env"}}' | node hooks/protect-files.mjs; echo "exit $?"
  echo '{"cwd":"'"$PWD"'","tool_name":"Edit","tool_input":{"file_path":"app/Providers/ThemeServiceProvider.php"}}' | node hooks/post-edit-reminder.mjs
  echo '{"cwd":"'"$PWD"'","tool_name":"Bash","tool_input":{"command":"git commit -m test"}}' | node hooks/pre-commit-attribution.mjs
  node --test test/hooks.test.mjs
EOT
echo ""
echo -e "${BLUE}=== done ===${NC}"
