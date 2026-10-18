> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# sage-design-system + sage-block-architecting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar dois skills novos (`sage-design-system` e `sage-block-architecting`) e aplicar melhorias cirúrgicas em quatro skills existentes (`building`, `verifying`, `sageing`, `architecting`), consolidando aprendizados de campo dos projetos interioresdecora e adrimar.

**Architecture:** Dois skills ortogonais com responsabilidades claras: `sage-design-system` estabelece a fundação visual (tokens → ui components → layout components → kitchensink → layouts estruturais) antes de qualquer bloco; `sage-block-architecting` implementa o contrato CSS de cada bloco ACF (CSS scoped, enqueue guard, variações, README). Skills existentes recebem adições mínimas para fechar os gaps de gates, commits e nomenclatura Playwright.

**Tech Stack:** Markdown SKILL.md, Blade PHP, Tailwind CSS v4, ACF Composer, `ThemeServiceProvider`

**Spec:** `docs/superpowers/specs/2026-04-17-sage-design-system-and-block-architecting.md`

---

## Arquivos afetados

| Tipo | Caminho | Ação |
|---|---|---|
| Create | `skills/sage-design-system/SKILL.md` | Novo skill |
| Create | `skills/sage-block-architecting/SKILL.md` | Novo skill |
| Modify | `skills/building/SKILL.md` | 3 adições (gate design system, delegação, commit gate) |
| Modify | `skills/verifying/SKILL.md` | 4 adições (MCP nomeado, live ref, get_metadata, largura canônica) |
| Modify | `skills/sageing/SKILL.md` | 1 adição (glossário Playwright MCP vs npm) |
| Modify | `skills/architecting/SKILL.md` | 1 adição (gate design system pré-planning) |

---

## Task 1: Criar `skills/sage-design-system/SKILL.md`

**Files:**
- Create: `skills/sage-design-system/SKILL.md`

- [ ] Criar o arquivo com frontmatter correto (`name`, `description`, `user-invocable`, `argument-hint`)
- [ ] Escrever seção `## When to use` — standalone + gate automático do `/architecting`
- [ ] Escrever seção `## Phase 0 — Classify the design file` com checklist normativo (tipo arquivo, variáveis presentes, node-id de referência, largura canônica de QA)
- [ ] Escrever seção `## Phase 1 — Design tokens` com template `design-tokens.css`, regra de comment de origem `/* MCP node <id> — <desc> */`, regra anti-placeholder
- [ ] Escrever seção `## Phase 2 — UI components` com tabela de componentes obrigatórios (`button`, `heading`, `badge`, `text-link`, `icon`) e template `button.blade.php` completo como exemplo
- [ ] Escrever seção `## Phase 3 — Layout components` com tabela (`section`, `container`, `grid`, `stack`, `split`) e regra: zero aparência, apenas estrutura
- [ ] Escrever seção `## Phase 4 — Kitchensink` com gate normativo explícito: o agente DEVE invocar `browser_navigate` + `browser_take_screenshot` antes de declarar validado; citar outputs ou não está concluído
- [ ] Escrever seção `## Phase 5 — Structural layouts` (`site-header`, `site-footer` como compostos)
- [ ] Escrever seção `## Completion` com commit gate: `feat(theme): design system foundation — tokens, ui, layout components, kitchensink`
- [ ] Verificar que nenhum token tem valor hardcoded específico de projeto (tudo genérico via `var(--color-*)`)

---

## Task 2: Criar `skills/sage-block-architecting/SKILL.md`

**Files:**
- Create: `skills/sage-block-architecting/SKILL.md`

- [ ] Criar frontmatter + `## When to use` — invocável manualmente e pelo `/building`
- [ ] Escrever `## Hard prerequisite` — bloquear se design system não validado; mensagem específica
- [ ] Escrever `## Operation modes` — tabela Full vs Minimal com critério de decisão
- [ ] Escrever `## The 4-layer contract` — diagrama ASCII das 4 camadas com regra de ouro
- [ ] Escrever `## Phase 1 — Audit or skip` (bloco existente vs novo)
- [ ] Escrever `## Phase 2 — Decide mode` (Full ou Minimal)
- [ ] Escrever `## Phase 3 — Implement A1–A4`:
  - [ ] A1: template CSS completo com seletor duplo + `@reference` + modo Minimal documentado
  - [ ] A2: template controller com `$styles` + `assets()` vazio com comentário técnico completo
  - [ ] A3: template view com `$attributes->merge()` + uso de `<x-ui.heading>` e `<x-ui.button>`
  - [ ] A4: instrução `editor.css` + nota do glob Vite
- [ ] Escrever `## Phase 4 — Enqueue guard` com lógica de "já existe?" + template `ThemeServiceProvider::boot()` completo
- [ ] Escrever `## Phase 5 — Block README` com template em `docs/blocks/{slug}.md` (localização correta conforme aprovado)
- [ ] Escrever `## Phase 6 — Verification (Definition of Done)` com tabela A/B/C/E, nota de live reference aceita (Figma/Paper/Pencil MCP), gate normativo explícito (citar tools invocadas e outputs)
- [ ] Escrever `## Anti-drift table` com todos os erros comuns da spec (13+ linhas)

---

## Task 3: Editar `skills/building/SKILL.md`

**Files:**
- Modify: `skills/building/SKILL.md`

- [ ] Ler o arquivo completo antes de editar
- [ ] Adicionar gate pré-bloco no passo "Implement components": verificar se design system validado → se não, invocar `/sage-design-system` e pausar (inserir como check no passo `0) Dispatch design-extractor`)
- [ ] Adicionar instrução de delegação após scaffold ACF: "Após criar controller PHP + view Blade, invocar `/sage-block-architecting` antes do próximo componente"
- [ ] Adicionar fallback sem design-extractor (Cursor/IDE sem subagentes): reler spec em disco + `get_design_context` + `get_metadata` MCP + registrar `design-extractor: deferred` no frontmatter
- [ ] Adicionar commit gate na seção `## Completion` (e em `#### e) Build and verify`): `git commit` + `git push` obrigatório após build + verificação, antes de declarar fase concluída

---

## Task 4: Editar `skills/verifying/SKILL.md`

**Files:**
- Modify: `skills/verifying/SKILL.md`

- [ ] Ler o arquivo completo antes de editar
- [ ] **Nota:** o arquivo já usa `mcp__plugin_playwright_playwright__browser_navigate` e `mcp__plugin_playwright_playwright__browser_take_screenshot` explicitamente — não é necessário renomear
- [ ] Elevar live reference para Priority 0 em `### 1) Determine reference source`: inserir nova opção 0 — "MCP design tool via `get_screenshot` / `get_design_context` / `batch_get` (quando MCP configurado)" — acima do Spec file atual (que passa a ser Priority 1)
- [ ] Adicionar step de geometria após `get_design_context` / `get_computed_styles`: invocar `get_metadata` (Figma) / `get_node_info` (Paper) / `batch_get(readDepth:4)` (Pencil) para x/y/width dos filhos — obrigatório quando componente tiver grid multi-coluna ou offsets
- [ ] Adicionar uso da largura canônica do `plan.md`: no step de `browser_navigate`, ler frontmatter do plano para `browser_resize` em vez de assumir 1440px

---

## Task 5: Editar `skills/sageing/SKILL.md`

**Files:**
- Modify: `skills/sageing/SKILL.md`

- [ ] Ler o arquivo completo antes de editar
- [ ] Corrigir namespace Playwright na tabela Design Tool Integration: `mcp__playwright__*` → `mcp__plugin_playwright_playwright__*`
- [ ] Adicionar Pencil à tabela Design Tool Integration (trigger: `*.pen` / pasta `design/`; MCP: `mcp__pencil__*`; usage: `open_document` → `get_variables` / `batch_get`)
- [ ] Atualizar descrição de `/designing` na tabela Workflow Skills: acrescentar "Pencil" (actualmente: "Paper/Stitch/Figma/offline assets")
- [ ] Adicionar `pencil` como opção válida em `design-tool:` no bloco de frontmatter do plan.md
- [ ] Adicionar glossário **Playwright MCP ≠ Playwright Test npm** (nova seção `## Glossary` ou após tabela de skills):
  - **Playwright MCP** — servidor MCP, namespace `mcp__plugin_playwright_playwright__*`, acessa `https://{projeto}.lndo.site`, para comparação visual com design. Não requer instalação de binários de browser.
  - **Playwright Test npm** — pacote `@playwright/test`, `npm run test:e2e`, suite E2E do repositório. Distinto. Requer binário de browser instalado. Não substitui validação visual contra design.
- [ ] Adicionar `sage-design-system` e `sage-block-architecting` na tabela de skills com descrições corretas
- [ ] Atualizar sequência recomendada: `/sage-design-system` → `/architecting` → `/building` (com nota de que building invoca `sage-block-architecting` automaticamente)

---

## Task 6: Editar `skills/architecting/SKILL.md`

**Files:**
- Modify: `skills/architecting/SKILL.md`

- [ ] Ler o arquivo completo antes de editar
- [ ] Adicionar verificação de design system como **Fase 0** antes de invocar `architecture-discovery`: verificar se `resources/css/design-tokens.css` existe e se page `/kitchensink` está presente → se não, recomendar `/sage-design-system` primeiro com mensagem explicativa
- [ ] Manter compatibilidade: se design system existir, prosseguir normalmente para `architecture-discovery`

---

## Task 7: Validação final

- [ ] Verificar que todos os 6 arquivos existem/foram editados
- [ ] Ler `skills/sage-design-system/SKILL.md` e confirmar: sem tokens hardcoded, Playwright gate (ToolSearch antes de screenshot), gate normativo presente, commit gate presente
- [ ] Ler `skills/sage-block-architecting/SKILL.md` e confirmar: README em `docs/blocks/`, live reference aceita (Figma/Paper/Pencil/Stitch), seletor duplo documentado, enqueue guard completo
- [ ] Ler diff das edições em `building`, `verifying`, `sageing`, `architecting` — confirmar que são adições cirúrgicas sem remoção de conteúdo existente
- [ ] Confirmar que `sageing/SKILL.md` tem Pencil na tabela e namespace Playwright correto
- [ ] Confirmar que `verifying/SKILL.md` tem live reference como Priority 0
- [ ] Rodar suite de testes para garantir que nenhuma edição regrediu scripts:
  ```bash
  node scripts/test-detect-design-tools.mjs
  # Expected: All 12 tests passed
  ```
- [ ] Commit: `feat(skills): sage-design-system + sage-block-architecting + skill improvements`

---

## Task 8: Version bump

**Files:**
- Modify: `plugin.json`
- Modify: `.claude-plugin/plugin.json`
- Modify: `.release-please-manifest.json`

- [ ] Bump versão de `1.5.0` → `1.6.0` nos três arquivos
- [ ] Commit: `chore: bump version to 1.6.0`
