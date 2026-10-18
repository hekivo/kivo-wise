> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

---
title: Superpowers Sage — Plugin Expansion Design
date: 2026-04-18
status: approved
author: Leonardo (codigodoleo)
source_study: docs/superpowers-sage-expansion-study.md
---

# Superpowers Sage — Plugin Expansion Design

Design master para a próxima evolução do plugin `codigodoleo/superpowers-sage`. Este documento é o **spec-orquestrador**: define arquitetura, ondas de execução, e o template dos microplanos que serão gerados em seguida pelo `writing-plans`.

## Contexto

O plugin está na v1.7.1 com 34 skills, 7 agents, 6 hooks, sistema de planos (`docs/plans/`) e compatibilidade cross-platform (Claude Code + VS Code + Cursor). Está em estado operacional maduro, mas com gaps claros quando comparado às melhores práticas de Claude Code para economia de tokens e arquitetura determinística — documentados em `docs/superpowers-sage-expansion-study.md`.

Durante a fase de brainstorming, três referências externas recolocaram o problema:

- [Roots — Announcing Acorn AI](https://roots.io/announcing-acorn-ai/)
- [WordPress/mcp-adapter](https://github.com/WordPress/mcp-adapter)
- [Laravel AI SDK](https://www.laravel.wiki/en/ai-sdk)

Em conjunto, essas peças entregam nativamente o grosso do valor que um MCP server custom (`sage-introspect`) entregaria. O design foi revisto para **integrar** com esse stack oficial, em vez de duplicá-lo.

## Objetivos

1. **Reduzir baseline de tokens** das sessões em projetos Sage, via progressive disclosure e quebra de skills gordas.
2. **Aumentar determinismo** — mover comportamentos de "soft instructions no markdown" para hooks, scripts e commands executáveis.
3. **Integrar com AI stack oficial Roots/WP** (Acorn AI + MCP Adapter + Laravel AI SDK) — o plugin vira integrador e adestrador, não duplicador.
4. **Preservar compatibilidade cross-platform** (Claude Code, VS Code Copilot, Cursor).
5. **Manter backward compatibility** — features existentes continuam funcionando durante e após a expansão.

## Não-objetivos

- Reescrever o sistema de planos existente (`docs/plans/`) — apenas estendê-lo para suportar o template de microplano.
- Trocar stack de hooks (`hooks.json`) por alternativa — manter compatível com Claude Code 2.1.
- Construir do zero funcionalidades que WP 6.9 + Acorn AI + MCP Adapter já entregam.
- Quebrar contrato público das skills user-invocable (`/building`, `/architecting`, etc.) — evoluções devem ser aditivas.

## Arquitetura em três eixos

O plugin passa a evoluir em três eixos paralelos:

### Eixo 1 — Skills maduras (otimização)

As 34 skills atuais são bons repositórios de conhecimento, mas empurram tudo via `SKILL.md`. Vão ganhar:

- `references/` — docs profundas, lidas sob demanda (zero tokens até leitura).
- `scripts/` — operações determinísticas (ex: `create-component.sh` chama `lando acorn make:livewire` via Lando, retorna paths).
- `assets/` — templates reutilizáveis (stubs PHP, Blade, config).
- Descrições YAML trigger-rich — precisão cirúrgica na ativação.
- `SKILL.md` < 500 linhas obrigatório.

### Eixo 2 — Camada determinística (nova)

Comportamentos que hoje dependem de o Claude seguir instruções passam a ser executados pelo harness:

- `CLAUDE.md` no root do plugin — regras universais do stack Roots.
- Slash commands rápidos (`/sage-status`, `/acf-register`, `/livewire-new`).
- Hook `UserPromptSubmit` — skill activation direcionada por keyword.
- Hook `Stop` quality gate — bloqueia "done" se PHPCS/ESLint falhar.
- Hook `PreToolUse` com matcher protegido — bloqueia edição direta de `.env`, `wp-config.php`, `bedrock/config/environments/`, `trellis/group_vars/*/vault.yml`.

### Eixo 3 — AI-native stack (nova, diferencial)

Integração com a stack oficial do Roots/WP para que o Claude consulte o estado real do ambiente via MCP, em vez de chutar:

- Detecção de AI-readiness (WP 6.9+, Acorn AI, MCP Adapter, chaves API).
- Skill `/ai-setup` guia instalação quando falta algo.
- Template `.mcp.json` projeto-local apontando para `lando wp mcp-adapter serve` via stdio.
- Skill `abilities-authoring` ensina criar Abilities customizadas (`lando acorn make:ability`).
- Padrão "query-first" injetado nas skills Acorn-\* e WP-\*: antes de gerar código referenciando post types, rotas, componentes, **consultar MCP primeiro**.

O MCP custom `sage-introspect` (previsto no estudo original) vira **fallback condicional** para projetos pré-WP 6.9 que não podem migrar.

## Ondas de execução

Seis ondas sequenciais. Ondas internas têm microplanos paralelizáveis entre si.

### Onda 1 — Fundação + economia imediata de tokens (6 microplanos)

Atacar primeiro o maior consumidor de tokens: as 7 skills com `SKILL.md` > 500 linhas.

- **1.1** — `CLAUDE.md` plugin-level (regras universais Roots + Bedrock + Lando + Tailwind v4).
- **1.2** — Refactor `acorn-middleware` (817 L → ≤ 450 L + `references/`).
- **1.3** — Refactor `acorn-queues` (745 L) + `acorn-livewire` (744 L). Agrupados por proximidade temática.
- **1.4** — Refactor `acorn-routes` (672 L) + `acorn-eloquent` (597 L). Idem.
- **1.5** — Refactor `block-scaffolding` (547 L) + `wp-performance` (505 L).
- **1.6** — Validação cross-skill: rodar `validate-skills.mjs`, medir tokens antes/depois via sessão-padrão (quality bar C para esta peça).

### Onda 2 — Progressive disclosure geral (8 microplanos)

Aplicar o mesmo padrão nas 27 skills restantes, agrupadas por família, e auditar todas as descrições YAML.

- **2.1** — Famílias Acorn-\* restantes (`acorn-commands`, `acorn-redis`, `acorn-logging`) — scripts + references.
- **2.2** — Famílias WP-\* (`wp-cli-ops`, `wp-hooks-lifecycle`, `wp-phpstan`, `wp-rest-api`, `wp-security`, `wp-capabilities`, `wp-block-native`) — scripts + references.
- **2.3** — Skills de workflow (`building`, `architecting`, `architecture-discovery`, `plan-generator`, `designing`, `verifying`, `reviewing`, `debugging`, `modeling`, `onboarding`, `install-plugin`, `migrating`) — references focadas, sem scripts agressivos (são orchestradoras).
- **2.4** — Skills de suporte (`sageing`, `sage-lando`, `sage-design-system`, `block-refactoring`) — references.
- **2.5** — Auditoria YAML trigger-richness das 34 skills (antes/depois documentado).
- **2.6** — Template compartilhado `templates/skill-references/` (structure boilerplate).
- **2.7** — Template compartilhado `templates/skill-scripts/` (lando-wrapper boilerplate).
- **2.8** — Atualização do `validate-skills.mjs` para checar limite de 500 linhas + presença de `references/` em skills grandes.

### Onda 3 — Capacidades novas determinísticas (4 microplanos)

- **3.1** — Slash commands (`commands/sage-status.md`, `commands/acf-register.md`, `commands/livewire-new.md`).
- **3.2** — Hook `UserPromptSubmit` — `hooks/user-prompt-activate.sh` analisa keyword e injeta skill resumida via `hookSpecificOutput.additionalContext`.
- **3.3** — Hook `Stop` quality gate — `hooks/post-stop.sh` refatorado para rodar `lando lint` `lando phpcs` + `lando lint` e bloquear com `{"decision": "block"}` se falhar. Flag `SUPERPOWERS_SAGE_QUALITY_GATE=strict|warn|off`.
- **3.4** — Hook `PreToolUse` protegido — `hooks/pre-write-protected.sh` lê stdin JSON, bloqueia paths sensíveis com exit code 2 e mensagem sugerindo alternativa (`ansible-vault edit`, Bedrock `.env` pattern).

### Onda 4 — Subagents especializados (3 microplanos)

- **4.1** — `agents/acorn-migration.md` — analisa código procedural legado, propõe migração incremental para Acorn (Service Providers, Facades, Eloquent).
- **4.2** — `agents/tailwind-v4-auditor.md` — varre projeto detectando sintaxe v3 legada (`tailwind.config.js`, `@apply` problemático, plugins incompatíveis) e gera plano de migração.
- **4.3** — `agents/livewire-debugger.md` — diagnóstico estruturado de componentes Livewire que não montam/atualizam (component + view + Alpine bindings + network logs).

### Onda 5 — AI-native integration (5 microplanos)

Pilar diferencial. Detalhamento maior abaixo.

- **5.1** — AI-readiness probe (`scripts/detect-ai-readiness.mjs`).
- **5.2** — Skill `/ai-setup` (instalação guiada Acorn AI + MCP Adapter via Lando).
- **5.3** — Template `.mcp.json` projeto-local (stdio via Lando) + generator.
- **5.4** — Skill `abilities-authoring` (criar Abilities customizadas via `wp acorn make:ability`).
- **5.5** — Integração "query-first" nas skills existentes (reference compartilhado `references/mcp-query-patterns.md` + rewires pontuais).

### Onda 6 — Fallback `sage-introspect` (2 microplanos)

Opcional, executado só se o uso real exigir.

- **6.1** — Design da API `sage-introspect` (especifica tools: `wp_query`, `acf_field_groups`, `livewire_components`, `db_schema`, `acorn_routes`).
- **6.2** — Implementação Node co-localizada em `mcp/sage-introspect/` + ativação condicional via `.mcp.json` quando AI-readiness probe falha.

## Microplano 5 em detalhe

Por ser o pilar novo com maior risco de infra, aprofundamos aqui.

### 5.1 — AI-readiness probe

**Script:** `scripts/detect-ai-readiness.mjs`. Verifica em ordem:

1. WP core ≥ 6.9 (via `lando wp core version`).
2. `roots/acorn-ai` em `composer.json` do tema (direto ou transitivo).
3. `wordpress/mcp-adapter` em `composer.json` do root ou instalado como plugin ativo.
4. `.env` com pelo menos uma chave de provider reconhecida, caso não haja solicitar. (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`).
5. `lando wp mcp-adapter list` executa e retorna pelo menos 1 server.

**Saída (JSON):**

```json
{
  "ready": true,
  "wp_version": "6.9.1",
  "packages": { "acorn-ai": "1.0", "mcp-adapter": "0.4" },
  "api_keys_present": ["ANTHROPIC_API_KEY"],
  "mcp_servers": ["mcp-adapter-default-server"],
  "missing": [],
  "upgrade_path": []
}
```

**Integração:** `hooks/session-start.sh` invoca o script e imprime uma linha compacta no preamble. Se `ready=false`, sugere `/ai-setup`.

### 5.2 — Skill `/ai-setup`

**User-invocable:** sim. Namespace: `superpowers-sage:ai-setup`.

**Fluxo:**

1. Chama `detect-ai-readiness.mjs`.
2. Branching por gap detectado:
   - WP < 6.9 → exibe upgrade path Bedrock + `composer update`, não auto-aplica (risco alto).
   - Pacotes ausentes → `lando composer require roots/acorn-ai wordpress/mcp-adapter`.
   - Acorn config não publicado → `lando wp acorn vendor:publish --tag=acorn-ai`.
   - API key ausente → pergunta ao usuário qual provider, escreve em `.env` e aguarda usuário preencher a chave (com warning de `.gitignore`).
   - Advanced custom fields suporta AI, se instalado adicione o filter `add_filter( 'acf/settings/enable_acf_ai', '__return_true' );` e  
3. Gera `.mcp.json` local do **projeto do usuário** (não do plugin) a partir do template.
4. Valida handshake: executa `lando wp mcp-adapter list` e confirma pelo menos 1 server.
5. Teste final: chama `discover-abilities` via MCP e confirma resposta válida.

**Rollback:** cada passo gravado em `.superpowers-sage/ai-setup.log`; falha em qualquer etapa permite reversão manual guiada.

### 5.3 — Template `.mcp.json` Lando stdio

**Arquivo:** `templates/project-mcp.json.tpl`

```json
{
  "mcpServers": {
    "wordpress": {
      "command": "lando",
      "args": [
        "wp",
        "mcp-adapter",
        "serve",
        "--server=mcp-adapter-default-server",
        "--user=admin"
      ]
    }
  }
}
```

**Generator:** `scripts/generate-project-mcp.mjs`

- Detecta se o projeto já tem `.mcp.json` e faz merge não-destrutivo.
- Normaliza pelo detect do Lando (`lando version`).
- Se projeto não for Lando, tenta `wp` direto com `--path`.

### 5.4 — Skill `abilities-authoring`

**Tipo:** reference (não user-invocable). Ativada automaticamente por keywords.

**Cobre:**

- Estrutura de uma Ability (`app/Abilities/*.php`).
- Registro via `AbilitiesProvider`.
- Schema JSON + `meta.mcp.public: true`.
- `lando acorn make:ability <Name>` — fluxo determinístico.
- Como as Abilities aparecem no MCP Adapter e são chamadas pelo Claude via `execute-ability`.

**Scripts:**

- `scripts/create-ability.sh` — wrapper de `lando acorn make:ability`.
- `scripts/list-abilities.sh` — chama `discover-abilities` via MCP e lista em tabela.

**Assets:**

- `assets/ability-query-content.php.tpl` — ability para query de CPTs.
- `assets/ability-crud.php.tpl` — CRUD ability base.
- `assets/ability-search.php.tpl` — search ability.
- `assets/ability-acf-block.php.tpl` — ACF Content block guttenberg code generate and insert into page if id specified.

### 5.5 — Integração "query-first" nas skills existentes

**Reference compartilhado:** `skills/sageing/references/mcp-query-patterns.md` (hospedado na skill meta `sageing`; outras skills linkam via path relativo). Contém o padrão:

> Antes de gerar código que referencia post types, custom fields, rotas, Livewire components ou queries — consulte o MCP:
>
> 1. `discover-abilities` para listar o que está disponível.
> 2. `execute-ability` com a ability apropriada (`posts/list`, `acf/field-groups`, `livewire/components`, etc).
> 3. Se a ability não existir, sugerir ao usuário criar uma via `/abilities-authoring`.
> 4. Fallback: se `detect-ai-readiness` retornou `ready=false`, pergunte ao usuário em vez de chutar.

**Pontos de integração (ex.):**

- `acorn-livewire/SKILL.md` — seção "Componentes já registrados" linka para `mcp-query-patterns.md`.
- `acorn-routes/SKILL.md` — idem para rotas existentes.
- `modeling/SKILL.md` — query ACF field groups antes de propor CPTs novos.
- `building/SKILL.md` — injeta verificação query-first no loop por componente.

## Template do microplano

Cada microplano vira um diretório em `docs/plans/YYYY-MM-DD-<numero>-<slug>/` com:

```
plan.md              # Status, escopo, quality bar, dependencies
checklist.md         # Items acionáveis em ordem
context.md           # Links study doc, skill target, decisões já tomadas
validation.md        # Comandos de teste, métricas de aceitação
notes.md             # Log ativo durante execução
```

**Cabeçalho padrão do `plan.md`:**

```yaml
---
wave: 5
microplan: 5.2
title: "/ai-setup skill — instalação guiada"
quality_bar: C
depends_on: [5.1]
blocks: [5.3, 5.4, 5.5]
parallelizable_with: []
status: pending
estimated_hours: 6
---
```

O `writing-plans` subsequente gera os 28 diretórios + cabeçalhos; execução ataca em ordem de onda, paralelizando microplanos da mesma onda quando `depends_on` permite.

## Quality bar por onda

| Onda | Bar | Justificativa |
|---|---|---|
| 1 | B | Refactor mecânico; `validate-skills.mjs` existente + smoke test manual em sessão-padrão. |
| 2 | B | Mesma natureza da Onda 1, escala. |
| 3 | **C** | Hooks novos tocam runtime do harness. PHPCS/ESLint block precisa de teste end-to-end em projeto real. |
| 4 | B | Agents são markdown + YAML. Eval manual em 1 cenário cada. |
| 5 | **C** | AI stack é infra nova. Teste de handshake MCP, fluxo de install em Lando limpo obrigatório. Medição de tokens antes/depois em pelo menos uma sessão típica. |
| 6 | B | Fallback opcional, baixa prioridade de robustez. |

**Quality bar B (padrão):** código escrito + `wc -l` validando < 500L onde aplicável + YAML description revisada + smoke test manual + atualização do `CHANGELOG.md` via release-please + teste em Cursor/VS Code se aplicável.

**Quality bar C (runtime/infra):** B + teste automatizado onde há infra (`scripts/test-*.mjs`) + **medição antes/depois de tokens** em sessão-padrão + PR review dedicado + doc de migração se quebrar contrato público.

**Sessão-padrão (para medição de tokens):** abrir projeto Sage de referência, rodar `/onboarding`, depois `/building` sobre uma componente simples (ex: block `hero`). Capturar total de tokens de input no preamble via `/stats` ou equivalente. Comparar antes/depois do microplano aplicado.

## Compatibilidade cross-platform

Toda mudança deve preservar:

- **Claude Code** — primary, usa `hooks/hooks.json`.
- **VS Code Copilot** — usa `hooks/hooks.json`, configura via `.vscode/mcp.json`.
- **Cursor** — usa `hooks/cursor-hooks.json` (sincronizado automaticamente por `scripts/sync-cursor-hooks.mjs`).

Microplanos que introduzem novos hooks **devem** incluir atualização do `sync-cursor-hooks.mjs` no checklist.

## Dependências entre ondas

```
Onda 1 ── bloco ──▶ Onda 2 (templates compartilhados vêm da 1)
Onda 2 ── bloco ──▶ Onda 5 (integração query-first nas skills refatoradas)
Onda 3 ── paralela ──▶ Onda 4 (independentes)
Onda 5.1 ── bloco ──▶ Onda 5.2, 5.3
Onda 5.2 ── bloco ──▶ Onda 5.4, 5.5
Onda 6 ── opcional ──▶ só ativa se métricas 5 indicarem fallback necessário
```

## Critérios de sucesso globais

- [ ] Nenhum `SKILL.md` > 500 linhas.
- [ ] Todas as skills têm description YAML trigger-rich (revisada e aprovada).
- [ ] 7 skills críticas têm `references/` + `scripts/` + `assets/`.
- [ ] Plugin possui `CLAUDE.md` root com regras universais.
- [ ] Hooks: 3 novos (UserPromptSubmit, Stop quality gate, PreToolUse protected) funcionais e testados.
- [ ] 3 commands (`sage-status`, `acf-register`, `livewire-new`) operacionais.
- [ ] 3 subagents novos (acorn-migration, tailwind-v4-auditor, livewire-debugger) deployados.
- [ ] `/ai-setup` instala e configura Acorn AI + MCP Adapter end-to-end em projeto Lando limpo.
- [ ] Template `.mcp.json` Lando stdio valida handshake com `discover-abilities`.
- [ ] Skills Acorn-\* e WP-\* linkam para `mcp-query-patterns.md`.
- [ ] Compatibilidade cross-platform mantida (Claude Code + VS Code + Cursor).
- [ ] Redução de baseline de tokens mensurada em sessão-padrão (≥ 30% alvo).
- [ ] Suporte e utilização efetiva de https://www.advancedcustomfields.com/blog/acf-6-8-release-ai-ready-discoverable-content/ para construção e desenvolvimento de conteúdo utilizando campos acf.

## Próximo passo

Após aprovação deste spec:

1. Invocar `superpowers:writing-plans` para gerar os ~28 microplanos em `docs/plans/YYYY-MM-DD-<numero>-<slug>/`.
2. Cada microplano terá o cabeçalho padrão + checklist acionável.
3. Execução começa pela Onda 1, microplano 1.1 (CLAUDE.md plugin-level).

## Referências

- Estudo original: `docs/superpowers-sage-expansion-study.md`
- Roots — Announcing Acorn AI: https://roots.io/announcing-acorn-ai/
- WordPress MCP Adapter: https://github.com/WordPress/mcp-adapter
- Laravel AI SDK: https://www.laravel.wiki/en/ai-sdk
- Claude Code plugins reference: https://code.claude.com/docs/en/plugins-reference
- Claude Code hooks reference: https://code.claude.com/docs/en/hooks
- Anthropic skill authoring best practices: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices
