-- =====================================================
-- INVENTORY REFACTOR — 119. View de itens com saldo (p/ ordenar por Stock)
-- =====================================================
-- A tela de Itens passou a exibir o SALDO atual (coluna "Stock"). Para permitir
-- ORDENAR por esse saldo numa lista paginada, a ordenação precisa acontecer no
-- banco — mas saldo é um agregado, não uma coluna de inv_items.
--
-- Esta view expõe stock_qty (consumo = soma do inv_stock; patrimônio = nº de
-- unidades ativas) junto das colunas usadas para filtro/busca. A API ordena e
-- pagina por esta view (obtendo os IDs da página) e depois hidrata os itens
-- completos por ID na tabela (onde os embeds existem).
--
-- Só leitura; não altera dados. Idempotente.
-- =====================================================

BEGIN;

CREATE OR REPLACE VIEW vw_inv_items_with_stock AS
SELECT
    i.id,
    i.macro_category,
    i.subcategory_id,
    i.is_active,
    i.deleted_at,
    i.name,
    i.internal_code,
    i.manufacturer_ref,
    i.barcode,
    (
        COALESCE((SELECT SUM(s.quantity)
                    FROM inv_stock s
                   WHERE s.item_id = i.id), 0)
      + COALESCE((SELECT COUNT(*)
                    FROM inv_serial_units su
                   WHERE su.item_id = i.id
                     AND su.deleted_at IS NULL
                     AND su.status <> 'baixado'), 0)
    )::numeric AS stock_qty
FROM inv_items i;

GRANT SELECT ON vw_inv_items_with_stock TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- SELECT id, name, stock_qty FROM vw_inv_items_with_stock ORDER BY stock_qty DESC LIMIT 10;
