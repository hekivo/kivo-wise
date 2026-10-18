> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Spec — sage-design-system + sage-block-architecting

**Data:** 2026-04-17  
**Status:** aprovado pelo usuário  
**Referências de campo:** `interioresdecora.com.br` (MEMORY.md), `adrimar.com.br` (feedbacks 2026-04-05 e 2026-04-06)  
**Projetos de referência:** `adrimar.com.br/content/themes/adrimar/resources/views/components/`

---

## 1. Contexto e motivação

O ecossistema superpowers-sage promete implementação orientada a design (design → tokens → componentes → blocos), mas dois projetos de campo revelaram gaps sistemáticos:

- **Blocos construídos antes da fundação** — sem design system validado, CSS tipográfico e de aparência acaba espalhado em Tailwind hardcoded nas views.
- **Design system incompleto** — tokens definidos como "placeholders" mesmo quando o arquivo de design já tem valores reais; falta de rastreabilidade de origem (qual node Figma gerou qual token).
- **CSS sem contrato de escopo** — mistura de estrutural + visual + tipográfico no mesmo lugar.
- **Verificação não executada** — passos de validação parafraseados em vez de invocados; `build OK ≠ layout validado`.
- **Commit gate ausente** — trabalho implementado sem commit, invisível para CI e revisão.

### Sequência correta validada pelo adrimar

```
design-tokens.css  →  ui/ components  →  layout/ components
        ↓
    kitchensink (validado via build + screenshot)
        ↓
site-header + site-footer
        ↓
views/*.blade.php
        ↓
blocks/** (sage-block-architecting)
```

---

## 2. Dois skills novos

### 2.1 `sage-design-system`

**Responsabilidade exclusiva:** estabelecer a fundação visual do tema antes de qualquer bloco, view ou layout estrutural.

**Quando invocado:**
- Manualmente pelo usuário: `/sage-design-system`
- Automaticamente pelo `/architecting`: gate pré-implementação — se design system não existir ou não estiver validado (kitchensink verde), bloquear e invocar este skill primeiro

#### Fase 0 — Classificar o arquivo de design

Checklist obrigatório antes de escrever qualquer token:

- [ ] Qual design tool está ativa? (Figma / Paper / Pencil / Stitch)
- [ ] O arquivo é wireframe cinza, UI kit parcial ou alta fidelidade?
- [ ] Variáveis/estilos de marca presentes no arquivo? → Se **sim**: extrair tokens reais. **Proibido** escrever `/* placeholder */` sem decisão explícita do usuário registrada no `plan.md` com campo `design-status: placeholder-por-decisao`.
- [ ] Qual é o frame de referência primário? Registrar node-id no `plan.md` frontmatter.
- [ ] Qual a largura do frame canônico de QA? (ex: 1366px vs 1440px) → Propagar para `browser_resize` em todas as verificações do projeto.

#### Fase 1 — Tokens (`resources/css/design-tokens.css`)

```css
/**
 * Design tokens — extraídos do arquivo de design em [DATA].
 * Cada token carrega seu node de origem para rastreabilidade.
 */
@theme {
  /* Surfaces */
  --color-surface: oklch(100% 0 0deg);              /* MCP node 123:456 — bg-default */
  --color-surface-muted: oklch(96.5% 0.003 280deg); /* MCP node 123:457 — bg-muted */

  /* Brand */
  --color-brand-primary: oklch(86% 0.16 95deg);     /* MCP node 123:460 — brand-500 */

  /* Typography */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Montserrat', ui-sans-serif, system-ui, sans-serif;

  --text-display: clamp(2.25rem, 5vw, 4rem);        /* MCP node 123:470 — h1 hero */
  --text-h2: clamp(1.75rem, 2.5vw, 2.25rem);
  --text-body: 1rem;

  /* Radii, shadows, spacing... */
}
```

**Regras:**
- Todo token deve ter comment `/* MCP node <id> — <descrição> */` ou `/* design decision: <motivo> */`
- Sem valores hexadecimais inline nas views — apenas token references
- Importado por `app.css` e `editor.css` via `@import './design-tokens.css'`

#### Fase 2 — UI components (átomos)

Localização: `resources/views/components/ui/`

| Componente | Props mínimas | Variantes obrigatórias |
|---|---|---|
| `button.blade.php` | `variant`, `size`, `href` | primary, secondary, ghost, inverse |
| `heading.blade.php` | `level` (1–4) | tag dinâmica (`h1`–`h4`) + classes semânticas por nível |
| `badge.blade.php` | `variant` | neutral, brand |
| `text-link.blade.php` | `href`, `variant` | default, muted |
| `icon.blade.php` | `name`, `size` | — |

**Regras:**
- `@props([...])` com defaults explícitos
- `$attributes->merge(['class' => ...])` no elemento raiz
- Nenhum valor hardcoded — somente tokens via utility classes ou `var(--token)` 
- Sem `@apply` para layout — apenas para helpers de aparência específicos ao componente

#### Fase 3 — Layout components (estrutura pura)

Localização: `resources/views/components/layout/`

| Componente | Props mínimas | Responsabilidade |
|---|---|---|
| `section.blade.php` | `background`, `padding` | Wrapper de seção com surface + py-section |
| `container.blade.php` | `size` | max-w + px centrado |
| `grid.blade.php` | `cols`, `gap` | grid responsivo configurável |
| `stack.blade.php` | `gap`, `align` | flex-col com gap |
| `split.blade.php` | `reverse` | flex-row 2 colunas responsivo |

**Regra:** estes componentes **não têm aparência** — zero cores, zero tipografia. Apenas estrutura (flex, grid, padding, max-w, gap).

#### Fase 4 — Kitchensink

Criar `resources/views/kitchensink.blade.php` + rota de desenvolvimento (`/kitchensink`).

**Conteúdo obrigatório:** todos os componentes UI em todas as variantes + todos os layout components com conteúdo placeholder. Deve ser visualmente legível sem CSS externo ao tema.

**Gate de validação (normativo — não pode ser parafraseado):**

**Pré-requisito Playwright:** ToolSearch para `mcp__plugin_playwright_playwright__browser_take_screenshot`.
Se não encontrado:
```
⛔ Playwright MCP não configurado — screenshot automático indisponível.
   claude mcp add playwright -- npx -y @anthropic/playwright-mcp
   Reiniciar sessão após instalar.
   Alternativa: validação manual pelo usuário (registrar no plan.md com campo playwright-gate: deferred).
```

1. `lando theme-build` → deve completar sem erros
2. `mcp__plugin_playwright_playwright__browser_navigate` na URL do kitchensink
3. `mcp__plugin_playwright_playwright__browser_take_screenshot` → confirmar que componentes renderizam
4. Commit: `feat(theme): design system foundation — tokens, ui, layout components, kitchensink`

**O agente DEVE ter executado os itens 1–4 antes de declarar o design system como validado. Summary textual não substitui invocação.**

#### Fase 5 — Layouts estruturais

`resources/views/components/{theme}/site-header.blade.php`  
`resources/views/components/{theme}/site-footer.blade.php`

Estes são **compostos** — usam UI+layout components. Sem CSS próprio; toda aparência via tokens + classes Tailwind. Commit separado após validação.

---

### 2.2 `sage-block-architecting`

**Responsabilidade exclusiva:** arquitetar a camada visual de um bloco ACF — CSS contract, variações de tema, enqueue seletivo, README.

**Pré-requisito hard:** design system validado (kitchensink verde). Se não estiver, emitir mensagem: _"Execute /sage-design-system antes de arquitetar blocos."_ e parar.

**Quando invocado:**
- Manualmente: `/sage-block-architecting`
- Automaticamente pelo `/building`: após cada scaffold de controlador PHP + view Blade de bloco ACF

#### Modos de operação

| Modo | Quando | `$styles` | CSS |
|---|---|---|---|
| **Full** | Blocos com variações light/neutral/dark | 3 entradas | 3 blocos `&.is-style-*` |
| **Minimal** | Blocos com aparência única (footer, ticker, nav) | ausente | `.b-{slug}` scope + custom props |

Ambos mantêm isolamento de escopo completo. No Minimal, as mesmas 4 camadas se aplicam — apenas o bloco de variações é omitido.

#### O contrato de 4 camadas (modelo mental)

```
┌──────────────────────────────────────────────────────────────┐
│  CAMADA 1 · design-tokens.css + UI/layout components         │
│  Tipografia semântica via <x-ui.heading :level="1">          │
│  Fundação validada pelo sage-design-system                   │
├──────────────────────────────────────────────────────────────┤
│  CAMADA 2 · resources/css/blocks/{slug}.css                  │
│  Aparência visual: --block-bg, --block-text, etc.            │
│  Variações via &.is-style-* + .is-style-* & (seletor duplo)  │
│  @apply apenas para bg e overflow — zero layout              │
├──────────────────────────────────────────────────────────────┤
│  CAMADA 3 · Blade view + Tailwind utilities                  │
│  CSS estrutural puro: flex, grid, gap, px-*, max-w-*         │
│  Zero hardcode de cor. Zero tipografia.                      │
├──────────────────────────────────────────────────────────────┤
│  CAMADA 4 · ThemeServiceProvider::boot()                     │
│  Enqueue seletivo: has_block("acf/{slug}") priority 20       │
│  Nunca em assets() — timing issue silencioso pós wp_head()   │
└──────────────────────────────────────────────────────────────┘
```

**Regra de ouro:** um bloco está correto quando é possível trocar as 3 variações de tema sem alterar uma linha da view Blade.

#### Fase 1 — Auditar (se bloco existente) ou saltar (se novo)

Se bloco já existe: classificar cada regra CSS como estrutural / visual / tipográfica. Listar o que muda de camada. Se novo: ir direto para Fase 2.

#### Fase 2 — Decidir modo

Perguntar ao usuário (ou inferir do contexto): este bloco precisa de variações de tema? → Full ou Minimal.

#### Fase 3 — Implementar A1–A4

**A1 — `resources/css/blocks/{slug}.css`:**

```css
@reference "../app.css";

.b-{slug} {
  /* Variação light (default) */
  --block-bg:        var(--color-surface);
  --block-text:      var(--color-foreground);
  --block-text-sub:  var(--color-foreground-muted);
  --block-border:    var(--color-border);
  --block-btn-bg:    var(--color-foreground);
  --block-btn-text:  var(--color-foreground-on-inverse);

  /* neutral */
  &.is-style-neutral,
  .is-style-neutral & {
    --block-bg:     var(--color-surface-muted);
    --block-border: var(--color-border-strong);
  }

  /* dark */
  &.is-style-dark,
  .is-style-dark & {
    --block-bg:       var(--color-surface-inverse);
    --block-text:     var(--color-foreground-on-inverse);
    --block-text-sub: color-mix(in srgb, var(--color-foreground-on-inverse) 60%, transparent);
    --block-border:   color-mix(in srgb, var(--color-foreground-on-inverse) 20%, transparent);
  }

  color: var(--block-text);
  @apply bg-[var(--block-bg)] overflow-hidden;
}
```

Notas de implementação:
- `@reference` (não `@import`) — acesso a tokens sem duplicar o CSS inteiro
- Seletor duplo `&.is-style-* + .is-style-* &` **sempre obrigatório** — WP aplica a classe no wrapper pai no editor, no elemento raiz no frontend
- `assets()` permanece **vazio** com comentário explicativo (timing issue)
- Modo Minimal omite os blocos de variação — apenas `.b-{slug}` scope + custom props base

**A2 — `app/Blocks/{ClassName}.php` (modo Full):**

```php
public $styles = [
    ['label' => 'Light',   'name' => 'light',   'isDefault' => true],
    ['label' => 'Neutral', 'name' => 'neutral'],
    ['label' => 'Dark',    'name' => 'dark'],
];

/**
 * Intentionally empty. CSS is conditionally enqueued by ThemeServiceProvider::boot()
 * via has_block() + wp_enqueue_scripts (priority 20), because this method registers
 * enqueue_block_assets inside render() — after wp_head() has already executed.
 * See: vendor/log1x/acf-composer/src/Block.php lines 797–803.
 */
public function assets(array $block): void {}
```

Notas:
- `$styles` usa `name` (não `value`) — exigido pelo WP desde 6.x
- Modo Minimal: omitir `$styles` inteiramente

**A3 — `resources/views/blocks/{slug}.blade.php`:**

```blade
<section {{ $attributes->merge(['class' => 'b-{slug} flex flex-col']) }}>
  {{-- Tipografia via <x-ui.heading> ou classes semânticas de design-tokens --}}
  {{-- Cor herdada de color: var(--block-text) no CSS do bloco --}}
  <x-ui.heading :level="2">{{ $titulo }}</x-ui.heading>
  <p class="text-[var(--block-text-sub)]">{{ $descricao }}</p>

  <x-ui.button variant="primary" :href="$cta_url">{{ $cta_label }}</x-ui.button>
</section>
```

Notas:
- `$attributes->merge()` injeta `is-style-*`, `alignfull`, etc. no elemento raiz
- `bg-[var(--block-bg)]` **não vai na view** — já está no CSS via `@apply`
- Cor não vai na view — herda de `color: var(--block-text)` no root
- Usar `<x-ui.heading>`, `<x-ui.button>` sempre que possível

**A4 — `resources/css/editor.css`:**

```css
@import './blocks/{slug}.css';
/* um @import por bloco arquitetado */
```

#### Fase 4 — Enqueue guard

1. Verificar se `ThemeServiceProvider::boot()` já contém o padrão `has_block()`:
   - **Sim** → adicionar apenas a entrada do novo bloco
   - **Não** → implementar o padrão completo, depois adicionar a entrada

**Padrão completo (se não existir):**

```php
public function boot(): void
{
    parent::boot();

    // Seletive block CSS enqueue — avoids assets() timing issue (fires after wp_head)
    add_action('wp_enqueue_scripts', function () {
        $blocks = [
            '{slug}' => \Roots\asset('css/blocks/{slug}.css'),
            // adicionar novos blocos aqui
        ];

        foreach ($blocks as $slug => $asset) {
            if (has_block("acf/{$slug}")) {
                wp_enqueue_style("block-{$slug}", $asset->uri(), [], $asset->version());
            }
        }
    }, 20);
}
```

#### Fase 5 — README do bloco (`docs/blocks/{slug}.md`)

```markdown
# Block: {Nome Humano}

> {Objetivo em uma frase — o que este bloco faz e onde é usado.}

## Campos ACF

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| titulo | Text | sim | Título principal |

## Variações de tema

| Nome | Classe Gutenberg | Aparência |
|---|---|---|
| Light (padrão) | `is-style-light` | Fundo claro |
| Neutral | `is-style-neutral` | Fundo muted |
| Dark | `is-style-dark` | Fundo escuro, texto invertido |

_(omitir esta seção em blocos Minimal)_

## CSS tokens disponíveis

| Token | Descrição |
|---|---|
| `--block-bg` | Cor de fundo do bloco |
| `--block-text` | Cor principal (herdada por filhos) |
| `--block-text-sub` | Subtítulo / descrição |
| `--block-border` | Bordas internas |

## Como usar no editor

1. Adicionar bloco: "{Nome Humano}"
2. Preencher campos no painel lateral
3. Trocar variação em Estilos

## Dependências

- ACF Composer: `App\Blocks\{ClassName}`
- CSS: `resources/css/blocks/{slug}.css`
- Enqueue: `ThemeServiceProvider::boot()` via `has_block("acf/{slug}")`
```

#### Fase 6 — Verificação (Definition of Done)

| Nível | Fonte | O que validar | Obrigatório |
|---|---|---|---|
| A | MCP design tool — geometria | `get_metadata` (Figma) / `get_node_info` (Paper) / `batch_get(readDepth:4)` (Pencil) | Sim para layouts multi-coluna |
| B | MCP design tool — estilos | `get_design_context` (Figma) / `get_computed_styles` (Paper) / `batch_get(resolveVariables:true)` (Pencil) / `get_screen` (Stitch) | Sempre |
| C | Playwright MCP | `mcp__plugin_playwright_playwright__browser_take_screenshot` na largura canônica do `plan.md` | Sim |
| E | Humano | Lado a lado design vs browser | Obrigatório na primeira entrega |

**Método de referência aceito:** "live reference" via MCP design tool (Figma / Paper / Pencil / Stitch) + `mcp__plugin_playwright_playwright__browser_take_screenshot`. `*-ref.png` em disco é opcional quando a ref viva está disponível via MCP.

**Gate normativo (o agente DEVE executar antes de declarar conclusão):**
1. `lando theme-build` → sem erros, `{slug}-*.css` listado
2. `lando flush` → limpa Acorn/Blade/OPcache
3. `mcp__plugin_playwright_playwright__browser_navigate` + `mcp__plugin_playwright_playwright__browser_take_screenshot` → screenshot na largura canônica
4. Confirmar `<link href="*/{slug}-*.css">` no `<head>` (enqueue seletivo funcionando)
5. `git commit` com mensagem convencional + `git push` se branch remota

**Summary textual não substitui invocação de tools. O agente cita os outputs (path de screenshot, URL navegada, resultado do build) ou o trabalho não está concluído.**

#### Anti-drift — erros comuns

| Erro | Correto |
|---|---|
| `assets()` com `wp_enqueue_style()` | `assets()` vazio — timing issue pós `wp_head()` |
| `&.is-style-dark` apenas | `&.is-style-dark, .is-style-dark &` — seletor duplo obrigatório |
| `@import "../app.css"` no CSS do bloco | `@reference "../app.css"` — evita duplicar todo o CSS |
| Hardcode `bg-[#F4EFE8]` na view | `var(--block-bg)` via CSS do bloco |
| `['value' => 'dark']` em `$styles` | `['name' => 'dark']` — formato WP 6.x |
| `h1 { font-size: 72px }` no CSS do bloco | `<x-ui.heading :level="1">` — tipografia via componente |
| Tipografia `font-display text-[72px]` na view | `<x-ui.heading>` — especificidade correta via componente |
| README em `resources/views/blocks/` | README em `docs/blocks/{slug}.md` |
| `*-ref.png` obrigatório para verificar | Live reference via MCP design tool é aceita |
| Bloco Minimal sem escopo CSS | `.b-{slug}` scope + custom props sempre obrigatórios |
| Declarar "concluído" sem commit | Commit + push antes de declarar — estado Git é parte do DoD |

---

## 3. Melhorias em skills existentes

### 3.1 `/building` — adições necessárias

1. **Gate pré-bloco:** após scaffold de controlador PHP + view, verificar se design system está validado (kitchensink verde). Se não → invocar `/sage-design-system` e pausar.
2. **Delegação obrigatória:** após cada scaffold ACF, invocar `/sage-block-architecting` antes de avançar para o próximo componente.
3. **Fallback sem design-extractor (ex: Cursor):** se subagente não disponível, alternativa aceita: reler `section-*-spec.md` em disco + invocar a ferramenta de estilos do MCP design tool ativo (`get_design_context` Figma / `get_computed_styles` Paper / `batch_get(resolveVariables:true)` Pencil / `get_screen` Stitch) + atualizar `plan.md` com `design-extractor: deferred` no frontmatter.
4. **Gate de encerramento:** após `lando theme-build` + verificação, executar `git commit` + `git push` antes de declarar fase concluída. Sem exceção, a menos que o usuário solicite explicitamente o contrário.

### 3.2 `/verifying` — adições necessárias

> **Nota:** O `verifying/SKILL.md` já usa os nomes corretos `mcp__plugin_playwright_playwright__browser_navigate` e `mcp__plugin_playwright_playwright__browser_take_screenshot`. As adições abaixo são as que genuinamente faltam.

1. **Live reference como Priority 0:** elevar "Design MCP via live reference" para o topo da cadeia — quando MCP design tool disponível (`get_screenshot` / `get_design_context` / `batch_get`), consultar a fonte viva antes de ler `*-ref.png` em disco. Atualmente está em priority 3 (fallback); deve ser priority 0 (preferido).
2. **`get_metadata` / `batch_get` para layouts multi-coluna:** após `get_design_context` / `get_computed_styles`, invocar a ferramenta de geometria (conforme tabela da Fase 6) para x/y/width dos filhos — quando o componente tiver grid ou offsets.
3. **Largura canônica do `plan.md`:** no step de `browser_navigate`, ler frontmatter do plano para `browser_resize` em vez de assumir 1440px por padrão.

### 3.3 `/sageing` — adições necessárias

**1. Glossário Playwright MCP ≠ Playwright Test npm:**
- **Playwright MCP** (`mcp__plugin_playwright_playwright__browser_navigate`, `mcp__plugin_playwright_playwright__browser_take_screenshot`, etc.) — servidor MCP para comparação de layout com design. Acessa o site Lando diretamente via `https://{projeto}.lndo.site`. Namespace correto: `mcp__plugin_playwright_playwright__*` (não `mcp__playwright__*`).
- **Playwright Test npm** (`@playwright/test`, `npm run test:e2e`) — suite E2E do repositório, distinta. Requer browser binário instalado. Não substitui validação visual contra design.

**2. Adicionar Pencil à tabela Design Tool Integration:**
- Trigger: path `*.pen` ou pasta `design/` com `.pen` files (sem URL)
- MCP: `mcp__pencil__*`
- Corrigir entrada Playwright na tabela: `mcp__playwright__*` → `mcp__plugin_playwright_playwright__*`

**3. Atualizar referências de Pencil no sageing:**
- Descrição de `/designing` na tabela Workflow Skills: acrescentar "Pencil" ao lado de Paper/Stitch/Figma
- `plan.md` frontmatter docs: adicionar `pencil` como opção válida em `design-tool:`
- Novos skills na tabela: `sage-design-system` e `sage-block-architecting`

---

## 4. Artefatos a criar/editar

| # | Tipo | Caminho | Ação |
|---|---|---|---|
| 1 | Skill | `skills/sage-design-system/SKILL.md` | Criar |
| 2 | Skill | `skills/sage-block-architecting/SKILL.md` | Criar |
| 3 | Skill | `skills/building/SKILL.md` | Editar (seções 3.1) |
| 4 | Skill | `skills/verifying/SKILL.md` | Editar (seções 3.2 — live reference priority 0, get_metadata, largura canônica) |
| 5 | Skill | `skills/sageing/SKILL.md` | Editar (glossário 3.3 — Playwright MCP vs npm, Pencil, namespace correto, novos skills) |
| 6 | Skill | `skills/architecting/SKILL.md` | Editar (gate design system) |

---

## 5. Self-review da spec

- [x] Sem placeholders ou `TODO` sem decisão
- [x] Tokens de exemplo agnosticamente nomeados (sem valores específicos do interioresdecora)
- [x] Seletor duplo documentado com razão técnica
- [x] Enqueue pattern completo incluindo o guard de "já existe?"
- [x] README de bloco em `docs/blocks/` (não em views)
- [x] Live reference MCP aceita em /verifying e Fase 6
- [x] Commit gate em todos os gates de conclusão
- [x] Glossário Playwright MCP vs npm documentado com namespace correto (`mcp__plugin_playwright_playwright__*`)
- [x] Levels A e B na Fase 6 são tool-agnósticos (Figma / Paper / Pencil / Stitch)
- [x] Fase 4 gate usa ToolSearch antes de invocar Playwright (silent failure evitado)
- [x] Stitch incluído em todas as listas de design tools
- [x] sageing: Pencil + namespace Playwright + novos skills cobertos em 3.3
- [x] verifying: adições corretas (live ref priority 0, multi-coluna, largura canônica) — sem duplicar o que já está implementado
- [x] Modo Minimal preserva isolamento completo
