-- =====================================================
-- DEDUP de inv_items duplicados (IDs apagados na importação)
-- =====================================================
-- Contexto: na última importação, o ID (internal_code) de alguns itens foi
-- apagado na planilha. O importador então AUTO-ATRIBUIU um novo código a essas
-- linhas, criando um SEGUNDO registro para o mesmo item — um com o código
-- original (menor) e outro com o código novo (maior).
--
-- Chave de duplicidade: mesmo NOME (normalizado) + mesma macro_category.
--   (Ajuste a chave em `name_key` se quiser incluir subcategoria etc.)
--
-- Regra de remoção (a pedido):
--   • Apaga o registro de internal_code MAIOR se ele NÃO tiver histórico
--     (nenhum registro "em cascata" referenciando-o).
--   • Se o MAIOR tiver histórico, mantém-se ele e apaga-se o MENOR
--     (desde que o menor não tenha histórico).
--   • Se AMBOS tiverem histórico → NÃO é apagado nada (precisa de merge manual;
--     aparece na identificação para revisão).
--
-- "Histórico / cascata" = existe linha referenciando o item em alguma das
-- tabelas com ON DELETE RESTRICT:
--   inv_movements, inv_stock, inv_lots, inv_entry_lines,
--   inv_inventory_counts, inv_serial_units
-- (inv_item_location_params é ON DELETE CASCADE → é config, não bloqueia, e
--  some junto se o item for apagado.)
--
-- ⚠️  DESTRUTIVO E IRREVERSÍVEL (DELETE físico).
--     1) Faça BACKUP do banco antes.
--     2) Rode a SEÇÃO 1 (identificação) e REVISE os grupos.
--     3) Só então rode a SEÇÃO 2 (dentro da transação BEGIN…COMMIT).
--     4) Se preferir reversível, veja a SEÇÃO 3 (soft-delete).
-- =====================================================


-- =====================================================
-- SEÇÃO 1 — IDENTIFICAR os duplicados (somente leitura)
-- =====================================================
WITH base AS (
    SELECT
        i.id,
        i.internal_code,
        i.name,
        i.macro_category,
        i.subcategory_id,
        i.created_at,
        lower(btrim(i.name)) || '|' || i.macro_category AS name_key,
        (SELECT count(*) FROM inv_movements        m  WHERE m.item_id  = i.id) AS n_movimentos,
        (SELECT count(*) FROM inv_stock            s  WHERE s.item_id  = i.id) AS n_stock,
        (SELECT count(*) FROM inv_lots             l  WHERE l.item_id  = i.id) AS n_lotes,
        (SELECT count(*) FROM inv_entry_lines      el WHERE el.item_id = i.id) AS n_linhas_entrada,
        (SELECT count(*) FROM inv_inventory_counts c  WHERE c.item_id  = i.id) AS n_contagens,
        (SELECT count(*) FROM inv_serial_units     su WHERE su.item_id = i.id) AS n_unidades_serie
    FROM inv_items i
    WHERE i.deleted_at IS NULL
),
enriched AS (
    SELECT b.*,
           (b.n_movimentos + b.n_stock + b.n_lotes + b.n_linhas_entrada + b.n_contagens + b.n_unidades_serie) AS total_refs
    FROM base b
),
dups AS (
    SELECT name_key
    FROM enriched
    GROUP BY name_key
    HAVING count(*) > 1
)
SELECT
    e.name,
    e.macro_category,
    e.internal_code,
    e.id,
    e.total_refs,
    (e.total_refs > 0)            AS tem_historico,
    e.n_movimentos, e.n_stock, e.n_lotes, e.n_linhas_entrada, e.n_contagens, e.n_unidades_serie,
    e.created_at
FROM enriched e
JOIN dups d ON d.name_key = e.name_key
ORDER BY e.name_key, e.internal_code;


-- =====================================================
-- SEÇÃO 2 — APAGAR (DELETE físico) os duplicados sem histórico
-- =====================================================
-- Roda dentro de uma transação. Confira a contagem antes do COMMIT.
BEGIN;

WITH base AS (
    SELECT
        i.id,
        i.internal_code,
        lower(btrim(i.name)) || '|' || i.macro_category AS name_key,
        (   EXISTS (SELECT 1 FROM inv_movements        m  WHERE m.item_id  = i.id)
         OR EXISTS (SELECT 1 FROM inv_stock            s  WHERE s.item_id  = i.id)
         OR EXISTS (SELECT 1 FROM inv_lots             l  WHERE l.item_id  = i.id)
         OR EXISTS (SELECT 1 FROM inv_entry_lines      el WHERE el.item_id = i.id)
         OR EXISTS (SELECT 1 FROM inv_inventory_counts c  WHERE c.item_id  = i.id)
         OR EXISTS (SELECT 1 FROM inv_serial_units     su WHERE su.item_id = i.id)
        ) AS has_refs
    FROM inv_items i
    WHERE i.deleted_at IS NULL
),
dups AS (
    SELECT name_key FROM base GROUP BY name_key HAVING count(*) > 1
),
ranked AS (
    SELECT b.*,
           -- O "eleito a manter" (keep_rank = 1): prioriza quem TEM histórico;
           -- em empate (ninguém tem, ou >1 tem), mantém o menor internal_code.
           row_number() OVER (
               PARTITION BY b.name_key
               ORDER BY b.has_refs DESC, b.internal_code ASC
           ) AS keep_rank
    FROM base b
    JOIN dups d ON d.name_key = b.name_key
),
to_delete AS (
    -- Apaga apenas duplicados NÃO eleitos E SEM histórico (seguro: o RESTRICT
    -- nem bloquearia). Duplicado não-eleito que TENHA histórico fica de fora
    -- (caso "ambos têm histórico" → revisar manualmente).
    SELECT id, internal_code
    FROM ranked
    WHERE keep_rank > 1
      AND has_refs = false
)
DELETE FROM inv_items
WHERE id IN (SELECT id FROM to_delete)
RETURNING internal_code;   -- lista os apagados

-- Revise quantas linhas voltaram acima. Se estiver certo:
COMMIT;
-- Se algo parecer errado:
-- ROLLBACK;


-- =====================================================
-- SEÇÃO 3 — Alternativa REVERSÍVEL (soft-delete)
-- =====================================================
-- Em vez do DELETE da Seção 2, marque deleted_at (some das telas, mas dá pra
-- desfazer). Use o MESMO bloco da Seção 2, trocando o DELETE por:
--
-- UPDATE inv_items
--    SET deleted_at = NOW(), is_active = false
--  WHERE id IN (SELECT id FROM to_delete);
