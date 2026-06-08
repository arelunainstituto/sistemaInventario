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

_Nenhuma alteração pendente._

---

## [1.8.1] — 2026-06-08

> **Patch UX**: editor de posts ganha campo de data de publicação selecionável (default hoje), permitindo antedatar artigos.

### Adicionado
- **Campo "Data de publicação"** no modal de edição ([marketing.html](public/marketing.html), [marketing-blog.js](public/marketing-blog.js)):
  - `<input type="date">` com `max` = hoje (impede futuro a nível de UI).
  - Default = hoje em criação; valor atual do post em edição.
  - Hint inline explicando que pode antedatar.

### Alterado
- **POST/PUT `/api/marketing/posts`** ([posts.js](api/marketing/posts.js)):
  - Aceita `published_at` no body (ISO date ou `YYYY-MM-DD`).
  - String `YYYY-MM-DD` é interpretada como meio-dia UTC (evita drift por fuso).
  - Valida não-futuro server-side → 400 com mensagem clara.
  - Prioridade: data enviada pelo admin > NOW se mudou para `status='published'` > preserva existente.
- [_layout.js:5](public/inventory/_layout.js#L5) bump para `v1.8.1`.

---

## [1.8.0] — 2026-06-08

> **Marco**: editor de posts ganha 3 features para autoria de qualidade — recorte da imagem de capa (Cropper.js), galeria de imagens por post para uso em `<figure>` no content, e seletor de posts relacionados ("Leia também") com fallback automático para os mais recentes.

### Adicionado
- **Recorte (crop) da imagem de capa** ([marketing.html](public/marketing.html), [marketing-blog.js](public/marketing-blog.js)):
  - Cropper.js via CDN (cropper@1.6.1).
  - Quando o usuário escolhe um arquivo, abre modal de crop com 16:9 (proporção do hero) por padrão. Botões de proporção 4:3, 1:1 e Livre.
  - Botão "Recortar" no hover do preview para re-cropar uma imagem já carregada.
  - O blob recortado vira o arquivo enviado no submit via DataTransfer — backend não muda.
- **Galeria de imagens por post** — nova tabela [marketing_post_images](database/migrations/20260608_marketing_gallery_related.sql) com CASCADE no delete do post:
  - Endpoints REST em [api/marketing/post-images.js](api/marketing/post-images.js): GET/POST/PUT/DELETE com `requireRole(['Marketing','Admin','admin','employee'])`.
  - RLS pública SELECT só para posts publicados; write apenas para Marketing/Admin.
  - UI no modal: grid de thumbnails com inputs de alt e caption por imagem.
  - Botão **"Inserir"** automaticamente entra no Modo HTML e insere `<figure><img>...<figcaption></figcaption></figure>` na posição do cursor do textarea — evita Quill estripar `<figure>`.
- **Posts relacionados (Leia também)** — nova coluna `marketing_posts.related_post_ids UUID[]`:
  - Seletor multi-checkbox no modal admin com busca em tempo real.
  - Quando vazio, frontend público recebe automaticamente os 3 posts mais recentes (excluindo o próprio).
  - `GET /api/public/marketing/posts/:idOrSlug` retorna `related_posts` resolvido preservando a ordem do array.
- **Galeria no detail público** — mesma chamada retorna `gallery: [{...}]` com as imagens da galeria.

### Alterado
- **`POST/PUT /api/marketing/posts`** ([posts.js](api/marketing/posts.js)) aceitam `related_post_ids` (array UUID ou string JSON via FormData).
- [_layout.js:5](public/inventory/_layout.js#L5) bump para `v1.8.0`.

### Notas de aplicação
1. Aplicar [20260608_marketing_gallery_related.sql](database/migrations/20260608_marketing_gallery_related.sql) (uma vez).
2. Deploy do código v1.8.0.
3. Editar cada post: re-recortar capa, subir imagens na galeria, clicar "Inserir" para colocá-las em `<figure>`, selecionar posts relacionados.

---

## [1.7.3] — 2026-06-08

> **Hotfix UX**: categorias não apareciam no dropdown do cadastro de item de Consumo.

### Corrigido
- **Item form** ([item-form.html:277-285](public/inventory/item-form.html#L277-L285)) — filtro `categoriesAll.filter(c => c.parent_macro === macro)` era case-sensitive. Se alguma linha tivesse `parent_macro = 'Consumo'` ou `'CONSUMO'` (regression possível com seeds/imports), o filtro retornava vazio. Agora lowercase nas duas pontas + tolerância a null.

---

## [1.7.2] — 2026-06-08

> **Hotfix**: cadastro de item falhava com "base_uom_id é obrigatório" mesmo com UM de compra preenchida na UI.

### Corrigido
- **POST `/api/inventory/items`** ([items.js:137](api/inventory/items.js#L137)) — desde a Fase 5.2, a UI só pede `purchase_uom_id` e o backend espelha em `base_uom_id`. Mas o espelhamento estava ocorrendo **depois** da validação `validateItemPayload`, então a validação reclamava do campo vazio antes do fallback rodar. Movido o espelhamento para o início do handler, antes da validação.
- PUT não era afetado (o validator pula required-checks em update mode).

### Notas
- [_layout.js:5](public/inventory/_layout.js#L5) bump para `v1.7.2`.

---

## [1.7.1] — 2026-06-08

> **Fix UX**: o flag `allow_negative_stock` (toggle DB do seeding) destravava o backend mas a UI continuava bloqueando a saída antes mesmo de chegar ao servidor — o dropdown "Localização de origem" só listava locais com stock positivo. Quando o item tinha zero stock, dropdown ficava vazio e o navegador travava no required.

### Adicionado
- **Endpoint `GET /api/inventory/settings/feature-flags`** ([settings.js](api/inventory/settings.js)) — retorna `{ allow_negative_stock: bool }`. Read-only, exige apenas `inventory:read`. Padrão de extensão pronta para outros flags no futuro.
- **Banner global "Modo seeding ativo"** no topo do módulo Inventário ([_layout.js](public/inventory/_layout.js)) quando `allow_negative_stock = true`. Lembra o operador/admin de desligar o flag quando terminar.

### Alterado
- **`GET /api/inventory/exits/stock-by-item/:itemId`** ([exits.js:23-58](api/inventory/exits.js#L23-L58)):
  - Quando o item não tem stock em parte alguma E `allow_negative_stock = true` → retorna localizações ativas sintéticas (quantity=0) + `seeding_mode: true` no body, permitindo que a UI ofereça opções de destino para a saída em negativo.
  - Sem o flag, comportamento idêntico ao anterior (retorna array vazio).
- **`exits.html` → `onItemChange`** — quando `seeding_mode` é true, mostra um aviso âmbar ("**Modo seeding:** sem stock atual…") em vez do erro vermelho "Sem stock disponível", e popula o dropdown de localização normalmente.
- O endpoint `stock-by-item` é usado também pelas telas de Transferências e Ajustes — todas se beneficiam automaticamente do fallback.
- [_layout.js:5](public/inventory/_layout.js#L5) bump para `v1.7.1`.

### Notas
- Mesmo com a UI desbloqueada, a regra de RN03 (item que controla lote exige lote informado) continua valendo. Itens lote-controlados com stock zero não podem ser lançados em negativo via este fluxo — precisam de uma entrada/criação de lote primeiro.

---

## [1.7.0] — 2026-06-08

> **Marco**: corrige 4 bugs do fluxo de criação de usuários (módulo RH) que faziam "acesso liberado, mas API responde 403". O principal era um case mismatch entre `permissions.module_name` (`'INVENTORY'`) e o que as rotas verificavam (`'inventory:read'`), que silenciosamente bloqueava todos os usuários com roles `Inventory_*`. O modal de RH passa também a expor um dropdown para escolher a role inventária na hora do cadastro.

### Corrigido
- **Case mismatch nas permissões do Inventário** ([90-normalize-permission-names.sql](database/inventory-refactor/90-normalize-permission-names.sql), [01-roles-permissions.sql:65-77](database/inventory-refactor/01-roles-permissions.sql#L65-L77)):
  - `permissions.module_name` passa de `'INVENTORY'` para `'inventory'`.
  - `permissions.action` passa do verbo curto (`'create'`) para o sufixo completo do nome (`'create_item'`), de modo que `module_name || ':' || action === name`.
  - Resultado: `auth.js:128` agora constrói exatamente a mesma string que as rotas verificam (`requirePermission('inventory', 'create_item')`).
- **Lockout silencioso por `tenant_id` NULL** ([employees.js:78-122](api/rh/employees.js#L78-L122)): `ensureAuthUserAndProfile()` passa a retornar `{ userId, tenantId, error }` e os callers (POST/PUT) **falham com 400 explícito** se o profile não foi criado. Antes, o usuário era criado em `auth.users` mas ficava trancado no primeiro login (`auth.js:48-50` retorna 403 "Perfil de usuário não encontrado").
- **Propagação de erros das atribuições de role** ([employees.js](api/rh/employees.js)): inserts em `user_roles` e `user_module_access` agora têm erros checados e propagados via campo `warnings` no response. O modal exibe esses avisos via alert. Antes, falhas silenciosas devolviam 201 mas o usuário ficava com permissões incompletas.

### Adicionado
- **Helper `assignInventoryRole(userId, roleName, tenantId)`** ([employees.js:135-184](api/rh/employees.js#L135-L184)): centraliza a lógica de aplicar/trocar/remover role inventária. Garante invariante: no máximo 1 role `Inventory_*` por usuário.
- **Dropdown "Role no Inventário" no modal de RH** ([rh-employees.js:474-501](public/rh-employees.js#L474-L501)) — Access tab. Opções:
  - _Sem acesso operacional_ (default — apenas leitura via módulo)
  - Consulta — leitura + relatórios
  - Contabilidade — leitura + relatórios + financeiro
  - Operador — lançamentos (entrada/saída/transferência/contagem)
  - Admin do Inventário — controle total
- **GET `/api/rh/employees/:id`** passa a retornar `inventory_role` (nome da role atual ou `null`), permitindo prefill no modal de edição.
- **Field `warnings` no response** de POST e PUT de funcionário, surfaceando falhas não-bloqueantes (módulo não atribuído, role não inserida, cliente não vinculado).
- [_layout.js:5](public/inventory/_layout.js#L5) bump para `v1.7.0`.

### Notas de aplicação
**Pré-requisito antes do deploy do código v1.7.0**: aplicar [90-normalize-permission-names.sql](database/inventory-refactor/90-normalize-permission-names.sql) no Supabase SQL Editor. Sem ela, **toda role `Inventory_*` continua não funcionando** (o código novo não muda o comportamento da auth — só passa a usar as permissões corrigidas).

Ordem completa:
1. Aplicar `90-normalize-permission-names.sql` (uma vez).
2. Deploy do código v1.7.0.
3. Re-editar funcionários do Inventário no modal de RH para atribuir a role correta no novo dropdown.

### Notas de compatibilidade
- Usuários que já estão no sistema e tinham roles `Inventory_*` atribuídas **manualmente via SQL** passam a ter as permissões funcionando automaticamente após o passo (1).
- Roles HR (`rh_manager`, `employee`) e Admin não foram afetadas — usam `module_name='HR'` que já era consistente com as rotas.
- A coluna `permissions.action` mudou de "verbo curto" para "sufixo completo" para o módulo inventário. Outros módulos (HR, etc.) ficam intactos.

---

## [1.6.1] — 2026-06-05

> **Hotfix**: importador retornava 500 ao final do `/execute` apesar dos itens terem sido inseridos com sucesso. Causa: `supabaseAdmin.rpc()` retorna um builder thenable (não uma Promise), então `.catch()` jogado direto na chamada lançava `TypeError`. Substituído por `try/await` + verificação de `{ error }`.

### Corrigido
- **Importador** ([import.js:489](api/inventory/import.js#L489)) — `fn_inv_set_code_sequences` agora é chamado dentro de `try { ... }` com `await` e checagem do campo `error` no resultado. Falhas continuam sendo apenas logadas (não crítico para o import).

### Notas operacionais — imports já feitos com v1.6.0
Se você importou antes deste patch, a sequence `seq_inv_code_consumo` provavelmente NÃO foi avançada (a falha aconteceu antes desse passo). Para evitar que o próximo cadastro manual colida com IDs `1000XXX` já importados, rode uma vez no SQL Editor:
```sql
SELECT fn_inv_set_code_sequences(
  (SELECT COALESCE(MAX(SUBSTRING(internal_code FROM 2)::INTEGER), 0)
     FROM inv_items
    WHERE macro_category = 'consumo'
      AND internal_code ~ '^1\d{6}$'),
  NULL
);
```

[_layout.js:5](public/inventory/_layout.js#L5) bump para `v1.6.1`.

---

## [1.6.0] — 2026-06-05

> **Marco**: itens passam a ter um **Fornecedor padrão** opcional (FK para `inv_suppliers`). Importador vincula automaticamente quando o Nome Fantasia do produto tem match único na aba de fornecedores; nos casos ambíguos (mesmo Nome Fantasia, NIFs diferentes — caso AMAZON) ou ausentes (Nome Fantasia com typo — caso INIBSA), deixa em branco para vinculação manual posterior. Decisão consolidada com a equipe de regras: a chave de identidade do fornecedor é o NIF; vínculos sem certeza ficam pendentes.

### Adicionado
- Nova migração [80-items-default-supplier.sql](database/inventory-refactor/80-items-default-supplier.sql) (**requer migração manual**):
  - `inv_items.default_supplier_id UUID` (FK opcional → `inv_suppliers.id`)
  - Índice parcial `idx_inv_items_default_supplier` (apenas quando preenchido)
- **Campo "Fornecedor padrão"** no formulário de item ([item-form.html](public/inventory/item-form.html)):
  - Dropdown ordenado alfabeticamente, exibindo `Nome · NIF` em cada opção
  - Opcional — opção padrão "— sem fornecedor padrão —"
  - Sugestão para entradas futuras; cada entrada continua podendo usar fornecedor diferente.
- Exibição "Fornecedor padrão" em [item-view.html](public/inventory/item-view.html), no cartão de Identificação.
- **Card no preview do importador** mostra "Vínculo item→fornecedor: X de Y" para o operador ter visibilidade antes de confirmar.
- Resumo final do importador agora mostra quantos itens foram vinculados e quantos ficaram sem fornecedor para vinculação manual.

### Alterado
- **Importador** ([import.js](api/inventory/import.js)):
  - Vínculo automático produto → fornecedor por **NIF** (lookup pelo Nome Fantasia que retorna NIF único).
  - **Warnings removidos**: "Fornecedor X não está em Cadastro de Fornecedores" e "Nome Fantasia ambíguo" — esses casos agora são silenciosos e tratados como "sem vínculo, vincular manualmente".
  - API select de items inclui `default_supplier:inv_suppliers(id, name, tax_id)` ([items.js:21-27](api/inventory/items.js#L21-L27)).
- [_layout.js:5](public/inventory/_layout.js#L5) bump para `v1.6.0`.

### Notas de aplicação
1. Aplicar [80-items-default-supplier.sql](database/inventory-refactor/80-items-default-supplier.sql) **antes** do próximo import (uma vez).
2. Importar a planilha v1.2 — vínculos automáticos por Nome Fantasia único acontecerão na hora.
3. Itens sem vínculo automático (AMAZON ambíguo, INIBSA não-encontrado, etc.) podem ser editados em **Itens → ⋯ → Editar** para selecionar o fornecedor correto no dropdown.

### Notas de compatibilidade
- Itens existentes têm `default_supplier_id = NULL` por padrão. Nenhuma migração de dados é feita.
- Entradas (`inv_entries.supplier_id`) continuam funcionando independente do `default_supplier_id` do item.

---

## [1.5.1] — 2026-06-05

> **Patch**: endurece a regra de ID do produto no importador. O ID da planilha É o `internal_code` — não há mais caminho lateral com geração por trigger. IDs fora do padrão `^[12]\d{6}$` bloqueiam o import (erro), forçando o operador a corrigir a planilha. Garante que dedup por ID funciona sempre.

### Alterado
- **Importador** ([import.js](api/inventory/import.js)):
  - Removido o caminho condicional `internal_code = null`. Itens válidos sempre carregam o ID da planilha como `internal_code`.
  - ID fora do padrão `^[12]\d{6}$` vira **erro bloqueante** com mensagem "corrija a linha na planilha" (antes era warning silencioso que deixava o trigger gerar um código novo — risco de duplicação em re-imports).
- **Importador UI** ([import.html](public/inventory/import.html)) — banner reflete a regra estrita.
- [_layout.js:5](public/inventory/_layout.js#L5) bump para `v1.5.1`.

### Motivação
Time confirmou que dedup de produto é pelo **ID interno** (1000001, etc.) — o ID da planilha **é** o internal_code, não um identificador separado. A versão anterior gerava codigos novos para IDs não conformes, o que silenciosamente quebrava a dedup em segundas execuções.

---

## [1.5.0] — 2026-06-05

> **Marco**: importador passa a consumir a aba dedicada **Cadastro de Fornecedores** da planilha v1.2 com chave de deduplicação por **NIF/NIPC**. Cadastro de produtos passa a deduplicar pelo **ID** da planilha (preservado quando segue o padrão `1XXXXXX`/`2XXXXXX`). Schema de `inv_suppliers` ganha campos fiscais e comerciais (Razão Social, IBAN, CAE/CIRS, Regime de IVA, vendedor, etc.).

### Adicionado
- Nova migração [70-suppliers-extended-fields.sql](database/inventory-refactor/70-suppliers-extended-fields.sql) (**requer migração manual**):
  - `inv_suppliers.entity_type` — Pessoa Singular / Pessoa Coletiva
  - `inv_suppliers.legal_name` — Razão Social
  - `inv_suppliers.cae_code` — CIRS (PS) ou CAE (PC)
  - `inv_suppliers.website`, `sales_rep_name`, `sales_rep_phone`, `iban`, `vat_regime`
  - Índice `idx_inv_suppliers_legal_name`
  - O índice `uq_inv_suppliers_tax` (UNIQUE em `tax_id` WHERE NOT NULL) — herdado da fase 1 — passa a ser a chave de dedup oficial para o importador.
- [_layout.js:5](public/inventory/_layout.js#L5) bump `INVENTORY_VERSION` para `v1.5.0`.

### Alterado
- **Importador XLSX** ([import.js](api/inventory/import.js)) — refatorado para v1.2 da planilha:
  - Parse da nova aba `Cadastro de Fornecedores` com 14 colunas (todos os campos fiscais).
  - Deduplicação de fornecedores por NIF/NIPC (`tax_id`), tanto dentro do arquivo quanto contra o DB.
  - Insert em batches de 100 com `INSERT ... ON CONFLICT` via filtragem prévia por NIF.
  - **ID do produto agora é preservado** como `internal_code` quando segue o padrão `^[12]\d{6}$`. IDs fora do padrão geram warning e recebem código novo do trigger.
  - Após inserir produtos, a sequence `seq_inv_code_consumo` é avançada para `max(id)` via `fn_inv_set_code_sequences(p_consumo, NULL)` — evita colisão futura com cadastros manuais.
  - Avisos novos: NIF duplicado na planilha (bloqueia o cadastro), Nome Fantasia ambíguo (referenciado por produtos mas com múltiplos cadastros), Fornecedor referenciado mas ausente da aba dedicada.
  - Resposta inclui `created_suppliers`, `skipped_suppliers`, `next_consumo_code`.
- **Importador UI** ([import.html](public/inventory/import.html)):
  - Banner reflete v1.2 e explica as 2 chaves (NIF para fornecedor, ID para produto).
  - Cards de resumo: trocado "Fornecedores novos" por "Fornecedores: X novos · Y existentes".
  - Nova tabela de fornecedores no preview com badge `cadastrar`/`existente` por linha.
  - Mensagem final mostra fornecedores criados vs ignorados (mesmo NIF).

### Corrigido
- **Migração 60** ([60-internal-code-format.sql](database/inventory-refactor/60-internal-code-format.sql)) — bloco de verificação final usava `is_called` (coluna inexistente em `pg_sequences`). Apenas `last_value` é selecionado agora. O corpo transacional da migração não foi afetado.

### Notas de aplicação
1. Aplicar [60-internal-code-format.sql](database/inventory-refactor/60-internal-code-format.sql) (uma vez, se ainda não foi).
2. Aplicar [70-suppliers-extended-fields.sql](database/inventory-refactor/70-suppliers-extended-fields.sql) (uma vez).
3. Aplicar [55-clean-test-data.sql](database/inventory-refactor/55-clean-test-data.sql) (antes de cada import limpo).
4. Importar a planilha v1.2 em `/inventory/adjustments.html` → "Importar planilha".

### Notas de compatibilidade
- Planilhas v1.0/v1.1 sem aba `Cadastro de Fornecedores` continuam funcionando: o passo de fornecedores é silenciosamente pulado. Recomenda-se atualizar a planilha para v1.2.
- Itens existentes com `internal_code` no formato antigo `SKUXXX` permanecem intactos.

---

## [1.4.0] — 2026-06-05

> **Marco**: substituição do termo "SKU" por **Código de Registro Interno** com novo esquema de geração — prefixo por tipo de produto (1XXXXXX para Uso e Consumo, 2XXXXXX para Patrimônio), 7 dígitos. Decisão da equipe de regras: SKU exige composição lógica (Tipo+Produto+Marca+Variação) que o sistema ainda não suporta; até lá, o identificador é um sequencial puro, sem mascarar atributos.

### Adicionado
- Nova migração [60-internal-code-format.sql](database/inventory-refactor/60-internal-code-format.sql) (**requer migração manual**):
  - Cria as sequences `seq_inv_code_consumo` (gera `1000001`, `1000002`, …) e `seq_inv_code_patrimonio` (gera `2000001`, `2000002`, …).
  - Reescreve `fn_inv_items_before_insert()` para gerar `internal_code` pelo prefixo do `macro_category`.
  - Helper RPC `fn_inv_set_code_sequences(p_consumo, p_patrimonio)` para reiniciar contadores em casos excepcionais.
  - Bloco de verificação ao final mostra o próximo código que sairia de cada sequence.

### Alterado
- **Importador XLSX** ([import.js](api/inventory/import.js)) não persiste mais a coluna SKU da planilha como `internal_code`. O código de origem é usado apenas para deduplicação dentro do arquivo (warnings) e exibição no preview. O código real é gerado pelo trigger do banco.
- **Resposta do importador**: campo `next_sku_starts_at` substituído por `next_consumo_code` (string formatada `1XXXXXX`).
- **Importador UI** ([import.html](public/inventory/import.html)) — banner, cabeçalho da tabela e mensagem final atualizados para refletir o novo formato. A coluna do preview agora rotula "Código (origem)".
- **Placeholders dos comboboxes** trocados de "Buscar item por nome, SKU ou categoria…" para "Buscar item por nome, código ou categoria…" em [transfers.html](public/inventory/transfers.html), [exits.html](public/inventory/exits.html), [adjustments.html](public/inventory/adjustments.html), [entries.html](public/inventory/entries.html) e [kardex.html](public/inventory/kardex.html).
- [_layout.js:5](public/inventory/_layout.js#L5) bump `INVENTORY_VERSION` para `v1.4.0`.

### Migração operacional
- Migração [55-clean-test-data.sql](database/inventory-refactor/55-clean-test-data.sql) atualizada para resetar `seq_inv_code_consumo` e `seq_inv_code_patrimonio` (mantém compatibilidade com `seq_inv_sku` legada se ainda existir). Helper `fn_inv_set_sku_sequence` foi removido daqui — a função e sequence antigas são dropadas pela migração 60.

### Removido
- Sequence `seq_inv_sku` e função `fn_inv_set_sku_sequence(INTEGER)` (dropadas pela migração 60).
- Geração automática de `internal_code` no formato `SKUXXX` (sequence única, 3 dígitos).

### Ordem de aplicação no ambiente
1. **Antes do primeiro import:** aplicar [60-internal-code-format.sql](database/inventory-refactor/60-internal-code-format.sql) (uma vez).
2. **Antes de cada import limpo:** aplicar [55-clean-test-data.sql](database/inventory-refactor/55-clean-test-data.sql).
3. Acessar `/inventory/adjustments.html` → "Importar planilha".

### Notas de compatibilidade
- Itens já cadastrados no sistema (se houver) com `internal_code` no formato antigo `SKUXXX` permanecem intactos. Apenas o gerador é trocado — novos cadastros usarão `1XXXXXX` / `2XXXXXX`.

---

## [1.3.1] — 2026-06-05

> **Patch UX**: identificação visual da versão do módulo Inventário no sidebar.

### Adicionado
- Exibe a versão atual do módulo abaixo do subtítulo do sidebar (`Areluna · Gestão de Estoques`) — fonte mono, cinza claro, recolhe junto com o sidebar ([_layout.js:5](public/inventory/_layout.js#L5), [_layout.js:62](public/inventory/_layout.js#L62)).
- Constante `INVENTORY_VERSION` centralizada em [_layout.js](public/inventory/_layout.js) — deve ser atualizada a cada release junto com o `CHANGELOG.md`.

---

## [1.3.0] — 2026-06-05

> **Marco**: importador de planilha XLSX para carga inicial do cadastro (255 itens da planilha v1.0 do Instituto) + migração de limpeza para preparar a base. Inclui fix de seleção do sidebar no Kardex.

### Adicionado
- **Importador de planilha XLSX (Areluna v1.0)** ([import.js](api/inventory/import.js), [import.html](public/inventory/import.html)):
  - Botão "Importar planilha" na tela de Ajustes (Admin only).
  - Fluxo em 2 etapas: `POST /api/inventory/import/preview` (multipart, parser XLSX, normalização, validação sem persistir) → `POST /api/inventory/import/execute` (persiste em batches de 100).
  - Normalização automática de categorias (7 variações → 5 canônicas via lookup), UoMs (10 → 7 canônicas), fornecedores (UPPER + trim, "–"/"VARIAVEL"/"-" tratados como ausência).
  - SKUs da planilha mantidos como `internal_code`; sequência ajustada ao final via `fn_inv_set_sku_sequence` para não duplicar nos novos cadastros.
  - Preview mostra cards de resumo, erros bloqueantes, avisos (expansíveis), listas de novas categorias/UMs/fornecedores e tabela com primeiros 10 itens.
  - Items são criados como `macro=consumo`, `controls_lot=true` (default por trigger), `base_uom_id = consumption_uom_id = purchase_uom_id` da UoM mapeada.

### Migração operacional
- **Limpeza de dados de teste** — nova migração [55-clean-test-data.sql](database/inventory-refactor/55-clean-test-data.sql) (**requer migração manual antes da importação**):
  - TRUNCATE `inv_movements, inv_stock, inv_lots, inv_entries, inv_entry_lines, inv_inventory_sessions, inv_inventory_counts, inv_item_location_params, inv_depreciation_runs` (RN07 contornado via TRUNCATE).
  - DELETE em `inv_items / inv_locations / inv_categories / inv_suppliers` com WHERE `name ILIKE '%teste%'` — preserva o resto.
  - `inv_units` (Marquês/Cristal/ProStoral) preservada intacta.
  - Reset de `seq_inv_sku` e `seq_inv_patrimony` para 1.
  - Nova função `fn_inv_set_sku_sequence(value)` para o importador ajustar a sequence após inserir SKUs explícitos.

### Corrigido
- **Sidebar — Kardex destacava "Relatórios"**: `activePage` em [kardex.html](public/inventory/kardex.html) trocado de `'reports'` para `'kardex'`.

---

## [1.2.0] — 2026-06-03

> **Marco**: inativação de movimentos por estorno (RN07-safe) + refatorações de relatórios + comprovante de impressão Brother + QR direto para ficha + access-log com nome real do utilizador. Toda a manipulação de movimentos agora é reversível por Admin sem violar o append-only de `inv_movements`.
>
> Ver [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) para visão geral arquitetural.

### Adicionado
- **Inativação de movimentos (cancelamento por estorno)** — nova migração [54-cancellation.sql](database/inventory-refactor/54-cancellation.sql) (**requer migração**):
  - `inv_movements` ganha coluna `reversal_of_movement_id UUID` (FK self) — quando preenchida, indica que o movimento é estorno do referenciado. RN07 preservado (append-only mantido).
  - `fn_inv_cancel_movement(movement_id, user_id, reason)` gera um movimento espelho, aplica delta inverso no stock e recalcula CMP do item quando uma entrada é cancelada. Para transferências, cancela atomicamente o par saida+entrada.
  - `fn_inv_cancel_entry(entry_id, user_id, reason)` itera todos os movimentos derivados de uma entrada (`document_type+document_number+supplier_id`) e cancela cada um numa única transação.
  - `fn_inv_apply_stock_delta` helper para UPSERT manual respeitando os índices parciais de `inv_stock`. Bypass de RN05 quando reverte (stock pode ficar negativo).
  - `vw_inv_movements_with_status` view com flags `is_cancelled` / `is_reversal` / `reversal_id`.
  - Endpoints `POST /api/inventory/movements/:id/cancel` ([movements.js](api/inventory/movements.js)) e `POST /api/inventory/entries/:id/cancel` ([entries.js](api/inventory/entries.js)) — ambos `requireRole(Admin)` e validam motivo ≥ 5 chars.
  - UI: botão "Inativar" nos modais de view de [entries.html](public/inventory/entries.html), [exits.html](public/inventory/exits.html) e [adjustments.html](public/inventory/adjustments.html). Aparece apenas para Admin (`window.isInventoryAdmin`) e oculta-se em movimentos já cancelados ou que sejam estornos. Helper `confirmCancelMovement` ([_layout.js](public/inventory/_layout.js)) faz fluxo de confirmação dupla + motivo.
  - Badges "Estornado" (vermelho, linha riscada) e "Estorno" (âmbar) nas listagens de saídas, ajustes e histórico de movimentos.
  - `attachCancellationStatus` ([_stock.js](api/inventory/_stock.js)) enriquece resultados das listagens com `is_cancelled` / `is_reversal` via 1 query batch.

### Alterado
- **Relatórios — filtros aplicados ANTES da consulta** ([reports.html](public/inventory/reports.html)): clicar no card abre painel de filtros vazio; usuário escolhe localização/datas e clica "Aplicar consulta" para disparar o fetch. Botões CSV/Excel/PDF só aparecem após a primeira consulta. Adicionado filtro de data (`from`/`to`) nos relatórios temporais (inventory-sessions, consumption-trend, user-activity) com default últimos 30 dias.
- **Valoração dos Stocks (antes "Valorização de Stock")** ([reports.js](api/inventory/reports.js)): agregada por (item, localização) somando todos os lotes — não detalha lote por linha. Aceita `?location_id=` para filtrar; quando filtrado, agrega só por item (todos os lotes da localização). Lógica reescrita usando `inv_stock` direto em vez de `vw_inv_valuation` para suportar o filtro.
- **"Depreciação (patrimonial)" → "Ajuste contábil"** ([adjustments.html](public/inventory/adjustments.html)): apenas label da opção no modal de Saída administrativa — subtype `depreciacao` no DB inalterado (mantém compat com fluxo de depreciação anual).

### Adicionado
- **Saída administrativa na tela de Ajustes** ([adjustments.html](public/inventory/adjustments.html)): Admin tem 2 botões na tela de Ajustes:
  - **Novo ajuste** — fluxo existente (movimento type=ajuste com motivo)
  - **Saída administrativa** — novo modal para avaria/extravio/perda/quebra/depreciação. Gera um movimento **type=saida** (não ajuste) via `POST /api/inventory/exits` com o subtype administrativo. Aparece no histórico de Saídas, não de Ajustes.
  - Rationale: esses tipos são tecnicamente saídas (consomem stock), mas o lançamento fica restrito a Admin via UI. Operador comum continua sem acesso à tela e o endpoint `/exits` continua bloqueando subtypes administrativos para roles não-admin.
- **Comprovante de entrada/saída/ajuste para impressão Brother QL-810W** ([print-receipt.html](public/inventory/print-receipt.html)):
  - Nova página `/inventory/print-receipt.html?type=entry|exit&id=<uuid>` com layout otimizado para impressão térmica em mm (mesma estratégia da etiqueta QR — `@page` sem cabeçalho/rodapé, seletor de rolo DK).
  - Endpoint `GET /api/inventory/movements/:id` adicionado em [movements.js](api/inventory/movements.js) para alimentar o comprovante de saída/ajuste.
  - `showViewModal` em [_layout.js](public/inventory/_layout.js) ganha parâmetro `actions: [{label, icon, href|onclick}]` — botões na barra superior do modal.
  - Botão "Imprimir comprovante" adicionado nos modais de view em [entries.html](public/inventory/entries.html), [exits.html](public/inventory/exits.html) e [adjustments.html](public/inventory/adjustments.html). Impressão sob demanda — não automática ao lançar.
  - Formato do comprovante: cabeçalho institucional, dados do documento (entrada) ou movimento, item(s), quantidade(s), custos e justificação quando aplicável.

### Alterado
- **QR escaneado vai direto para a ficha do item** ([items.js](api/inventory/items.js), [item-view.html](public/inventory/item-view.html), [scan.html](public/inventory/scan.html)):
  - Payload do QR mudou de `/inventory/scan.html?code=<uuid>` para `/inventory/item-view.html?qr=<uuid>` — escanear a etiqueta abre a ficha imediatamente.
  - `item-view.html` aceita `?qr=<uuid>` e resolve via `/api/inventory/scan/:qrCode` antes de carregar.
  - `scan.html` simplificado: serve apenas de leitor por câmera (sem preview card); ao escanear, redireciona para `item-view.html?qr=`.
  - Retrocompat: URL antiga `scan.html?code=` faz redirect 302-equivalente client-side para `item-view.html?qr=`.
  - **Etiquetas impressas com QR antigo precisam ser reimpressas** para apontar para a nova URL diretamente (eliminar o redirect intermediário).

---

## [1.1.0] — 2026-06-03

> **Marco**: stack arquitetural agora opera por (item, localização) — não apenas por item — e ganha hierarquia de categorias N-níveis. Toda a Fase 4 (parâmetros, views, API/UI por localização) e a Fase 5.x (hierarquia, cadastro refinado, fluxos administrativos restritos, etiqueta Brother QL-810W) entregues. Bug crítico de fuso horário no Kardex corrigido. Auth com redirect preservando origem.
>
> Ver [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) para visão geral arquitetural.

### Alterado
- **Auth: redirect para login com `?redirect=` em token expirado** ([_layout.js](public/inventory/_layout.js), [login.html](public/login.html), guards inline em 20 páginas de `public/`):
  - `apiCall` detecta 401 e 403 com mensagem de "token" → limpa sessão e manda para `/login.html?redirect=<path_atual>`.
  - Guards inline (`<script>if(!access_token)…</script>`) em todas as páginas de inventory atualizados para passar a URL atual via `?redirect=`.
  - `login.html` honra `?redirect=` após login bem-sucedido — caso contrário cai no `dashboard.html`. Validação `^/[^/]` impede `javascript:` ou open redirect externo.
  - Se o usuário já tem sessão válida e abre `/login.html?redirect=/inventory/items.html`, vai direto para a URL pedida (sem rebote pelo dashboard).
- **JWT 12h — config operacional do Supabase** *(não é mudança de código)*: para estender a sessão de 1h (default) para 12h, no painel Supabase ir em **Project Settings → Auth → JWT Expiry** e setar para `43200`. O cliente Supabase JS já faz refresh automático antes de expirar enquanto a aba está aberta.
- **Saídas restritas a tipo "consumo"** ([exits.js](api/inventory/exits.js), [exits.html](public/inventory/exits.html)): operador só lança consumo; tipos críticos (avaria/extravio/perda/quebra/depreciação) viraram fluxo administrativo e são bloqueados pelo endpoint para roles não-admin com erro 403 explícito.
- **Tela de Ajustes restrita a Admin** ([adjustments.js](api/inventory/adjustments.js)): GET/POST agora usam `requireRole(['Inventory_Admin','Admin','admin'])` em vez de `requirePermission('inventory','adjust')`. Sidebar ([_layout.js](public/inventory/_layout.js)) marca o item como `adminOnly` — só aparece após `/api/auth/me` confirmar a role.
- **Etiqueta QR Brother QL-810W** ([item-label.html](public/inventory/item-label.html)): novo layout otimizado para impressão térmica com `@page` em mm; seletor de formato Brother DK (1202/1208/1209/2205); tipografia em mm para escalar entre rolos; aviso na UI orientando ativar "Margens: Nenhuma" e desativar cabeçalho/rodapé no diálogo de impressão. Sem cabeçalho/rodapé/data/hora na etiqueta.

### Corrigido
- **Kardex exibia data anterior para entradas em fusos UTC-N**: nova migração [53-fix-entry-occurred-at.sql](database/inventory-refactor/53-fix-entry-occurred-at.sql) (**requer migração**). `fn_inv_process_entry_line` agora grava `occurred_at = NOW()` (instante real do lançamento) em vez de `document_date::TIMESTAMPTZ` que era 00:00 UTC e deslocava para o dia anterior em clientes UTC-3. `document_date` continua em `inv_entries` para auditoria fiscal. Movimentos antigos ficam como estão (RN07 bloqueia UPDATE).

### Adicionado
- **Fase 5.2 — Cadastro de item refinado**:
  - Novo endpoint `DELETE /api/inventory/items/:id/image` ([items.js](api/inventory/items.js)) — limpa `image_url` (arquivo no Storage fica órfão para auditoria).
  - Backend faz fallback automático `base_uom_id = purchase_uom_id` em POST/PUT (UI nova não pede base).
  - UI [item-form.html](public/inventory/item-form.html): "Tipo de item" → "Tipo de cadastro"; "Subcategoria" → "Categoria" com path completo no tooltip; UM base oculto; rename UoM → UM; botão "Remover imagem" no preview (modo edit).
  - Seletor de categoria mostra o caminho completo "Categoria / Subcategoria" via `vw_inv_categories_tree`, com indentação por profundidade.
- **Fase 5.3 — Entradas operam direto em unidade de consumo**:
  - Campo "Fator de conversão" oculto em [entries.html](public/inventory/entries.html) (preservado no schema e enviado como 1 para o backend).
  - Coluna "Qtd" passa a indicar a UM de consumo do item ("(em UN)", "(em ml)", etc.).
  - Visualização de entrada agora mostra apenas "Quantidade" (omite fator quando =1).
  - Rationale: caixa fechada de 100 ampolas → nota fiscal traz 100 ampolas, não 1 caixa. Evita números quebrados.
- **CMP → "Custo Médio" na UI** (decisão: fórmula ponderada mantida em `inv_items.cmp`; só os labels mudam):
  - [item-view.html](public/inventory/item-view.html), [scan.html](public/inventory/scan.html), [transfers.html](public/inventory/transfers.html), [exits.html](public/inventory/exits.html), [adjustments.html](public/inventory/adjustments.html), [movements.html](public/inventory/movements.html), [items.html](public/inventory/items.html), [depreciation.html](public/inventory/depreciation.html), [reports.html](public/inventory/reports.html), [reports.js](api/inventory/reports.js).
- **Fase 5.1 — Hierarquia de categorias (N níveis)**: nova migração [52-fase5-categories-hierarchy.sql](database/inventory-refactor/52-fase5-categories-hierarchy.sql) (**requer migração**):
  - Adiciona `inv_categories.parent_id UUID REFERENCES inv_categories(id) ON DELETE RESTRICT` + índice parcial.
  - Trigger `fn_inv_categories_check_parent`: filhos herdam `parent_macro` do pai; bloqueia auto-referência e ciclos (até 100 ancestrais).
  - View `vw_inv_categories_tree`: recursive CTE com `path`, `depth`, `ancestors_ids`, `ancestors_names`.
  - View `vw_inv_categories_with_counts`: agrega `children_count` e `items_count` por nó (UI exibe badges).
  - Aditiva pura: categorias atuais ficam como raízes (parent_id = NULL).
- **API categories ([categories.js](api/inventory/categories.js))**:
  - `GET /` agora lê da `vw_inv_categories_tree` (devolve path + depth).
  - Novo `GET /tree?parent_macro=…` — árvore aninhada com `children`, `items_count`, `children_count`.
  - `POST` e `PUT` aceitam `parent_id`; valida profundidade máxima por macro (consumo=2, patrimonial=10).
  - `DELETE` bloqueia categorias com filhos ativos ou itens vinculados (mensagens amigáveis).
- **UI categories ([categories.html](public/inventory/categories.html))**:
  - Árvore expansível com indentação por nível.
  - Botão "+" por nó (visível apenas se profundidade permitir mais filhos).
  - Badges de items_count.
  - Janela de consumo configurável apenas em categorias raiz (nível 1) — subcategorias herdam.
- **Fase 4.4 — Filtros de UI por localização + dashboard segmentado**:
  - Novo endpoint `GET /api/inventory/items/:id/effective-window?location_id=` ([items.js](api/inventory/items.js)) — devolve a janela efetiva (override > category > 30) para popular default do Kardex.
  - [kardex.html](public/inventory/kardex.html): seletor de localização + presets de janela (7/30/60/90/180/365) + intervalo personalizado. URL aceita deep-link `?item=&location_id=`.
  - [reports.html](public/inventory/reports.html): barra de filtros condicional (aparece nos relatórios com `supportsLocation`). Filtros aplicam ao gerar e exportar; reset ao trocar de relatório.
  - [index.html](public/inventory/index.html) (dashboard): tabs por unidade com contadores de alerta por localização + cards `by_location` clicáveis. Selecionar uma localização filtra KPIs em tempo real.
  - [_layout.js](public/inventory/_layout.js): badge de alertas global segmenta o painel por localização (uso do `by_location` da F4.3), mostrando contadores agrupados por unidade.
- **Fase 4.3 — API + UI de overrides por localização**:
  - Novo endpoint [api/inventory/item-location-params.js](api/inventory/item-location-params.js) montado em `/api/inventory/items/:itemId/location-params`:
    - `GET /` — devolve params efetivos por localização (1 linha por location ativa, com `is_override` e `source_<campo>`)
    - `PUT /:locationId` — upsert override (qualquer campo omitido ou null = herda)
    - `DELETE /:locationId` — soft-delete do override (volta a herdar)
  - `GET /items/:id` agora inclui `location_params: [...]` no payload (apenas para consumo).
  - Filtro `?location_id=` em `/reports/{reorder,stock-min-max,coverage,kardex,consumption-trend}` — quando presente, usam as views `*_by_location` da F4.2.
  - Filtros `?from=` e `?to=` em `/reports/kardex/:itemId` para janela temporal customizável; saldo passa a usar `running_balance_at_location` quando `location_id` presente.
  - `/stats/summary` aceita `?location_id=` (KPIs filtrados) e devolve `by_location: [{location_id, name, items_total, below_min, ...}]` quando sem filtro — pronto para dashboard segmentado em F4.4.
  - UI [item-form.html](public/inventory/item-form.html): nova seção "Parâmetros por localização" (apenas consumo, modo edit) com tabela de min/max/lead_time/janela por localização. Vazio = herda do global. Override = bold sky. Botão para reverter ao default.
  - UI [item-view.html](public/inventory/item-view.html): tabela read-only de parâmetros efetivos com badges "Override"/"Herda" e indicação visual do valor sobrescrito.
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

[Unreleased]: https://github.com/<org>/sistemaInventario/compare/v1.8.1...HEAD
[1.8.1]: https://github.com/<org>/sistemaInventario/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/<org>/sistemaInventario/compare/v1.7.3...v1.8.0
[1.7.3]: https://github.com/<org>/sistemaInventario/compare/v1.7.2...v1.7.3
[1.7.2]: https://github.com/<org>/sistemaInventario/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/<org>/sistemaInventario/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/<org>/sistemaInventario/compare/v1.6.1...v1.7.0
[1.6.1]: https://github.com/<org>/sistemaInventario/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/<org>/sistemaInventario/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/<org>/sistemaInventario/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/<org>/sistemaInventario/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/<org>/sistemaInventario/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/<org>/sistemaInventario/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/<org>/sistemaInventario/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/<org>/sistemaInventario/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/<org>/sistemaInventario/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/<org>/sistemaInventario/releases/tag/v1.0.0
