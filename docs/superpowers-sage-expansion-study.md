> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Superpowers Sage — Estudo de Expansão e Otimização

> Documento de referência para evolução do plugin `codigodoleo/superpowers-sage`.
> Auto-contido — pode ser anexado a uma nova sessão do Claude como contexto inicial.

## Contexto do projeto

- **Plugin**: `codigodoleo/superpowers-sage` (Claude Code plugin)
- **Stack-alvo**: Roots ecosystem — Bedrock + Sage + Acorn + Lando
- **Áreas cobertas**: ACF Composer, Livewire, Eloquent, Routes, Middleware, Queues, Tailwind v4, Vite
- **Ambiente de desenvolvimento**: WSL (Windows), Claude Code v2.1+, Lando
- **Objetivo deste documento**: mapear features nativas do Claude Code ainda subexploradas no plugin, comparar com o modelo do Cursor, e traçar um roadmap de expansão com foco em otimização de tokens e arquitetura determinística.

---

## 1. Mapa comparativo: Cursor vs Claude Code

| Cursor | Equivalente Claude Code | Observação |
|---|---|---|
| `.cursor/rules/*.mdc` "Agent Requested" | Skills com YAML `description` + progressive disclosure | Claude Code é superior: ~98% de economia de tokens até ativação |
| `.cursor/rules` "Always" | `CLAUDE.md` hierárquico (global → project → subdir) | Paridade |
| `.cursor/rules` "Auto" (glob-based) | Hook `PostToolUse` com `matcher` | Claude Code é mais flexível (shell script arbitrário) |
| `.cursor/rules` "Manual" | Slash commands (`commands/*.md`) | Paridade |
| Docs indexing (URLs) | Manual via `references/` curados | **Gap real** — mitigável com scraping script |
| Codebase semantic indexing | Busca agêntica on-demand (Grep/Read) | Diferente, não pior |
| @file / @codebase | @-mentions + ferramentas nativas | Paridade |
| Notepads | Project files + `references/` em skills | Paridade |
| Team/Project/User rules | `CLAUDE.md` em múltiplos níveis + settings | Paridade |
| — | **Hooks** (15 eventos do lifecycle) | Exclusivo Claude Code |
| — | **Subagents** (Task tool, contexto isolado) | Exclusivo Claude Code |
| — | **MCP servers** customizados | Ambos suportam; Claude Code integra mais nativo |
| — | **Scripts executáveis em skills** (output no contexto, código não) | Exclusivo Claude Code |

### Descoberta-chave

No Claude Code 2.1 **skills e slash commands foram unificados**. Skills aparecem no menu `/` automaticamente. Isso significa que o usuário pode invocar explicitamente (`/livewire-create`) *ou* deixar o Claude ativar pela descrição YAML. Muda a arquitetura do plugin: não há mais distinção rígida entre "skill" e "command".

---

## 2. Estrutura completa de um plugin

Componentes oficialmente suportados, na ordem em que deveriam ser adotados:

```
superpowers-sage/
├── .claude-plugin/
│   └── plugin.json                # Manifest obrigatório
├── CLAUDE.md                      # Regras always-on do stack
├── skills/                        ← já usado
│   └── {nome}/
│       ├── SKILL.md               # <500 linhas, descrição trigger-rich
│       ├── references/            # docs curadas, ZERO tokens até leitura
│       ├── scripts/               # determinístico, código fica fora do contexto
│       └── assets/                # templates, boilerplates, stubs
├── commands/                      ← quick win, não usado
│   ├── sage-status.md
│   ├── acf-register.md
│   └── livewire-new.md
├── agents/                        ← salto qualitativo, não usado
│   ├── acorn-migration.md
│   ├── livewire-debugger.md
│   └── tailwind-v4-auditor.md
├── hooks/                         ← poder determinístico, não usado
│   ├── hooks.json
│   └── scripts/
│       ├── session-start.sh
│       ├── skill-activation.sh
│       ├── pre-write-protected.sh
│       └── post-write-blade.sh
├── .mcp.json                      ← opcional, alto impacto
├── scripts/                       # compartilhados entre skills
└── bin/                           # binários no PATH
```

**Nota crítica de layout**: todos os diretórios (commands, agents, skills, hooks) devem estar no **root** do plugin, não dentro de `.claude-plugin/`. Apenas `plugin.json` fica em `.claude-plugin/`.

---

## 3. Princípios de otimização de tokens

Benchmarks publicados por terceiros indicam **economia de ~15.000 tokens por sessão** em plugins bem arquitetados — redução de ~82% comparado a empurrar instruções para o `CLAUDE.md`.

### Princípio 1 — Teto de 500 linhas no SKILL.md

Recomendação oficial da Anthropic. Acima disso, quebrar em `references/*.md`. Cada referência só consome tokens quando o Claude executa `view` nela.

Medição útil em shell:
```bash
wc -l skills/*/SKILL.md | sort -rn
```

### Princípio 2 — Descrição YAML trigger-rich

A descrição é o que o Claude vê no startup para decidir se ativa a skill. Vaga = nunca triggera. Rica = precisão cirúrgica.

Ruim:
```yaml
description: Helps with WordPress
```

Bom:
```yaml
description: >
  Registers ACF field groups using Acorn's ACF Composer classes;
  handles block registration with ACF Blocks v2; manages field
  location rules per post type/taxonomy. Activate when user
  mentions ACF, field groups, ACF Composer, ACF Blocks, custom
  fields, get_field, or acf_add_local_field_group.
```

### Princípio 3 — Scripts substituem código gerado

Quando o Claude executa um `.sh` ou `.php` via bash, **o código do script nunca entra no contexto** — só o output. Candidatos óbvios:

- Registrar field group (via `wp acorn make:field`)
- Criar Livewire component (via `wp acorn make:livewire`)
- Verificar versões do stack (Acorn, Sage, PHP, Node, Livewire)
- Rodar migrations
- Validar sintaxe Blade

### Princípio 4 — Referenciar, não copiar

O `SKILL.md` diz *"ver `references/acf-patterns.md` para detalhes sobre location rules"* em vez de despejar o conteúdo. O Claude lê sob demanda.

### Princípio 5 — Skill activation via hook UserPromptSubmit

Um script examina o prompt, detecta palavras-chave e injeta apenas a skill relevante via `hookSpecificOutput.additionalContext`. Ganho adicional de 30-50% no baseline do session start.

---

## 4. Anatomia de uma skill madura

Exemplo estrutural para `skills/livewire/`:

```
skills/livewire/
├── SKILL.md                          # ~300 linhas
├── references/
│   ├── sage-integration.md           # boot do Acorn, @livewireStyles
│   ├── state-patterns.md             # wire:model vs .live, computed
│   ├── alpine-interop.md             # $wire.entangle + Tailwind v4
│   ├── common-errors.md              # "Unable to find component" etc
│   └── upstream-docs/
│       ├── livewire-v3.md            # espelho curado das docs oficiais
│       └── acorn-livewire.md
├── scripts/
│   ├── create-component.sh           # lando ssh -c "wp acorn make:livewire"
│   ├── check-versions.sh             # retorna Livewire+Acorn+PHP+Node
│   └── validate-blade.sh             # sintaxe + @livewire directives
└── assets/
    ├── component.php.tpl
    ├── view.blade.php.tpl
    └── test.php.tpl
```

**A mecânica**: `create-component.sh` recebe parâmetros, executa `wp acorn make:livewire` via Lando, retorna os caminhos criados. O Claude customiza apenas o que é específico da task — não regenera boilerplate.

---

## 5. Hooks: os 5 padrões de alto impacto

### SessionStart — detecta o stack automaticamente

```bash
#!/usr/bin/env bash
# hooks/scripts/session-start.sh
cd "$CLAUDE_PROJECT_DIR" || exit 0

echo "## Stack detectado"
if [ -f composer.json ]; then
    echo "**Acorn**: $(composer show roots/acorn --format=json 2>/dev/null | jq -r '.versions[0]' || echo 'n/a')"
    echo "**Sage**: $(composer show roots/sage --format=json 2>/dev/null | jq -r '.versions[0]' || echo 'n/a')"
fi
if [ -f .lando.yml ]; then
    echo "**Lando**: $(lando version 2>/dev/null | head -1)"
fi
echo "**Branch**: $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
```

Configuração em `hooks/hooks.json`:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-start.sh"
          }
        ]
      }
    ]
  }
}
```

### UserPromptSubmit — skill activation direcionada

Script Node ou Python analisa o prompt, detecta palavras-chave (`acf`, `livewire`, `blade`, `tailwind`, etc.) e injeta contexto resumido da skill via `additionalContext`. Evita carregar 5 skills quando só 1 importa.

### PreToolUse com matcher `Write|Edit` — proteção determinística

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-protected.sh"
          }
        ]
      }
    ]
  }
}
```

O script lê JSON do stdin, extrai o caminho do arquivo, e bloqueia com exit code 2 se for `.env`, `wp-config.php`, ou `bedrock/config/environments/`. A stderr vira mensagem de erro para o Claude — algo como *"use o Bedrock Vault / Trellis para esta edição"*.

### PostToolUse com matcher Blade — validação pós-edição

Após edição de um arquivo `.blade.php`, o hook roda lint/compile via Lando. Se falhar, retorna feedback imediato — antes do Claude seguir baseado em código quebrado.

### Stop — quality gate final

Antes do Claude declarar "pronto", roda PHPCS e ESLint. Se encontrar erros, retorna:

```json
{
  "decision": "block",
  "reason": "PHPCS: 3 errors in app/Controllers/HomeController.php"
}
```

O Claude é forçado a corrigir antes de entregar. É determinístico — ao contrário de instruções em `CLAUDE.md`, não pode ser ignorado.

---

## 6. Subagents: candidatos naturais

Subagents rodam em contexto isolado via Task tool. Perfeitos para operações que leem muita coisa e poluiriam o contexto principal.

**`acorn-migration-specialist`** — Analisa código legado (plugin procedural antigo), lê 20+ arquivos, propõe migração incremental para Acorn (Service Providers, Facades, Eloquent). Todo o ruído da análise fica no contexto do subagent.

**`livewire-debugger`** — Disparado quando o usuário relata "meu componente não atualiza". O subagent lê component + view + Alpine bindings + network logs e retorna diagnóstico estruturado (causa provável + fix).

**`tailwind-v4-auditor`** — Varre o projeto procurando sintaxe v3 legada (`tailwind.config.js` ativo, uso de `@apply` problemático, plugins incompatíveis) e gera plano de migração para `@theme`/`@utility`.

Definição em `agents/livewire-debugger.md`:
```markdown
---
name: livewire-debugger
description: Diagnostica componentes Livewire que não atualizam, não montam ou emitem erros no console do navegador
tools:
  - Read
  - Grep
  - Bash
---

Você é especialista em Livewire v3 sobre Acorn/Sage. Quando receber
um componente problemático, siga este checklist: [...]
```

---

## 7. MCP server (opcional, transformador)

Um MCP server custom em PHP ou Node que expõe introspection do stack Roots:

- `wp_query(args)` — roda WP_Query via Lando, retorna JSON
- `acf_field_groups()` — lista field groups registrados em runtime
- `livewire_components()` — componentes registrados no Acorn
- `db_schema(table)` — schema real das tabelas WP
- `acorn_routes()` — rotas registradas pelo Acorn

**O ganho**: o Claude para de "chutar" nomes de campos ou tabelas — consulta a realidade do ambiente antes de gerar código.

Declaração em `.mcp.json`:
```json
{
  "mcpServers": {
    "sage-introspect": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/mcp/sage-introspect/server.js"]
    }
  }
}
```

---

## 8. Mapeamento dos 4 tipos de Rules do Cursor

| Tipo Cursor | Equivalente no superpowers-sage |
|---|---|
| **Always** | `CLAUDE.md` no root do plugin — regras universais do stack (nunca editar `wp-config.php`, sempre rodar `wp` via Lando, usar Tailwind v4 `@theme`) |
| **Auto** (glob-based) | Hook `PostToolUse` com `"matcher": "\\*.blade.php"` ou `"matcher": ".*\\.php$"` injetando regras pós-edição |
| **Agent Requested** | Skill com YAML `description` rica — o Claude decide quando ativar |
| **Manual** | Slash command `commands/nome.md` — o usuário invoca explicitamente |

Exemplo de `CLAUDE.md` do plugin:
```markdown
# Roots Sage Stack — regras universais

## Ambiente
- Todos os comandos WP/Composer/Artisan rodam via `lando <cmd>`, nunca direto no host.
- O projeto usa Bedrock — código custom vai em `web/app/`, nunca em `web/wp/`.

## Arquivos protegidos
- `.env`, `wp-config.php`, `bedrock/config/environments/` são gerenciados
  pelo Trellis Vault — sugira sempre `ansible-vault edit`, nunca edite direto.

## Tailwind v4
- Não existe `tailwind.config.js` neste stack. Use `@theme` em `resources/css/app.css`.
- Evite `@apply` em favor de composição de utilities.
```

---

## 9. Roadmap de expansão em 4 fases

### Fase 1 — Refinamento das skills existentes (base otimizada)

- [ ] Auditar todas as descrições YAML (tornar trigger-rich)
- [ ] Identificar `SKILL.md > 500 linhas` e quebrar em `references/`
- [ ] Criar `scripts/` com operações determinísticas em cada skill
- [ ] Criar `assets/` com templates reutilizáveis
- [ ] Validar com `wc -l` que nenhum `SKILL.md` passa de 500 linhas

**Entregável**: skills compactas, descritas com precisão, com boilerplate extraído para scripts/templates.

### Fase 2 — Slash commands + hooks básicos

- [ ] `commands/sage-status.md` — versões + estado Lando + branch
- [ ] `commands/acf-register.md` — workflow de criar field group
- [ ] `commands/livewire-new.md` — atalho para novo componente
- [ ] `hooks/hooks.json` com `SessionStart` (detecção de stack)
- [ ] Hook `PreToolUse` protegendo `wp-config.php`, `.env`, `bedrock/config/`

**Entregável**: entrada rápida para tarefas comuns + proteções determinísticas básicas.

### Fase 3 — Subagents + quality gates

- [ ] `agents/acorn-migration.md`
- [ ] `agents/livewire-debugger.md`
- [ ] `agents/tailwind-v4-auditor.md`
- [ ] Hook `Stop` rodando PHPCS + ESLint (block em caso de erro)
- [ ] Hook `PostToolUse` para Blade (validação de sintaxe)

**Entregável**: contextos isolados para tarefas pesadas + quality gate automático.

### Fase 4 — MCP server custom

- [ ] Desenhar API do `sage-introspect`
- [ ] Implementar `wp_query`, `acf_field_groups`, `livewire_components`, `db_schema`
- [ ] Declarar em `.mcp.json`
- [ ] Documentar uso nas skills relevantes

**Entregável**: Claude consulta a realidade do ambiente em vez de "chutar".

---

## 10. Apêndice — Templates prontos

### SKILL.md template (trigger-rich)

```markdown
---
name: livewire
description: >
  Creates and modifies Livewire v3 components in Sage/Acorn projects;
  handles wire:model state, computed properties, Alpine.js interop via
  $wire.entangle; troubleshoots "Unable to find component" errors;
  integrates Livewire with Tailwind v4 styling. Activate when user
  mentions Livewire, wire:model, livewire component, @livewire directive,
  reactive component, or Alpine + Livewire.
metadata:
  author: Leonardo (codigodoleo)
  stack: bedrock+sage+acorn+lando
  version: "1.0"
---

# Livewire Skill

[< 500 linhas de instruções operacionais + ponteiros para references/]

## Critical Rules

### Rule 1 — Always use Acorn's make command, not manual stubs

Before creating any Livewire component, use:

\`\`\`bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/livewire/scripts/create-component.sh <Name>
\`\`\`

See [references/sage-integration.md](references/sage-integration.md) for details.

### Rule 2 — [...]
```

### plugin.json template

```json
{
  "name": "superpowers-sage",
  "version": "2.0.0",
  "description": "Claude Code superpowers for the Roots ecosystem: Bedrock + Sage + Acorn + Lando",
  "author": "codigodoleo",
  "homepage": "https://github.com/codigodoleo/superpowers-sage"
}
```

### hooks/hooks.json template

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-start.sh"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/skill-activation.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-protected.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-write-blade.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/stop-quality-gate.sh"
          }
        ]
      }
    ]
  }
}
```

### Script exemplo — pre-write-protected.sh

```bash
#!/usr/bin/env bash
# Bloqueia edição direta de arquivos protegidos do Bedrock/Trellis

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [[ -z "$file_path" ]]; then
    exit 0
fi

protected_patterns=(
    "wp-config\.php$"
    "\.env$"
    "bedrock/config/environments/"
    "trellis/group_vars/.*/vault\.yml$"
)

for pattern in "${protected_patterns[@]}"; do
    if [[ "$file_path" =~ $pattern ]]; then
        echo "BLOCKED: $file_path is managed by Trellis Vault / Bedrock config. Use 'ansible-vault edit' or update .env via the Bedrock pattern — do not edit directly." >&2
        exit 2
    fi
done

exit 0
```

---

## 11. Como abrir a próxima sessão

Ao iniciar uma nova sessão do Claude para trabalhar no plugin, usar esta mensagem como abertura:

> Estou evoluindo o plugin `codigodoleo/superpowers-sage` seguindo o estudo
> em anexo. Quero atacar a **Fase [N]** do roadmap, começando pela skill
> `[nome]`. Antes de qualquer código, audite a estrutura atual da skill
> e proponha o plano de refactor conforme os princípios 1-5 do documento.

Anexar este arquivo como contexto. Se usar **Projetos do Claude.ai**, fixar como arquivo do projeto — fica sempre disponível sem precisar reanexar.

---

## Referências externas (para verificação)

- Anthropic — Skills overview: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
- Anthropic — Skill authoring best practices: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices
- Anthropic — Claude Code hooks reference: https://code.claude.com/docs/en/hooks
- Anthropic — Claude Code plugins reference: https://code.claude.com/docs/en/plugins-reference
- Cursor — Rules documentation: https://cursor.com/docs/context/rules
