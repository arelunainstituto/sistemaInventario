# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento [SemVer](https://semver.org/lang/pt-BR/).

## Política de versionamento

| Tipo | Quando incrementar | Exemplo |
|---|---|---|
| **MAJOR** (`X.0.0`) | Mudanças incompatíveis com versões anteriores (breaking changes na API, na estrutura do DB que exija migração de dados manual, remoção de funcionalidade pública) | `1.0.0 → 2.0.0` |
| **MINOR** (`x.Y.0`) | Adição de funcionalidades mantendo compatibilidade. Novas tabelas, endpoints, telas, regras de negócio adicionais | `1.0.0 → 1.1.0` |
| **PATCH** (`x.y.Z`) | Correções de bugs, ajustes de segurança não-quebra, melhorias internas, ajustes de UX sem nova feature | `1.0.0 → 1.0.1` |
| **BETA** | Versões em validação antes do release stable. Sufixo `-beta.N`, podem conter breaking changes entre betas | `1.1.0-beta.1`, `1.1.0-beta.2` |
| **PRE-RELEASE** | Outros tipos: `-alpha.N`, `-rc.N` (release candidate) | `2.0.0-rc.1` |

### Categorias por entrada

- **Adicionado** — funcionalidades novas
- **Alterado** — mudanças em funcionalidades existentes
- **Depreciado** — funcionalidades marcadas para remoção em versão futura
- **Removido** — funcionalidades retiradas
- **Corrigido** — correções de bugs
- **Segurança** — correções de vulnerabilidades e endurecimento

### Convenções

- Toda entrada deve referenciar arquivos com link relativo (`[file.js:42](path/to/file.js#L42)`).
- Toda entrada de DB deve indicar se requer migração manual (`requer migração`).
- Toda entrada de segurança deve indicar severidade (`Crítica/Alta/Média/Baixa`).
- Versões beta vivem na seção `[Unreleased]` até estabilizarem.

---

## [Unreleased]

### Adicionado
- **Fase 4.2 — Views e MV por localização + min efetivo em fn_inv_consume**: nova migração [51-fase4-views-by-location.sql](database/inventory-refactor/51-fase4-views-by-location.sql) (**requer migração**):
  - 5 views novas: `vw_inv_total_stock_by_location`, `vw_inv_avg_daily_consumption_by_location`, `vw_inv_reorder_status_by_location`, `vw_inv_stock_coverage_by_location`, `vw_inv_kardex_by_location` — todas leem parâmetros via `vw_inv_item_effective_params`.
  - `mvw_inv_consumption_trend_by_location` (16 meses, refresh diário via pg_cron `inv-refresh-mviews-daily` — comando atualizado para incluir a nova MV).
  - `fn_inv_consume` agora lê `min_stock` efetivo da localização (override > item global > 0). Única mudança de comportamento: saídas no Cristal disparam `LOW_STOCK_CONFIRMATION_REQUIRED` baseado no mínimo do Cristal, não no mínimo global.
  - Views agregadas existentes (`vw_inv_reorder_status`, `vw_inv_stock_coverage`, `vw_inv_kardex`, etc.) **permanecem inalteradas** para retro-compatibilidade — endpoints atuais continuam servindo agregados.
- **Fase 4.1 — Parâmetros de stock por localização (schema)**: nova migração [50-fase4-item-location-params.sql](database/inventory-refactor/50-fase4-item-location-params.sql) (**requer migração**) cria:
  - Tabela `inv_item_location_params(item_id, location_id, min_stock, max_stock, lead_time_days, reorder_point, consumption_window_days, auto_calculated, last_calculated_at, notes, audit)` com UNIQUE parcial em (item, location) e CHECK max≥min.
  - Trigger `fn_inv_ilp_check_macro` que rejeita overrides para itens patrimoniais.
  - RLS endurecida via `fn_inv_user_can_access()` (compartilhada com a migração 03).
  - View `vw_inv_item_effective_params` com resolução por COALESCE — `location_override → item_global → category_default`. Devolve também `source_<campo>` indicando a origem de cada valor para auditoria.
  - **Aditiva pura**: sistema continua usando `inv_items.*` (sem mudança de comportamento). As fases 4.2-4.4 farão views/funções/API/UI passarem a ler dessa nova camada.

### Corrigido
- **Entradas**: fator de conversão agora vem do cadastro do item (read-only) em vez de digitação manual — alinha com §7 da spec (conversão automática). ([entries.html](public/inventory/entries.html))
- **Kardex**: coluna "Localização" mostra origem em saídas e destino em entradas; bug fazia transferências aparecerem com origem nos dois lados. ([reports.js:155-192](api/inventory/reports.js#L155-L192))

### Alterado
- **Módulo legado removido do dashboard**: nova migração [04-deactivate-old-inventory-module.sql](database/inventory-refactor/04-deactivate-old-inventory-module.sql) (**requer migração**) migra `role_module_access` / `user_module_access` do módulo antigo (`code='inventory'`, route `/inventory.html`) para o novo (`code='INVENTORY'`, route `/inventory/index.html`) e desativa o antigo. Dashboard passa a mostrar apenas o módulo refatorado.

---

## [1.0.0] — 2026-05-30

> **Marco**: primeira versão stable do módulo Inventário refatorado segundo a especificação Instituto Areluna v1.0 (25-mai-2026). Substitui o módulo legado fragmentado (`items`, `produtoslaboratorio`, `prostoral_*`) por estrutura única `inv_*` com 3 fases entregues + 4 sprints incrementais.
>
> Ver [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) para mapeamento feature × spec completo.

### Adicionado

#### Estrutura de dados (16 tabelas novas)
- `inv_units`, `inv_locations` — hierarquia Unidade → Sublocalização com flags `can_receive` / `can_send` para validar transferências. ([10-fase1-cadastros-entradas.sql:40-67](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L40-L67))
- `inv_categories` — subcategorias livres com `parent_macro` ('consumo'/'patrimonial'). Seed inicial de 17 subcategorias.
- `inv_units_of_measure` — 15 UoMs seed.
- `inv_suppliers` — fornecedores com NIF.
- `inv_items` — cadastro unificado com macro_category, controls_lot/uses_serial automáticos, CMP, parâmetros de stock, dados patrimoniais condicionais. ([10-fase1…:117-176](database/inventory-refactor/10-fase1-cadastros-entradas.sql#L117-L176))
- `inv_lots` — lotes ativos por item, com `expiry_date` e `serial_number`.
- `inv_stock` — saldo por (item, localização, lote) com CHECK quantity ≥ 0.
- `inv_movements` — histórico imutável de TODOS os movimentos (RN07 enforce via trigger).
- `inv_entries` + `inv_entry_lines` — recepção fiscal com UNIQUE(doc_type, doc_number, supplier_id) (RN02).
- `inv_adjustment_reasons` — 5 motivos seed para ajustes manuais.
- `inv_inventory_sessions` + `inv_inventory_counts` — wizard de contagem física com snapshot de expected_qty.
- `inv_depreciation_runs` — controle anual de depreciação (UNIQUE em `year`).
- `inv_system_settings` + `inv_access_log` — configurações e auditoria.

#### Regras de negócio (RN01-RN10) — 10/10 cobertas
- **RN01** — UoM base obrigatória (NOT NULL + FK).
- **RN02** — documento de entrada único por fornecedor (UNIQUE composto).
- **RN03** — auto-flag de controls_lot/uses_serial por macro_category, com validação em entradas e saídas.
- **RN04** — consumo FEFO automático (`ORDER BY expiry_date ASC NULLS LAST`) em `fn_inv_consume`.
- **RN05** — stock não-negativo via CHECK + validação na função; exceção controlada para Admin com flag explícita.
- **RN06** — `cmp_at_moment` gravado em todo movimento usando CMP atual do item.
- **RN07** — `inv_movements` imutável via trigger BEFORE UPDATE/DELETE que faz RAISE EXCEPTION.
- **RN08** — bloqueio de `occurred_at` futuro com tolerância de 1 minuto.
- **RN09** — depreciação anual pro-rata-temporis no ano de aquisição; cron `inv-annual-depreciation` em 1 jan 04h UTC; UNIQUE 1×/ano. ([31-pro-rata-depreciation.sql](database/inventory-refactor/31-pro-rata-depreciation.sql))
- **RN10** — `created_by` / `updated_by` em tabelas-chave + `inv_movements.user_id` + `inv_access_log` para histórico API.

#### Perfis e permissões (§RF10)
- 4 roles seed: `Inventory_Admin`, `Inventory_Operador`, `Inventory_Consulta`, `Inventory_Contabilidade` ([01-roles-permissions.sql:41-55](database/inventory-refactor/01-roles-permissions.sql#L41-L55))
- 10 permissões granulares: `inventory:{read, create_item, update_item, entry, exit, transfer, adjust, inventory_session, reports, financial}`
- Matriz role × permission seed ([01-…:106-134](database/inventory-refactor/01-roles-permissions.sql#L106-L134))

#### API (23 arquivos de rota em `api/inventory/`)
- CRUDs: `units`, `locations`, `categories`, `suppliers`, `uoms`, `items`, `adjustment-reasons`
- Operações: `entries`, `exits`, `transfers`, `adjustments`, `inventory-sessions`, `depreciation`
- Consultas: `scan`, `search`, `stats`, `movements`, `access-log`, `reports` (8 relatórios, 4 formatos: JSON/CSV/XLSX/PDF)
- Todos com `authenticateToken` (router-level) + `requirePermission` ou `requireRole`

#### UI (21 telas em `public/inventory/`)
- Dashboard com KPIs e cards de alerta global ([index.html](public/inventory/index.html))
- Cadastros: items (form duplo Consumo/Patrimonial), locations, categories, suppliers, uoms
- Operações: entries, exits, transfers, adjustments, inventory-session, depreciation
- Consultas: movements (timeline unificada), kardex, reports, access-log, scan (câmera de telemóvel), item-label (etiqueta imprimível)
- Shell compartilhado retrátil com badge global de alertas e busca ⌘K ([_layout.js](public/inventory/_layout.js))
- Selects pesquisáveis para listas longas ([_searchable-select.js](public/inventory/_searchable-select.js))
- Design system "Areluna Sky" — paleta azulada, Inter, backdrop-blur ([design.json](design.json))

#### QR Code (§13)
- Geração automática (UUID v4 default em `inv_items.qr_code`)
- Endpoint `GET /api/inventory/items/:id/qr` devolve data URL base64 (resolve conflito com middleware de compressão)
- Etiqueta imprimível ([item-label.html](public/inventory/item-label.html))
- Leitor via câmera ([scan.html](public/inventory/scan.html)) + endpoint resolvedor `/api/inventory/scan/:qrCode`

#### Indicadores e relatórios (§11-12)
- 7 views + 2 materialized views (refresh diário 03h UTC via pg_cron):
  - `vw_inv_avg_daily_consumption` (janela configurável 30/60/90/180/365 dias por categoria)
  - `vw_inv_reorder_status`, `vw_inv_stock_coverage`, `vw_inv_total_stock`, `vw_inv_valuation`, `vw_inv_kardex`, `vw_inv_patrimony_locations`
  - `mvw_inv_consumption_trend` (16 meses), `mvw_inv_user_activity` (12 meses)

#### Auditoria (§14)
- Middleware automático `_access-log.js` registra method, path, entity_type, entity_id, status_code, duration_ms.
- Retenção configurável (default 24 meses) via `inv_system_settings.access_log_retention_months`.
- Purga mensal automatizada via pg_cron `inv-purge-access-log-monthly`.
- UI consultável apenas por Admin com filtros + ação "Apagar tudo" (confirmação textual `APAGAR TUDO`).
- Whitelist de paths registráveis para evitar ruído (polled GETs ignorados).

#### Documentação
- [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) — mapeamento completo feature × spec, com referências a arquivos e linhas.
- Este [CHANGELOG.md](CHANGELOG.md).

### Segurança
- **Crítica** — `GET /api/inventory/depreciation/runs` agora exige `requirePermission('inventory', 'reports')` (antes acessível a qualquer usuário autenticado). ([depreciation.js:7](api/inventory/depreciation.js#L7))
- **Crítica** — 11 endpoints legados em [api/index.js](api/index.js) (`/api/print/*`, `/api/items/:id/generate-qr`, `/api/update-qr-codes`, `/api/setup-print-table`) agora exigem `authenticateToken` + `requirePermission` ou `requireRole`. Antes podiam ser invocados sem autenticação.
- **Alta** — RLS de defesa em profundidade ([03-rls-defense-in-depth.sql](database/inventory-refactor/03-rls-defense-in-depth.sql), **requer migração**): substitui `USING (true)` por `USING (fn_inv_user_can_access())` em todas as tabelas `inv_*`. `inv_access_log` restrito ainda mais (apenas Inventory_Admin/Admin). Fecha o vetor de leitura via Supabase REST direto com anon key.
- **Média** — `auth.js` agora silencia logs verbosos em produção (`NODE_ENV=production`). Antes registava user.id, email, permissões e stack traces — vazamento de PII em logs. `console.error` mantido para erros reais. ([auth.js:8-10](api/middleware/auth.js#L8-L10))
- **Média** — `print-monitor.html` agora envia `Authorization` header em todas as chamadas `/api/*` via monkey-patch de `fetch` ([print-monitor.html:179-194](public/print-monitor.html#L179-L194)). Necessário após o reforço dos endpoints de impressão.
- **Média** — `inventory:adjust` adicionado ao role `Inventory_Operador` para alinhar com §RF06 (operador pode ajustar ≤ 5%, acima requer Admin). ([02-fix-operador-adjust.sql](database/inventory-refactor/02-fix-operador-adjust.sql))

### Conhecido (planeado para v1.1.0)
- PostgREST filter injection em `.or()` raw com strings de usuário não-escapadas — sanitizar `search`/`location_id` em `items.js:79`, `suppliers.js:20`, `search.js:22-34`, `movements.js:36`.
- CORS aceita qualquer origin com `credentials:true` em `api/index.js:188-211` — aplicar whitelist real.
- Permissão `inventory:delete` distinta de `inventory:update_item` para soft-deletes.
- EventSource `/api/print-status/stream/:jobId` rejeitará 401 até refatorar para token via query/cookie (SSE não permite headers customizados).
- Logger estruturado (Pino/Winston) substituindo o `log()` simples de `auth.js`.

### Fora de escopo (mantido propositalmente)
- Refatoração do módulo Prostoral (kits, OS). FKs quebradas em `prostoral_*` permanecem.
- Migração dos dados do estoque antigo — histórico em `*_old` (read-only).
- Leitor de código de barras físico (QR via câmera cobre o caso de uso).
- Backup automatizado (camada de operações do Supabase).

---

## Histórico pré-1.0.0 (referência)

Mudanças anteriores a esta versão não seguiam SemVer formal. Os commits relevantes do refactor estão preservados no histórico git:

```
c1cd09f feat(inventory): refatora módulo completo conforme spec IAL Portugal v1.0   (Fase 1)
cb665c8 feat(inventory): Fase 2 - saídas, transferências e ajustes manuais
d11687c feat(inventory): Fase 3 - inventário físico, indicadores, relatórios e SKU
a2a5b44 feat(inventory): Sprint 4A - UI depreciação manual + badge global de alertas
0c31df4 feat(inventory): Sprint 4B - busca global e histórico unificado
f29115a feat(inventory): Sprint 4C - log de acesso + janela de consumo por categoria
24b821f feat(inventory ui): apply Meditech-inspired design system + UX fixes
258ef70 fix(inventory): grant inventory:adjust to Inventory_Operador (RF06)
```

A partir de 1.0.0, toda alteração deve adicionar uma entrada acima na seção `[Unreleased]` antes do merge.

[Unreleased]: https://github.com/<org>/sistemaInventario/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/<org>/sistemaInventario/releases/tag/v1.0.0
