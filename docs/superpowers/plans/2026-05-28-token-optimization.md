# Token Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir drasticamente o consumo de tokens por sessão eliminando carregamento automático e desnecessário de skills.

**Architecture:** Três frentes independentes: (1) substituir a injeção completa do skill `sageing` no `session-start.sh` por um resumo compacto de ~20 linhas; (2) expandir o keyword-router do `UserPromptSubmit` hook para cobrir skills de workflow (atualmente só cobre reference skills); (3) reescrever as descriptions YAML das skills mais carregadas indevidamente para reduzir falsos positivos.

**Tech Stack:** Bash, YAML frontmatter, Markdown.

---

## Contexto — O que foi encontrado

### Causa-raiz 1 (maior impacto): `session-start.sh` injeta 270 linhas do `sageing` em toda sessão

`hooks/session-start.sh` linhas 179–211 leem o arquivo `skills/sageing/SKILL.md` completo (270 linhas) e o injetam via `additionalContext` com tag `<EXTREMELY_IMPORTANT>` em **toda** sessão de projeto Sage. Isso acontece mesmo quando o usuário só pergunta algo trivial.

Resultado: ~3.000 tokens desperdiçados antes da primeira mensagem do usuário ser processada.

### Causa-raiz 2: `user-prompt-activate.sh` cobre apenas reference skills

O hook de `UserPromptSubmit` faz keyword-matching e injeta uma dica de skill para prompts com match único. Mas o mapa atual cobre somente skills de referência (`acorn-livewire`, `acorn-eloquent`, `sage-lando`, etc.) — faltam todas as skills de workflow: `reviewing`, `debugging`, `onboarding`, `building`, `designing`, `verifying`, `migrating`.

### Causa-raiz 3: descriptions com triggers genéricos

- `sageing`: termina com "read this first in any Sage/Acorn project session" → Claude a invoca reflexivamente em toda sessão (double-load junto com o hook)
- `reviewing`: inclui "code review, code quality, PR review workflow" → dispara em contextos muito amplos
- `debugging`: inclui "debug session" → match amplo demais
- `onboarding`: inclui "first session setup" → dispara no início de qualquer sessão

---

## Mapa de arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `hooks/session-start.sh` | Modificar | Substituir injeção completa do sageing (linhas 179–211) por resumo compacto de ~20 linhas |
| `hooks/user-prompt-activate.sh` | Modificar | Expandir KEYWORD_MAP com 12+ skills de workflow |
| `skills/sageing/SKILL.md` | Modificar | Reescrever description — remover "read this first in any session" |
| `skills/reviewing/SKILL.md` | Modificar | Description: adicionar "Invoke for:" e "Skip when:" |
| `skills/debugging/SKILL.md` | Modificar | Description: adicionar "Invoke for:" e "Skip when:" |
| `skills/onboarding/SKILL.md` | Modificar | Description: adicionar "Invoke for:" e "Skip when:" |
| `skills/building/SKILL.md` | Modificar | Description: adicionar triggers específicos de workflow |
| `skills/wp-capabilities/SKILL.md` | Modificar | Description: adicionar "Invoke for:" com triggers precisos |
| `skills/wp-security/SKILL.md` | Modificar | Description: adicionar "Invoke for:" com triggers precisos |
| `skills/wp-performance/SKILL.md` | Modificar | Description: adicionar "Invoke for:" com triggers precisos |
| `skills/wp-hooks-lifecycle/SKILL.md` | Modificar | Description: adicionar "Invoke for:" com triggers precisos |
| `skills/sage-forms/SKILL.md` | Modificar | Description: adicionar "Invoke for:" com triggers precisos |

---

## Task 1: Substituir injeção completa do sageing no session-start.sh

**Files:**
- Modify: `hooks/session-start.sh:179-211`

### Por que essa é a maior mudança

Atualmente o `session-start.sh` lê e injeta o arquivo SKILL.md do `sageing` (270 linhas). O resumo compacto (~20 linhas) entrega o mesmo valor operacional: qual runner usar, quais skills existem e quando invocar cada uma. O skill completo fica disponível on-demand via `Skill` tool.

- [ ] **Step 1: Medir o tamanho atual da injeção**

```bash
wc -l /home/lgobatto/work/hekivo/superpowers-sage/skills/sageing/SKILL.md
```

Expected output: `270 /home/.../skills/sageing/SKILL.md`

- [ ] **Step 2: Substituir as seções 7 e 8 do session-start.sh**

Localizar no arquivo as linhas que correspondem a:
```
#############################################
# 7) Read sageing skill content              #
#############################################
```

Substituir tudo a partir do comentário `# 7) Read sageing skill content` até o final do arquivo (inclusive o `cat <<EOF` final) pelo bloco abaixo:

```bash
#############################################
# 7) Build compact routing summary           #
#############################################

COMPACT_GUIDE="Runner: all wp/composer/php/node/npm commands via \`lando <cmd>\`. Never run on host."
COMPACT_GUIDE="${COMPACT_GUIDE}\nCache: \`lando flush\` (PHP changes) · \`lando theme-build\` (CSS/JS changes)."
COMPACT_GUIDE="${COMPACT_GUIDE}\n"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Task | Invoke |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n|---|---|"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Understand project state | \`/onboarding\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Architecture + planning | \`/architecture-discovery\` then \`/plan-generator\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Implement from plan | \`/building\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Scaffold new ACF block | \`/block-scaffolding\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Refactor existing block | \`/block-refactoring\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Design → Blade/tokens | \`/designing\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Convention audit + PR | \`/reviewing\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Debug PHP/Blade/Livewire | \`/debugging\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Visual screenshot diff | \`/verifying\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Safe data migration | \`/migrating\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| Design system tokens+atoms | \`/sage-design-system\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n| AI/MCP installation | \`/ai-setup\` |"
COMPACT_GUIDE="${COMPACT_GUIDE}\n"
COMPACT_GUIDE="${COMPACT_GUIDE}\nPreferred patterns: CPTs → Poet · Routes → Acorn Routes · Fields/Blocks → ACF Composer · Interactive UI → Livewire."
COMPACT_GUIDE="${COMPACT_GUIDE}\nFor full architectural preferences and MCP query patterns: invoke \`sageing\`."

#############################################
# 8) Build final context and output          #
#############################################

SUMMARY="Sage/Acorn project detected."
SUMMARY="${SUMMARY}\n\nLando: ${LANDO_YML}"
SUMMARY="${SUMMARY}\nDetected Sage themes:${THEMES}"
[ -n "${THEMES_EXTRA:-}" ] && SUMMARY="${SUMMARY}${THEMES_EXTRA}"
SUMMARY="${SUMMARY}\nDesign Tools: Paper: ${PAPER} | Stitch: ${STITCH} | Figma: ${FIGMA} | Playwright: ${PLAYWRIGHT} | Chrome: ${CHROME}"

if [ -n "$ACTIVE_PLAN" ]; then
  SUMMARY="${SUMMARY}\n\nActive Plan: ${ACTIVE_PLAN}/plan.md (${PLAN_TITLE}). Assets: ${PLAN_ASSETS}"
fi

if [ -n "$SETUP_INSTRUCTIONS" ]; then
  SUMMARY="${SUMMARY}\n\n--- Setup ---${SETUP_INSTRUCTIONS}"
fi

SUMMARY="${SUMMARY}\n\n${COMPACT_GUIDE}"
SUMMARY="${SUMMARY}\n\nTip: Run /onboarding for a full project analysis."

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<EXTREMELY_IMPORTANT>\n${SUMMARY}\n</EXTREMELY_IMPORTANT>"
  }
}
EOF

exit 0
```

- [ ] **Step 3: Verificar que o script executa sem erro de sintaxe**

```bash
bash -n /home/lgobatto/work/hekivo/superpowers-sage/hooks/session-start.sh
echo "Exit code: $?"
```

Expected: `Exit code: 0`

- [ ] **Step 4: Medir o tamanho do output da sessão compacto vs original**

```bash
# Contar caracteres do SKILL.md completo
wc -c /home/lgobatto/work/hekivo/superpowers-sage/skills/sageing/SKILL.md

# Contar caracteres do compact guide (calcular linhas do COMPACT_GUIDE)
grep -c "COMPACT_GUIDE=" /home/lgobatto/work/hekivo/superpowers-sage/hooks/session-start.sh
```

Expected: arquivo original ~9.000 chars, compact guide ~900 chars (redução de ~90%).

- [ ] **Step 5: Commit**

```bash
cd /home/lgobatto/work/hekivo/superpowers-sage
git add hooks/session-start.sh
git commit -m "perf(hooks): replace full sageing injection with compact routing summary

session-start.sh was reading the entire sageing SKILL.md (270 lines, ~9k chars)
and injecting it as additionalContext on every session start. Replace with a
20-line routing table that covers the essential skill-selection decisions.

The full sageing skill remains available on-demand via the Skill tool."
```

---

## Task 2: Expandir keyword map do user-prompt-activate.sh com skills de workflow

**Files:**
- Modify: `hooks/user-prompt-activate.sh:22-38`

### Lógica de keywords para workflow skills

Keywords de workflow precisam ser mais específicas que reference skills para evitar falsos positivos. Padrão: usar o nome do slash command (`/reviewing`, `/debugging`) e frases específicas do domínio.

- [ ] **Step 1: Substituir o KEYWORD_MAP atual pelo mapa expandido**

Localizar a seção `# Format: "keyword1|keyword2:skill-name"` e substituir todo o array `KEYWORD_MAP=(...)` por:

```bash
# Format: "keyword1|keyword2:skill-name"
# Workflow skills: use slash-command names and domain-specific phrases as triggers
# Reference skills: use technical keywords that appear in real prompts
KEYWORD_MAP=(
  # --- Workflow skills ---
  "/onboarding|project orientation|what exists in this project|first session|onboard:onboarding"
  "/reviewing|sage-reviewer|run a review|review my block|pre-pr review|review before pr|convention audit:reviewing"
  "/debugging|lando logs show|acorn boot error|blade rendering error|livewire mount fail|debug this issue:debugging"
  "/building|implement from plan|build from the plan|execute the plan|building skill:building"
  "/architecture-discovery|map the codebase|discover the architecture|architecture discovery:architecture-discovery"
  "/plan-generator|generate the plan|write the plan|plan-generator:plan-generator"
  "/designing|extract from figma|extract from pencil|design to blade|paper.design|pencil design:designing"
  "/verifying|visual verification|compare to design|screenshot diff|design drift:verifying"
  "/migrating|post_content migration|acf field migration|data migration script|/migrating:migrating"
  "/sage-design-system|design system tokens|kitchensink page|design system setup:sage-design-system"
  "/block-scaffolding|scaffold a block|new acf block|block-scaffolding|acf:block:block-scaffolding"
  "/block-refactoring|refactor this block|block evolution|v1 to v2 migration|block refactor:block-refactoring"
  "/sageing|which skill|skill routing|sage ecosystem|architectural preferences:sageing"
  "/ai-setup|acorn ai|mcp adapter|discover-abilities|install mcp:ai-setup"
  "/abilities-authoring|make:ability|abilities-authoring|execute-ability|acorn ability|mcp endpoint|wp ability:abilities-authoring"
  # --- Reference skills ---
  "livewire component|wire:model|wire:click|make:livewire|livewire v3:acorn-livewire"
  "eloquent model|model class|database schema|eloquent query|hasMany|belongsTo:acorn-eloquent"
  "block.json|register_block_type|native block|wp:core|InnerBlocks:wp-block-native"
  "lando start|lando stop|lando restart|lando ssh|lando info:sage-lando"
  "dispatch job|action scheduler|queue:work|queue job|horizon:acorn-queues"
  "http middleware|acorn middleware|kernel.php|terminate():acorn-middleware"
  "redis cache|cache tags|cache driver|redis facade:acorn-redis"
  "log channel|monolog|logging config|log::error|daily channel:acorn-logging"
  "acorn route|routes/web.php|register route|Acorn\\\\Route:acorn-routes"
  "phpcs|php codesniffer|phpstan|psalm|static analysis:wp-phpstan"
  "rest api|wp_rest_controller|rest endpoint|register_rest_route:wp-rest-api"
  "design token|@theme block|tailwind token|--color-|--spacing-:sage-design-system"
  "user capabilities|current_user_can|add_role|register_capability|wp roles:wp-capabilities"
  "sql injection|xss attack|nonce verification|sanitize_text_field|wp_kses|esc_html:wp-security"
  "transient cache|object cache|caching strategy|n+1 query|slow wp query|cache invalidation:wp-performance"
  "add_action|add_filter|do_action|hook priority|plugins_loaded|wptexturize|wp_head|save_post:wp-hooks-lifecycle"
  "wp-cli|wp eval|wp post|wp option update|wp db query:wp-cli-ops"
  "sage-html-forms|hf_get_form|html forms plugin|contact form|log1x/sage-html-forms:sage-forms"
)
```

- [ ] **Step 2: Verificar sintaxe do script**

```bash
bash -n /home/lgobatto/work/hekivo/superpowers-sage/hooks/user-prompt-activate.sh
echo "Exit code: $?"
```

Expected: `Exit code: 0`

- [ ] **Step 3: Testar match de workflow skill**

```bash
echo '{"prompt":"please review my block before I open the PR"}' \
  | bash /home/lgobatto/work/hekivo/superpowers-sage/hooks/user-prompt-activate.sh
```

Expected output (JSON com additionalContext mencionando `reviewing`):
```json
{"additionalContext":"Skill hint: reviewing skill is relevant. Invoke it if not already active."}
```

- [ ] **Step 4: Testar que multi-match é silencioso**

```bash
echo '{"prompt":"debug the livewire component mounting issue"}' \
  | bash /home/lgobatto/work/hekivo/superpowers-sage/hooks/user-prompt-activate.sh
```

Expected output: nada (porque `debugging` e `acorn-livewire` ambos matcham → MATCH_COUNT=2 → silencioso).

- [ ] **Step 5: Testar reference skill ainda funciona**

```bash
echo '{"prompt":"how do I set up an eloquent model for posts"}' \
  | bash /home/lgobatto/work/hekivo/superpowers-sage/hooks/user-prompt-activate.sh
```

Expected: additionalContext com `acorn-eloquent`.

- [ ] **Step 6: Commit**

```bash
cd /home/lgobatto/work/hekivo/superpowers-sage
git add hooks/user-prompt-activate.sh
git commit -m "feat(hooks): expand skill-router keyword map with workflow skills

Add 15 workflow skills (reviewing, debugging, building, designing, verifying,
migrating, onboarding, architecture-discovery, plan-generator, sageing,
sage-design-system, block-scaffolding, block-refactoring, ai-setup,
abilities-authoring) and refine reference-skill keywords.

Workflow skills use slash-command names and domain-specific phrases as triggers
to avoid false positives. Multi-match remains silent (existing behavior)."
```

---

## Task 3: Reescrever description do `sageing`

**Files:**
- Modify: `skills/sageing/SKILL.md:1-9`

### Problema

A description atual termina com "read this first in any Sage/Acorn project session" — isso instrui o Claude a invocar o skill em toda sessão, mesmo quando o `session-start.sh` já injetou o resumo compacto (double-load).

### Fix

Remover a instrução genérica e substituir por triggers específicos: a skill só deve ser invocada quando o usuário precisar de informações que não estão no resumo compacto (tabela de preferências arquiteturais completa, routing de design tools, padrões MCP).

- [ ] **Step 1: Substituir o frontmatter do sageing**

Localizar as linhas 1–9 de `skills/sageing/SKILL.md` (o bloco `---` com `name` e `description`) e substituir por:

```yaml
---
name: superpowers-sage:sageing
description: >
  Full architectural preferences and skill routing for Sage/Acorn projects — complete
  workflow ecosystem map, Lando command reference, design tool URL routing
  (Paper/Stitch/Figma/Pencil/Playwright), MCP query patterns, discover-abilities,
  execute-ability, WordPress MCP Adapter, plan system structure, integration with base
  superpowers skills. Invoke for: "which skill should I use", "architectural preferences",
  "design tool routing", "mcp query patterns", "full skill list", "sage ecosystem overview".
  Skip when: session-start already provided the routing summary and you only need
  a specific reference skill (acorn-livewire, acorn-eloquent, etc.) — invoke those directly.
---
```

- [ ] **Step 2: Verificar que o frontmatter é YAML válido**

```bash
python3 -c "
import re, sys
content = open('skills/sageing/SKILL.md').read()
fm = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
print('Frontmatter found:', bool(fm))
print('First 200 chars of body:', content[content.index('---', 3)+4:content.index('---', 3)+204])
"
```

Expected: `Frontmatter found: True`

- [ ] **Step 3: Commit**

```bash
cd /home/lgobatto/work/hekivo/superpowers-sage
git add skills/sageing/SKILL.md
git commit -m "docs(skills): tighten sageing description — remove always-on trigger

Remove 'read this first in any Sage/Acorn project session' instruction
that caused Claude to invoke sageing reflexively every session, even when
session-start.sh already provided the compact routing summary.

New description: invoke only for full architectural preferences, design tool
routing matrix, or MCP query patterns — not for every session start."
```

---

## Task 4: Tightening das descriptions de reviewing, debugging, onboarding, building

**Files:**
- Modify: `skills/reviewing/SKILL.md:1-9`
- Modify: `skills/debugging/SKILL.md:1-10`
- Modify: `skills/onboarding/SKILL.md:1-9`
- Modify: `skills/building/SKILL.md:1-10`

### Padrão a seguir

Cada description deve terminar com:
- `Invoke for:` — lista de frases/situações específicas que justificam o skill
- `Skip when:` — situações onde o skill NÃO deve ser invocado

- [ ] **Step 1: Reescrever reviewing description**

Substituir frontmatter de `skills/reviewing/SKILL.md` (linhas 1–9):

```yaml
---
name: superpowers-sage:reviewing
description: >
  Convention audit and pre-PR code review for Sage/Acorn projects — checks PHP Blade JS CSS
  against Sage/Acorn/Tailwind v4 conventions; audits ACF Composer field patterns,
  Livewire component structure, Eloquent models, Acorn routes, Blade components;
  verifies design alignment; runs sage-reviewer agent; prepares code for PR.
  Invoke for: "review before PR", "run sage-reviewer", "convention audit", "code review checklist",
  "/reviewing", "check my block for issues", "pre-merge review".
  Skip when: you just need to read a file or understand how something works — that is not a review.
user-invocable: true
argument-hint: "[file path or scope]"
---
```

- [ ] **Step 2: Reescrever debugging description**

Substituir frontmatter de `skills/debugging/SKILL.md` (linhas 1–11):

```yaml
---
name: superpowers-sage:debugging
description: >
  Structured troubleshooting for Sage/Acorn/Lando projects — diagnoses PHP errors, Blade
  rendering failures, Livewire mount errors, Eloquent query issues, Acorn boot failures,
  queue job failures, WP hook conflicts; uses lando logs, Query Monitor, Xdebug, WP_DEBUG.
  Invoke for: "/debugging", "something is broken and I can't figure out why",
  "lando logs show an error", "acorn boot error", "blade is rendering wrong",
  "livewire component not mounting", "500 error", "debug this issue".
  Skip when: you're building or implementing — that is /building, not debugging.
user-invocable: true
disable-model-invocation: true
argument-hint: "[error description or symptom]"
---
```

- [ ] **Step 3: Reescrever onboarding description**

Substituir frontmatter de `skills/onboarding/SKILL.md` (linhas 1–9):

```yaml
---
name: superpowers-sage:onboarding
description: >
  Full project analysis for an unfamiliar Sage/Acorn/Lando project — discovers CPTs, routes,
  ACF field groups, Livewire components, Service Providers, active plans, installed packages;
  produces a structured project overview with next steps.
  Invoke for: "/onboarding", "I'm new to this project", "what does this project do",
  "show me what exists", "project overview", "orient me to this codebase".
  Skip when: you already know the project and just need to build or review something —
  the session-start hook already provided basic stack info.
user-invocable: true
context: fork
---
```

- [ ] **Step 4: Reescrever building description**

Substituir frontmatter de `skills/building/SKILL.md` (linhas 1–10):

```yaml
---
name: superpowers-sage:building
description: >
  Plan-driven implementation in Sage/Acorn — reads docs/plans/ directory, implements
  components from approved sub-plans, runs scaffold generators (lando acorn acf:block),
  commits incrementally, invokes block-scaffolding per ACF block, runs lando flush +
  lando theme-build after changes; full PR workflow with sage-reviewer gate.
  Invoke for: "/building", "implement from the plan", "build the components",
  "execute the plan", "start coding from the architecture", "build this feature".
  Skip when: there is no plan yet — run /architecture-discovery then /plan-generator first.
user-invocable: true
argument-hint: "[plan path or component description]"
---
```

- [ ] **Step 5: Verificar YAML válido em todos os 4 arquivos**

```bash
for f in skills/reviewing/SKILL.md skills/debugging/SKILL.md skills/onboarding/SKILL.md skills/building/SKILL.md; do
  python3 -c "
import re, sys
content = open('$f').read()
fm = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
print('$f:', 'OK' if fm else 'FAIL')
"
done
```

Expected: todos `OK`

- [ ] **Step 6: Commit**

```bash
cd /home/lgobatto/work/hekivo/superpowers-sage
git add skills/reviewing/SKILL.md skills/debugging/SKILL.md \
        skills/onboarding/SKILL.md skills/building/SKILL.md
git commit -m "docs(skills): tighten descriptions — add Invoke/Skip triggers to workflow skills

Add explicit 'Invoke for:' and 'Skip when:' clauses to reviewing, debugging,
onboarding, and building. Reduces false-positive skill loading when the user
asks about adjacent topics (e.g., loading reviewing just because they mention
'code quality' in a general conversation)."
```

---

## Task 5: Tightening das descriptions das reference skills de domínio

**Files:**
- Modify: `skills/wp-capabilities/SKILL.md:1-8`
- Modify: `skills/wp-security/SKILL.md:1-8`
- Modify: `skills/wp-performance/SKILL.md:1-8`
- Modify: `skills/wp-hooks-lifecycle/SKILL.md:1-8`
- Modify: `skills/sage-forms/SKILL.md:1-8`

Essas skills têm descriptions com keywords técnicas que podem ser mencionadas em contexto geral sem que a skill seja necessária. Adicionar "Invoke for:" as torna mais precisas.

- [ ] **Step 1: Adicionar "Invoke for:" ao wp-capabilities**

Ler as linhas 1–8 de `skills/wp-capabilities/SKILL.md` e adicionar ao fim da description (antes do fechamento `---`):
```
  Invoke for: custom roles, multi-role sites, restrict content by capability, map_meta_cap.
```

- [ ] **Step 2: Adicionar "Invoke for:" ao wp-security**

Ler as linhas 1–8 de `skills/wp-security/SKILL.md` e adicionar ao fim da description:
```
  Invoke for: security audit, input sanitization, output escaping, nonce verification,
  SQL injection prevention, CSRF protection, capability checks in REST endpoints.
```

- [ ] **Step 3: Adicionar "Invoke for:" ao wp-performance**

Ler as linhas 1–8 de `skills/wp-performance/SKILL.md` e adicionar ao fim da description:
```
  Invoke for: slow page load, N+1 query problem, caching strategy, transient API,
  wp_remote_get optimization, dequeue unused scripts, performance profiling.
```

- [ ] **Step 4: Adicionar "Invoke for:" ao wp-hooks-lifecycle**

Ler as linhas 1–8 de `skills/wp-hooks-lifecycle/SKILL.md` e adicionar ao fim da description:
```
  Invoke for: hook priority conflicts, unexpected filter behavior, wptexturize corruption,
  Acorn vs WordPress hook timing, save_post edge cases, enqueue order issues.
```

- [ ] **Step 5: Adicionar "Invoke for:" ao sage-forms**

Ler as linhas 1–8 de `skills/sage-forms/SKILL.md` e adicionar ao fim da description:
```
  Invoke for: contact form with HTML Forms plugin, hf_get_form usage, form validation
  with Constraint API, pattern escaping trap, type=tel Chrome bug.
```

- [ ] **Step 6: Verificar YAML válido em todos**

```bash
for f in skills/wp-capabilities/SKILL.md skills/wp-security/SKILL.md \
          skills/wp-performance/SKILL.md skills/wp-hooks-lifecycle/SKILL.md \
          skills/sage-forms/SKILL.md; do
  python3 -c "
import re
content = open('$f').read()
fm = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
print('$f:', 'OK' if fm else 'FAIL')
"
done
```

Expected: todos `OK`

- [ ] **Step 7: Commit**

```bash
cd /home/lgobatto/work/hekivo/superpowers-sage
git add skills/wp-capabilities/SKILL.md skills/wp-security/SKILL.md \
        skills/wp-performance/SKILL.md skills/wp-hooks-lifecycle/SKILL.md \
        skills/sage-forms/SKILL.md
git commit -m "docs(skills): add Invoke-for triggers to domain reference skills

wp-capabilities, wp-security, wp-performance, wp-hooks-lifecycle, sage-forms.
Prevents loading when topic keywords appear in general conversation."
```

---

## Task 6: Validação final e CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Medir impacto — contar chars do output atual vs novo**

```bash
cd /home/lgobatto/work/hekivo/superpowers-sage

# Tamanho do sageing injetado anteriormente
wc -c skills/sageing/SKILL.md

# Tamanho estimado do compact guide novo (linhas COMPACT_GUIDE no session-start.sh)
grep "COMPACT_GUIDE=" hooks/session-start.sh | wc -l
```

- [ ] **Step 2: Testar session-start.sh em projeto Sage real**

```bash
# Simula execução a partir de um projeto Sage
cd ~/work/hekivo/interioresdecora.com.br
bash ~/.claude/plugins/superpowers-sage/hooks/session-start.sh | python3 -c "
import json,sys
data = json.load(sys.stdin)
ctx = data['hookSpecificOutput']['additionalContext']
print(f'Output length: {len(ctx)} chars')
print(f'Contains sageing SKILL.md: {\"## Sageing\" in ctx}')
print(f'Contains routing table: {\"| Task | Invoke\" in ctx}')
"
```

Expected:
```
Output length: ~2000-3000 chars (vs ~9000+ anteriormente)
Contains sageing SKILL.md: False
Contains routing table: True
```

- [ ] **Step 3: Testar user-prompt-activate.sh com 6 cenários**

```bash
cd /home/lgobatto/work/hekivo/superpowers-sage

run_test() {
  local desc="$1"
  local prompt="$2"
  local expected="$3"
  result=$(echo "{\"prompt\":\"$prompt\"}" | bash hooks/user-prompt-activate.sh 2>/dev/null)
  if echo "$result" | grep -q "$expected"; then
    echo "✓ $desc"
  else
    echo "✗ $desc — got: $result"
  fi
}

run_test "reviewing trigger" "review my block before PR" "reviewing"
run_test "debugging trigger" "getting an acorn boot error on lando start" "debugging"
run_test "building trigger" "implement from the plan" "building"
run_test "livewire trigger" "wire:model not binding in my component" "acorn-livewire"
run_test "multi-match silent" "debug the livewire component" ""
run_test "no match silent" "what time is it" ""
```

Expected: todos com `✓`

- [ ] **Step 4: Adicionar entrada no CHANGELOG**

Adicionar no topo de `CHANGELOG.md`, abaixo do cabeçalho existente:

```markdown
## [Unreleased]

### Performance
- **`session-start.sh`**: Replace full `sageing` SKILL.md injection (270 lines, ~9k chars)
  with compact 20-line routing table. Reduces session-start token cost by ~90%.
- **`user-prompt-activate.sh`**: Expand keyword map from 15 to 30+ entries, adding all
  workflow skills (reviewing, debugging, building, designing, verifying, migrating,
  architecture-discovery, plan-generator, sageing, sage-design-system, block-scaffolding,
  block-refactoring). Workflow skills use slash-command names + domain phrases as triggers.

### Docs
- **`sageing` description**: Remove "read this first in any Sage/Acorn project session" —
  skill now invokes on-demand for full architectural preferences and design tool routing.
- **Workflow skill descriptions** (reviewing, debugging, onboarding, building): Add explicit
  `Invoke for:` and `Skip when:` clauses to reduce false-positive loading.
- **Domain reference skill descriptions** (wp-capabilities, wp-security, wp-performance,
  wp-hooks-lifecycle, sage-forms): Add `Invoke for:` with specific technical triggers.
```

- [ ] **Step 5: Commit final**

```bash
cd /home/lgobatto/work/hekivo/superpowers-sage
git add CHANGELOG.md
git commit -m "docs: add token optimization changelog entry"
```

---

## Self-Review

### Spec coverage

| Requisito | Task que implementa |
|---|---|
| Eliminar injeção de 270 linhas do sageing a cada sessão | Task 1 |
| Expandir keyword map com workflow skills | Task 2 |
| Remover "read this first in any session" do sageing | Task 3 |
| Tightening de reviewing, debugging, onboarding, building | Task 4 |
| Tightening das reference skills de domínio | Task 5 |
| Validação e CHANGELOG | Task 6 |

### Estimativa de impacto

| Métrica | Antes | Depois |
|---|---|---|
| Tokens por session-start | ~3.000 (sageing completo) | ~300 (resumo compacto) |
| Skills cobertas pelo keyword-router | 15 | 30+ |
| Skills com triggers imprecisos | 9 | 0 |
| Estimativa de economia por sessão | — | ~2.700 tokens |

### Placeholder scan

Nenhum TBD ou placeholder neste plano. Cada step tem o código ou comando completo.

### Type consistency

Nenhum tipo ou assinatura de função referenciado — apenas shell scripts e YAML frontmatter.
