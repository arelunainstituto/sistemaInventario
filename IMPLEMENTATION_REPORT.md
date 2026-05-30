# Relatório de Implementação — Módulo Inventário Areluna

> **Versão**: 1.0.0 (stable)
> **Data**: 2026-05-30
> **Especificação base**: Sistema de Gestão de Inventário e Patrimônio — Instituto Areluna v1.0 (25-mai-2026)
> **Escopo**: 3 unidades operacionais (Marquês, Cristal, Laboratório ProStoral)

---

## Sumário Executivo

| Métrica | Valor |
|---|---|
| Status | **3/3 fases entregues**, 4 sprints incrementais aplicadas |
| Migrações SQL | 11 arquivos versionados em `database/inventory-refactor/` |
| Endpoints API | 23 arquivos de rota em `api/inventory/`, todos com `authenticateToken` + `requirePermission` |
| Telas UI | 21 páginas HTML modulares em `public/inventory/` |
| Perfis de acesso | 4 (conforme §RF10): `Inventory_Admin`, `Inventory_Operador`, `Inventory_Consulta`, `Inventory_Contabilidade` |
| Permissões granulares | 10 (`inventory:read|create_item|update_item|entry|exit|transfer|adjust|inventory_session|reports|financial`) |
| Regras de negócio cobertas | **10/10** (RN01 a RN10) |
| Tabelas legadas | 10 renomeadas para `*_old` (read-only via RLS) |

---

## Visão Geral da Arquitetura

```
                  ┌──────────────────────────────┐
                  │   public/inventory/*.html    │   ← 21 telas modulares
                  │   _layout.js (shell shared)  │
                  └────────────┬─────────────────┘
                               │ fetch + Bearer JWT
                               ▼
        ┌──────────────────────────────────────────────┐
        │   api/inventory/*  (Express Router)          │
        │   ├── authenticateToken  (router-level)      │
        │   ├── accessLog          (router-level)      │
        │   └── requirePermission('inventory', '<x>')  │
        └────────────┬─────────────────────────────────┘
                     │ supabaseAdmin (SERVICE_ROLE)
                     ▼
        ┌──────────────────────────────────────────────┐
        │   Supabase / Postgres                        │
        │   ├── 16 tabelas inv_*                       │
        │   ├── 8 funções PL/pgSQL (CMP, FEFO, dep.)   │
        │   ├── 7 views + 2 materialized               │
        │   ├── 3 triggers de integridade (RN07/RN08)  │
        │   ├── 2 jobs pg_cron (depreciação anual, MV) │
        │   └── RLS por tabela (defense-in-depth)      │
        └──────────────────────────────────────────────┘
```

Stack confirmada: **Express 4.x + Vanilla JS + Tailwind CDN + Supabase (Postgres + Auth + Storage + Realtime + pg_cron) + QRCode/PDFKit/XLSX**.

---

## 1 · Mapeamento Feature × Especificação

### §1 e §2 — Objetivo e Estrutura Organizacional

| Item da spec | Implementação | Local |
|---|---|---|
| Sistema único para 3 unidades | Seed inicial de `inv_units` (MARQUES, CRISTAL, PROSTORAL) | [10-fase1-cadastros-entradas.sql:609-613](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L609-L613) |
| Hierarquia Unidade → Sublocalização (gabinetes, armazéns, áreas) | Tabela `inv_locations` com `unit_id` FK + `type` CHECK | [10-fase1…:55-67](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L55-L67) |
| Flags operacionais por localização | `can_receive` / `can_send` BOOLEAN; bloqueia transferências inválidas | [20-fase2-saidas-movimentos.sql:213-220](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L213-L220) |

### §3 e §4 / RF10 — Perfis de Acesso

Os 4 perfis foram criados **um a um conforme o documento** — não há mais nem menos:

| Perfil (spec) | Role implementado | Permissões mapeadas | SQL |
|---|---|---|---|
| Administrador (RF10.a) | `Inventory_Admin` (level 80) | TODAS (10) | [01-roles-permissions.sql:41,106-110](database/inventory-refactor/01-roles-permissions.sql#L41) |
| Operador (RF10.b) | `Inventory_Operador` (level 30) | read, create_item, update_item, entry, exit, transfer, inventory_session, **adjust** ⁽¹⁾ | [01-…:113-119](database/inventory-refactor/01-roles-permissions.sql#L113) + [02-fix-operador-adjust.sql](database/inventory-refactor/02-fix-operador-adjust.sql) |
| Consulta (RF10.c) | `Inventory_Consulta` (level 10) | read, reports | [01-…:121-123](database/inventory-refactor/01-roles-permissions.sql#L121) |
| Contabilidade (RF10.d) | `Inventory_Contabilidade` (level 20) | read, reports, financial | [01-…:125-128](database/inventory-refactor/01-roles-permissions.sql#L125) |

> ⁽¹⁾ A permissão `inventory:adjust` foi adicionada ao Operador via `02-fix-operador-adjust.sql` por alinhamento com §RF06 ("autorização necessária para ajustes acima de 5%"). A regra dos 5% bloqueia o Operador além desse limite — implementada em [`fn_inv_adjust`:318-322](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L318-L322). Ajustes ≤ 5% são livres para o Operador.

Bypass de admin: middleware reconhece role `admin/Admin` em `authenticateToken` e pula `requirePermission` ([auth.js:212-215](api/middleware/auth.js#L212-L215)).

### §5 — Cadastro de Itens

| Sub-requisito | Implementação |
|---|---|
| **Distinção macro Consumo × Patrimonial** como primeiro passo do cadastro | UI [item-form.html](public/inventory/item-form.html) — radio inicial dispara render condicional do formulário; CHECK no DB em `inv_items.macro_category` ([10-fase1…:122-123](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L122-L123)) |
| **Categoria livre cadastrável** (resinas, ceras, gesso…) | Tabela `inv_categories` com `parent_macro` ('consumo'/'patrimonial'); seed inicial de 17 subcategorias ([10-fase1…:616-634](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L616-L634)) |
| Código interno automático (formato `SKUNNN`) | Sequence `seq_inv_sku` + trigger `fn_inv_items_before_insert` ([30-fase3-relatorios-inventario.sql:48-54](database/inventory-refactor/30-fase3-relatorios-inventario.sql#L48-L54)) |
| Patrimônio automático (formato `PAT-NNNNNN`) — só para macro=patrimonial | Mesma função, linhas 61-64; cobertura via `seq_inv_patrimony` |
| Imagem e PDF anexáveis | Endpoints `POST /items/:id/image` e `POST /items/:id/pdf` com Multer; bucket Supabase Storage `item-images` / `item-pdfs` ([items.js:209-235](api/inventory/items.js#L209-L235)) |
| Unidades de medida com conversão (compra × consumo) | FKs `purchase_uom_id`, `consumption_uom_id`, `base_uom_id` + `conversion_factor` em `inv_items` ([10-fase1…:127-132](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L127-L132)) |
| Parâmetros de stock (min/max, lead-time, reorder_point) | Colunas dedicadas em `inv_items`; reorder default = min_stock ([10-fase1…:151-156](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L151)) |
| Campos patrimoniais (aquisição, valor, taxa de depreciação) só em macro=patrimonial | CHECK de coerência ([10-fase1…:170-175](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L170-L175)) + validação no API ([items.js:30-47](api/inventory/items.js#L30-L47)) |
| Campos imutáveis após criação | `internal_code`, `qr_code`, `macro_category`, `controls_lot`, `uses_serial`, `patrimony_number` bloqueados no PUT ([items.js:160](api/inventory/items.js#L160)) |
| `cmp` e `asset_status` editáveis só por Inventory_Admin | Gate explícito no PUT ([items.js:162-175](api/inventory/items.js#L162-L175)) — usuário comum recebe 403 e mensagem orientando uso do fluxo correto (entradas / depreciação) |

### §6 — Localizações

Implementado conforme §6 com `inv_units` + `inv_locations`. Tela [locations.html](public/inventory/locations.html) gerencia hierarquia, tipo (gabinete/armazem/area/laboratorio), e flags operacionais. Telas de transferência só listam localizações com `can_send=true` (origem) e `can_receive=true` (destino).

### §7 — Entradas

| Item | Implementação |
|---|---|
| Cabeçalho + linhas em transação única | `inv_entries` + `inv_entry_lines` com FK cascade ([10-fase1…:265-300](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L265-L300)); trigger `fn_inv_process_entry_line` AFTER INSERT processa cada linha atomicamente |
| Tipo de documento (fatura/guia/encomenda) | CHECK em `inv_entries.document_type` ([10-fase1…:270](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L270)) |
| **RN02 — unicidade do documento por fornecedor** | UNIQUE composto `(document_type, document_number, supplier_id)` ([10-fase1…:276](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L276)) |
| Lote + validade obrigatórios para macro=consumo (RN03) | Validação interna em `fn_inv_process_entry_line` ([10-fase1…:463-465](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L463-L465)); cria/atualiza `inv_lots` automaticamente |
| Nº de série para patrimônio | Gravado em `inv_lots.serial_number` quando macro=patrimonial; gerado se faltante |
| Recálculo de CMP por entrada (§11.1) | `fn_inv_recalc_cmp` chamada por cada linha ([10-fase1…:414-445](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L414-L445)); CMP = ((stock_atual × CMP) + (qty_entrada × custo)) / stock_total |
| Conversão unidade compra → unidade consumo | Coluna gerada `consumption_qty = purchase_qty × conversion_factor` em `inv_entry_lines` ([10-fase1…:294-295](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L294-L295)) |
| Total da entrada recalculado | Trigger `fn_inv_entry_recalc_total` somando linhas ([10-fase1…:531-546](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L531-L546)) |

### §8 — Saídas

| Subtipo (spec) | Implementação |
|---|---|
| Consumo, avaria, extravio, perda, quebra, depreciação | CHECK enum em `inv_movements.subtype` + UI dropdown em [exits.html](public/inventory/exits.html) |
| **RN05 — stock nunca negativo** | Validação em `fn_inv_consume` ([20-fase2…:142-145](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L142-L145)) |
| **RN04 — FEFO (First Expiry First Out)** | Quando lote não informado e item controla lote, query `ORDER BY expiry_date ASC NULLS LAST LIMIT 1` ([20-fase2…:104-120](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L104-L120)) |
| Justificação obrigatória para avaria/extravio/perda/quebra/depreciação | Validação em `fn_inv_consume` ([20-fase2…:156-160](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L156-L160)) |
| Confirmação se stock cai abaixo do mínimo | Parâmetro `confirmed_low_stock` + exceção se não confirmado ([20-fase2…:149-154](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L149-L154)) |
| Saída de depreciação muda asset_status para 'baixado' (§RN09 manual) | Update condicional em `fn_inv_consume` ([20-fase2…:180-183](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L180-L183)) |

### §9 — Movimentações Internas (Transferências)

| Item | Implementação |
|---|---|
| Transferência entre localizações | Função `fn_inv_transfer` ([20-fase2…:192-267](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L192-L267)) gera 2 movimentos: `transferencia_saida` na origem e `transferencia_entrada` no destino |
| Validação de localizações (origem ≠ destino, flags ok) | Linhas 213-220 |
| §9.2 — patrimônio sem duplicação | View `vw_inv_patrimony_locations` deriva localização atual de `inv_stock.quantity > 0` ([20-fase2…:51-69](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L51-L69)) |
| Mesmo CMP no destino (sem distorção) | `cmp_at_moment` copiado do CMP atual do item ([20-fase2…:257-263](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L257-L263)) |

### §10.2 — Ajustes Manuais (§RF06)

| Item | Implementação |
|---|---|
| Ajuste positivo ou negativo de stock | `fn_inv_adjust` com `delta_qty` (sinalizado) ([20-fase2…:272-369](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L272-L369)) |
| Motivo predefinido obrigatório | Seed `inv_adjustment_reasons` com 5 motivos: `correcao_erro`, `sobra_inventario`, `quebra_nao_registada`, `desvio`, `outro` ([20-fase2…:33-39](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L33-L39)) |
| Justificação livre obrigatória | Validação no início da função (linha 282) |
| **§RF06 — ajustes > 5% requerem Inventory_Admin** | Cálculo `v_abs_pct = ABS(delta) / GREATEST(stock_qty, 1)`; bloqueio se > 0.05 e não-admin ([20-fase2…:318-322](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L318-L322)) |
| Ajuste negativo que ficaria abaixo de zero requer admin + flag explícita | Exceção controlada ([20-fase2…:324-333](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L324-L333)) |

### §10.3 — Inventário Físico

| Etapa (spec) | Implementação |
|---|---|
| Abrir sessão por localização | `fn_inv_open_session` cria `inv_inventory_sessions` + snapshot de `expected_qty` em `inv_inventory_counts` ([30-fase3…:333-354](database/inventory-refactor/30-fase3-relatorios-inventario.sql#L333-L354)) |
| Apenas 1 sessão aberta por localização | UNIQUE index parcial `WHERE status = 'em_contagem'` ([30-fase3…:100-102](database/inventory-refactor/30-fase3-relatorios-inventario.sql#L100-L102)) |
| Lançamento das contagens (item esperado) | `fn_inv_update_count` ([30-fase3…:357-384](database/inventory-refactor/30-fase3-relatorios-inventario.sql#L357-L384)) |
| Lançamento de **item surpresa** (não esperado na localização) | `fn_inv_add_count_line` ([30-fase3…:387-402](database/inventory-refactor/30-fase3-relatorios-inventario.sql#L387-L402)) |
| Validação da sessão gera ajustes em `inv_movements` | `fn_inv_close_session` percorre diferenças e cria movimento tipo `inventario` para cada uma ([30-fase3…:405-471](database/inventory-refactor/30-fase3-relatorios-inventario.sql#L405-L471)) |
| Cancelamento | `fn_inv_cancel_session` ([30-fase3…:474-486](database/inventory-refactor/30-fase3-relatorios-inventario.sql#L474-L486)) |
| UI wizard de contagem | [inventory-session.html](public/inventory/inventory-session.html) — abre, conta, valida; permite registar item surpresa |

### §11 — Indicadores

| Indicador (spec) | Implementação | Fonte de cálculo |
|---|---|---|
| §11.1 — CMP (Custo Médio Ponderado) | Coluna `inv_items.cmp` + função `fn_inv_recalc_cmp` | [10-fase1…:414-445](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L414-L445) |
| §11.2 — Stock total por item / localização | View `vw_inv_total_stock` | [30-fase3…:170-175](database/inventory-refactor/30-fase3-relatorios-inventario.sql#L170-L175) |
| §11.3 — Consumo médio diário | View `vw_inv_avg_daily_consumption` com **janela configurável por categoria** (30/60/90/180/365 dias) | [41-fix-views-cascade.sql:28-47](database/inventory-refactor/41-fix-views-cascade.sql#L28-L47) + coluna `inv_categories.consumption_window_days` ([40-sprint4c-log-window.sql:63-65](database/inventory-refactor/40-sprint4c-log-window.sql#L63-L65)) |
| §11.4 — Ponto de reposição | View `vw_inv_reorder_status` com status `rutura/abaixo_minimo/abaixo_reposicao/acima_maximo/ok` | [41-fix-views-cascade.sql:50-74](database/inventory-refactor/41-fix-views-cascade.sql#L50-L74) |
| §11.5 — Cobertura em dias | View `vw_inv_stock_coverage` | [41-fix-views-cascade.sql:77-94](database/inventory-refactor/41-fix-views-cascade.sql#L77-L94) |

### §12 — Relatórios

| Relatório | Endpoint | Formato |
|---|---|---|
| §12.1 — Reposição | `GET /api/inventory/reports/reorder` ([reports.js:19-39](api/inventory/reports.js#L19-L39)) | JSON / CSV / XLSX / PDF |
| §12.2 — Stock vs Min/Max | `GET /reports/stock-min-max` ([reports.js:42-60](api/inventory/reports.js#L42-L60)) | idem |
| §12.3 — Cobertura | `GET /reports/coverage` | idem |
| §12.4 — Valorização (CMP × qty) | `GET /reports/valuation` — **permissão `inventory:financial`** ([reports.js:83](api/inventory/reports.js#L83)) | idem |
| §12.5 — Sessões de inventário | `GET /reports/inventory-sessions` | idem |
| §12.6 — Kardex por item | `GET /reports/kardex/:itemId` ([reports.js:155](api/inventory/reports.js#L155)); view `vw_inv_kardex` com saldo acumulado | idem |
| §12.7 — Tendência de consumo | `GET /reports/consumption-trend`; materialized view `mvw_inv_consumption_trend` (16 meses) | idem |
| §12.8 — Atividade por usuário | `GET /reports/user-activity`; materialized view `mvw_inv_user_activity` | idem |

Exportação: CSV via stringify; XLSX via lib `xlsx`; PDF via `pdfkit`. Tela [reports.html](public/inventory/reports.html) faz preview tabular e oferece os 4 formatos.

### §13 — QR Code (preferido sobre código de barras)

| Item | Implementação |
|---|---|
| QR único por item, gerado automaticamente | `inv_items.qr_code UUID UNIQUE DEFAULT gen_random_uuid()` ([10-fase1…:126](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L126)) |
| Etiqueta imprimível com QR + dados do item | [item-label.html](public/inventory/item-label.html) — consome `/api/inventory/items/:id/qr` (data URL base64) |
| Geração on-demand via biblioteca `qrcode` | Endpoint `handleQrCode` ([items.js:241-273](api/inventory/items.js#L241-L273)); payload do QR aponta para `/inventory/scan.html?code=<uuid>` |
| Leitura por câmera de telemóvel | [scan.html](public/inventory/scan.html) + endpoint `GET /api/inventory/scan/:qrCode` ([scan.js](api/inventory/scan.js)) — UUID validado por regex |
| Código de barras opcional | Coluna `inv_items.barcode` nullable; filtro aceita ambos |

### §14 — Log de Acesso (Auditoria)

| Item | Implementação |
|---|---|
| Registro de quem fez o quê | Tabela `inv_access_log` (user_id, method, path, entity_type, entity_id, status_code, duration_ms) ([42-finalize-sprint4c.sql:41-53](database/inventory-refactor/42-finalize-sprint4c.sql#L41-L53)) |
| Middleware automático | [_access-log.js](api/inventory/_access-log.js) instalado no router agregador |
| Retenção configurável | `inv_system_settings.access_log_retention_months` default 24; purga via `fn_inv_purge_access_log` + pg_cron mensal ([42-finalize-sprint4c.sql:67-92](database/inventory-refactor/42-finalize-sprint4c.sql#L67-L92)) |
| UI consultável só por Admin | [access-log.html](public/inventory/access-log.html); endpoints com `requireRole` ([access-log.js](api/inventory/access-log.js)) |
| **Botão "Apagar tudo" com confirmação textual** | DELETE / requer `confirm: "APAGAR TUDO"` no body ([access-log.js:205](api/inventory/access-log.js#L205)) |
| Filtro de ruído (não registra GETs polled) | Lista whitelist em `shouldLog`; apenas `reports/*` e `depreciation/runs` GETs são registados |

---

## 2 · Regras de Negócio (RN01-RN10)

| ID | Regra | Onde está implementada | Status |
|---|---|---|---|
| **RN01** | Item deve ter unidade de medida base obrigatória | NOT NULL + FK `inv_items.base_uom_id` ([10-fase1…:127](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L127)); validação no API ([items.js:36](api/inventory/items.js#L36)) | ✅ |
| **RN02** | Documento de entrada único por fornecedor | UNIQUE `(document_type, document_number, supplier_id)` em `inv_entries` ([10-fase1…:276](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L276)) | ✅ |
| **RN03** | Itens controlam lote/série conforme macro | Trigger `fn_inv_items_before_insert` força `controls_lot=true` se consumo, `uses_serial=true` se patrimonial ([30-fase3…:56-67](database/inventory-refactor/30-fase3-relatorios-inventario.sql#L56-L67)); entradas e saídas validam ([10-fase1…:463-465](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L463-L465), [20-fase2…:123-126](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L123-L126)) | ✅ |
| **RN04** | Consumo segue FEFO se lote não informado | `ORDER BY l.expiry_date ASC NULLS LAST LIMIT 1` em `fn_inv_consume` ([20-fase2…:104-120](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L104-L120)) | ✅ |
| **RN05** | Stock nunca pode ficar negativo | CHECK em `inv_stock.quantity >= 0` + validação `IF v_stock_qty < p_qty THEN RAISE` ([20-fase2…:142-145](database/inventory-refactor/20-fase2-saidas-movimentos.sql#L142-L145)); exceção controlada para Admin + force | ✅ |
| **RN06** | Custo do movimento usa CMP atual do item | `cmp_at_moment := v_item.cmp` em todos os movimentos ([20-fase2…:172-178, 257-263, 353-365](database/inventory-refactor/20-fase2-saidas-movimentos.sql)) | ✅ |
| **RN07** | `inv_movements` é imutável (apenas INSERT) | Triggers BEFORE UPDATE e BEFORE DELETE chamam `fn_inv_movements_immutable` que faz `RAISE EXCEPTION` ([10-fase1…:383-396](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L383-L396)) | ✅ |
| **RN08** | Movimentos não podem ter `occurred_at` no futuro | Trigger BEFORE INSERT `fn_inv_check_no_future_dates` com tolerância de 1 min ([10-fase1…:399-411](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L399-L411)) | ✅ |
| **RN09** | Depreciação anual para patrimônio em uso | Função `fn_inv_run_depreciation` ([31-pro-rata-depreciation.sql:19-126](database/inventory-refactor/31-pro-rata-depreciation.sql#L19-L126)) com pro-rata-temporis no ano de aquisição; UNIQUE 1×/ano via `inv_depreciation_runs.year`; pg_cron `inv-annual-depreciation` em 1 jan 04h UTC; UI manual em [depreciation.html](public/inventory/depreciation.html) | ✅ |
| **RN10** | Toda alteração registra usuário + timestamp | Colunas `created_by` / `updated_by` em `inv_items`; trigger `fn_inv_set_updated_at` em 7 tabelas; `user_id` em todo `inv_movements`; `inv_access_log` para histórico de chamadas API | ✅ |

---

## 3 · Funcionalidades Adicionais (além da spec)

Implementadas durante as Sprints 4A/4B/4C para fortalecer a UX e a operação:

| Sprint | Feature | Local |
|---|---|---|
| 4A | UI manual de depreciação anual + badge global de alertas (lote vencendo, stock baixo) | [depreciation.html](public/inventory/depreciation.html), [_layout.js](public/inventory/_layout.js) |
| 4B | Barra de busca global com sugestões; histórico unificado de movimentos | [search.js](api/inventory/search.js), [movements.html](public/inventory/movements.html) |
| 4C | Log de acesso (§14) + janela de consumo configurável por categoria | tabelas/views já citadas acima |
| — | Selects pesquisáveis em todos os dropdowns longos | [_searchable-select.js](public/inventory/_searchable-select.js) |
| — | Modal de visualização (read-only) unificado | helper `showViewModal` em `_layout.js` |
| — | Sidebar retrátil + estado persistente em localStorage | `_layout.js` |
| — | Design system "Areluna Sky" (azulado, Inter, backdrop-blur) | [design.json](design.json) |

---

## 4 · Segurança

### 4.1 — Cobertura de autenticação e permissão

**Todos os 50+ endpoints da API foram auditados.** A matriz completa:

| Camada | Mecanismo | Cobertura |
|---|---|---|
| Autenticação | `authenticateToken` (JWT Supabase) | 100% das rotas API protegidas — incluindo rotas legadas em `api/index.js` (consertadas nesta versão) |
| Permissão granular | `requirePermission('inventory', '<action>')` ou `requireRole([...])` | 100% das rotas `/api/inventory/*` e legadas relevantes |
| Bypass de admin | Roles `admin`/`Admin`/`Inventory_Admin` pulam `requirePermission` ([auth.js:212-215](api/middleware/auth.js#L212-L215)) | Por design — admin é superuser do módulo |
| Defesa em profundidade (DB) | RLS em todas as tabelas `inv_*` exigindo role inventory ou módulo direto ([03-rls-defense-in-depth.sql](database/inventory-refactor/03-rls-defense-in-depth.sql)) | Migração nova nesta versão |

### 4.2 — Correções de segurança aplicadas em v1.0.0

| # | Issue | Severidade | Correção |
|---|---|---|---|
| 1 | `GET /api/inventory/depreciation/runs` sem `requirePermission` | **Alta** | Adicionado `requirePermission('inventory', 'reports')` ([depreciation.js:7](api/inventory/depreciation.js#L7)) |
| 2 | 11 endpoints legados de print/QR em `api/index.js` (`/api/print/*`, `/api/items/:id/generate-qr`, `/api/update-qr-codes`) sem `authenticateToken` nem permissão | **Crítica** | Adicionado `authenticateToken` + `requirePermission` ou `requireRole` em todos os 11 ([api/index.js:1287,1362,1467,1551,1593,1638,1714,1771,1818,1883,1920](api/index.js)) |
| 3 | `print-monitor.html` não enviava `Authorization` | **Alta** (consequência de #2) | Auth guard + monkey-patch de `fetch` injeta Bearer em chamadas `/api/*` ([print-monitor.html:179-194](public/print-monitor.html#L179-L194)) |
| 4 | RLS `USING (true)` em todas as tabelas `inv_*` — combinada com a anon key pública, permitia leitura via Supabase REST direto bypassando o gate da API | **Alta** | Migração [03-rls-defense-in-depth.sql](database/inventory-refactor/03-rls-defense-in-depth.sql) substitui por `USING (fn_inv_user_can_access())`. `inv_access_log` restrito a Admin |
| 5 | `auth.js` registava em log: user.id, email, perfil completo, lista de permissões e stack traces — em qualquer ambiente | **Média** (vazamento de PII em logs) | Logger gated por `NODE_ENV === 'production'` ([auth.js:8-10](api/middleware/auth.js#L8-L10)). `console.error` mantido para erros reais |

### 4.3 — Dados sensíveis: o que está exposto e por quê

| Item | Onde | Status |
|---|---|---|
| `SUPABASE_ANON_KEY` em `public/config.js:8` | Frontend | ✅ **Esperado** — chave anon é pública por design do Supabase. Proteção real agora é a RLS endurecida (item #4 acima) |
| `SUPABASE_SERVICE_ROLE_KEY` em `.env` | Backend | ✅ **Esperado** — server-only; `.env` é gitignored ([.gitignore:42](.gitignore#L42)) e **não está versionado** (`git ls-files` confirma) |
| Strings hardcoded de tokens/senhas | Repo inteiro | ✅ **Nenhuma encontrada** fora do anon key esperado |
| Endpoints debug/dev em produção | — | ✅ **Nenhum**. `POST /api/setup-print-table` agora exige role admin |
| Service-role key em código frontend | `public/` | ✅ **Nunca esteve** — auditoria com grep confirma |
| CORS wide-open com credentials | `api/index.js:188-211` | ⚠️ **Conhecido** — CORS callback aceita qualquer origin com comentário "por enquanto permitir". Documentado para próxima minor (v1.1.0) |

### 4.4 — Conhecidos para próxima minor (v1.1.0)

Não-bloqueantes para 1.0.0 mas planeados:

- **PostgREST filter injection** em `.or()` raw em `items.js:79`, `suppliers.js:20`, `search.js:22-34`, `movements.js:36` — usuário pode passar strings com vírgulas / parênteses e injetar cláusulas extras de filtro. Sanitizar `search` para escapar caracteres especiais.
- **CORS restrito** — aplicar whitelist real em `api/index.js:188-211` em vez de aceitar tudo.
- **Permissão `inventory:delete`** distinta de `inventory:update_item` para soft-deletes.
- **SSE com auth** — `/api/print-status/stream/:jobId` usa EventSource que não permite headers customizados; mover token para query param assinada ou cookie httpOnly.
- **Logger estruturado** em produção (Pino/Winston) substituindo o `log()` simples.

---

## 5 · O que NÃO foi implementado (escopo)

Confirmado fora de escopo no plano aprovado:

- **Refatoração do módulo Prostoral** (kits, OS, materiais). FKs quebradas em `prostoral_kit_items.inventory_item_id` e `prostoral_work_order_materials.inventory_item_id` permanecem para refatoração futura desse módulo.
- **Migração de dados** do estoque antigo para o schema novo. Histórico preservado em tabelas `*_old` com RLS read-only para Admin.
- **Leitor de código de barras físico** (§16 spec marca como "opcional/recomendado"). QR Code via câmera do telemóvel cobre o caso de uso principal.
- **Política de backup automática** — responsabilidade da camada de operações do Supabase.

---

## 6 · Arquivos-chave (cheat sheet)

### Backend
- Router agregador: [api/inventory/index.js](api/inventory/index.js)
- Middleware de auth/permission: [api/middleware/auth.js](api/middleware/auth.js)
- Itens: [api/inventory/items.js](api/inventory/items.js)
- Entradas: [api/inventory/entries.js](api/inventory/entries.js)
- Saídas: [api/inventory/exits.js](api/inventory/exits.js)
- Transferências: [api/inventory/transfers.js](api/inventory/transfers.js)
- Ajustes: [api/inventory/adjustments.js](api/inventory/adjustments.js)
- Sessões de inventário: [api/inventory/inventory-sessions.js](api/inventory/inventory-sessions.js)
- Relatórios: [api/inventory/reports.js](api/inventory/reports.js)
- Depreciação: [api/inventory/depreciation.js](api/inventory/depreciation.js)
- Log de acesso: [api/inventory/access-log.js](api/inventory/access-log.js)

### DB
- Backup do legado: [00-backup-old.sql](database/inventory-refactor/00-backup-old.sql)
- Roles + permissions: [01-roles-permissions.sql](database/inventory-refactor/01-roles-permissions.sql)
- Fix Operador adjust: [02-fix-operador-adjust.sql](database/inventory-refactor/02-fix-operador-adjust.sql)
- Defense-in-depth RLS: [03-rls-defense-in-depth.sql](database/inventory-refactor/03-rls-defense-in-depth.sql)
- Fase 1 (cadastros + entradas): [10-fase1-cadastros-entradas.sql](database/inventory-refactor/10-fase1-cadastros-entradas.sql)
- Fase 2 (saídas + transferências + ajustes): [20-fase2-saidas-movimentos.sql](database/inventory-refactor/20-fase2-saidas-movimentos.sql)
- Fase 3 (relatórios + inventário físico): [30-fase3-relatorios-inventario.sql](database/inventory-refactor/30-fase3-relatorios-inventario.sql)
- Depreciação pro-rata: [31-pro-rata-depreciation.sql](database/inventory-refactor/31-pro-rata-depreciation.sql) + [32-fix-depreciation-quantity.sql](database/inventory-refactor/32-fix-depreciation-quantity.sql)
- Sprint 4C (log + janela): [40-sprint4c-log-window.sql](database/inventory-refactor/40-sprint4c-log-window.sql), [41-fix-views-cascade.sql](database/inventory-refactor/41-fix-views-cascade.sql), [42-finalize-sprint4c.sql](database/inventory-refactor/42-finalize-sprint4c.sql)

### UI
- Shell compartilhado: [public/inventory/_layout.js](public/inventory/_layout.js)
- Dashboard: [index.html](public/inventory/index.html)
- 20+ telas operacionais sob `public/inventory/`

---

## 7 · Como aplicar esta versão em produção

```sh
# 1. Aplicar migrações no Supabase SQL Editor, em ordem numérica:
#    00 → 01 → 02 → 03 → 10 → 20 → 30 → 31 → 32 → 40 → 41 → 42

# 2. Confirmar que pg_cron está habilitado (necessário para depreciação anual + refresh de MVs)

# 3. Variáveis de ambiente (.env do servidor)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
NODE_ENV=production          # ← ativa o logger silencioso de auth.js

# 4. Restart do processo Node
npm start
```

**Validação pós-deploy**:
- Logar como `Inventory_Operador` → tentar editar `cmp` → 403 esperado
- Logar como `Inventory_Consulta` → tentar entrada → 403 esperado
- Logar como `Inventory_Admin` → executar depreciação para o ano atual → sucesso
- Tentar `UPDATE inv_movements ...` direto no SQL → erro RN07
- Tentar SELECT em `inv_items` via Supabase REST com anon key + JWT de usuário sem role inventory → 0 rows (RLS reforçado)
