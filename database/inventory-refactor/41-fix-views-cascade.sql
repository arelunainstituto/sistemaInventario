-- =====================================================
-- INVENTORY REFACTOR — Fix
-- Recria vw_inv_avg_daily_consumption + dependentes
-- =====================================================
-- O 40-sprint4c-log-window.sql tentou CREATE OR REPLACE numa view
-- com colunas renomeadas/reordenadas, o que o Postgres não permite.
-- Aqui fazemos DROP CASCADE + recreate de todas as views afetadas:
--   • vw_inv_avg_daily_consumption (com janela por categoria)
--   • vw_inv_reorder_status (depende da anterior)
--   • vw_inv_stock_coverage (depende da anterior)
--
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================

BEGIN;

-- 1) Drop em cascata
DROP VIEW IF EXISTS vw_inv_stock_coverage  CASCADE;
DROP VIEW IF EXISTS vw_inv_reorder_status  CASCADE;
DROP VIEW IF EXISTS vw_inv_avg_daily_consumption CASCADE;

-- 2) Garante que a coluna existe (idempotência caso o 40 só tenha rodado pela metade)
ALTER TABLE inv_categories
    ADD COLUMN IF NOT EXISTS consumption_window_days INT NOT NULL DEFAULT 30
    CHECK (consumption_window_days IN (30, 60, 90, 180, 365));

-- 3) Recria avg_daily_consumption usando a janela da categoria
CREATE VIEW vw_inv_avg_daily_consumption AS
SELECT
    i.id                                       AS item_id,
    i.name,
    i.internal_code,
    COALESCE(cat.consumption_window_days, 30)  AS window_days,
    COALESCE(SUM(m.quantity), 0)               AS qty_consumed,
    CASE WHEN COALESCE(cat.consumption_window_days, 30) > 0
         THEN COALESCE(SUM(m.quantity), 0) / COALESCE(cat.consumption_window_days, 30)::NUMERIC
         ELSE 0
    END                                        AS avg_daily
FROM inv_items i
LEFT JOIN inv_categories cat ON cat.id = i.subcategory_id
LEFT JOIN inv_movements m
       ON m.item_id = i.id
      AND m.type = 'saida'
      AND m.subtype = 'consumo'
      AND m.occurred_at >= NOW() - (COALESCE(cat.consumption_window_days, 30)::TEXT || ' days')::INTERVAL
WHERE i.deleted_at IS NULL AND i.is_active = TRUE
GROUP BY i.id, i.name, i.internal_code, cat.consumption_window_days;

-- 4) Recria reorder_status (igual ao da Fase 3)
CREATE VIEW vw_inv_reorder_status AS
SELECT
    i.id                                       AS item_id,
    i.internal_code,
    i.name,
    cat.name                                   AS subcategory,
    i.lead_time_days,
    COALESCE(ts.total_qty, 0)                  AS current_stock,
    avg.avg_daily                              AS avg_daily_consumption,
    (avg.avg_daily * i.lead_time_days)         AS computed_reorder_point,
    i.min_stock,
    i.max_stock,
    CASE
        WHEN COALESCE(ts.total_qty, 0) = 0
            THEN 'rutura'
        WHEN COALESCE(ts.total_qty, 0) < i.min_stock
            THEN 'abaixo_minimo'
        WHEN COALESCE(ts.total_qty, 0) < (avg.avg_daily * i.lead_time_days)
            THEN 'abaixo_reposicao'
        WHEN i.max_stock IS NOT NULL AND COALESCE(ts.total_qty, 0) > i.max_stock
            THEN 'acima_maximo'
        ELSE 'ok'
    END                                        AS status
FROM inv_items i
LEFT JOIN vw_inv_total_stock ts ON ts.item_id = i.id
LEFT JOIN vw_inv_avg_daily_consumption avg ON avg.item_id = i.id
LEFT JOIN inv_categories cat ON cat.id = i.subcategory_id
WHERE i.deleted_at IS NULL AND i.is_active = TRUE AND i.macro_category = 'consumo';

-- 5) Recria stock_coverage (igual ao da Fase 3)
CREATE VIEW vw_inv_stock_coverage AS
SELECT
    i.id                                       AS item_id,
    i.internal_code,
    i.name,
    COALESCE(ts.total_qty, 0)                  AS current_stock,
    avg.avg_daily                              AS avg_daily_consumption,
    CASE WHEN avg.avg_daily > 0
        THEN COALESCE(ts.total_qty, 0) / avg.avg_daily
        ELSE NULL
    END                                        AS days_coverage
FROM inv_items i
LEFT JOIN vw_inv_total_stock ts ON ts.item_id = i.id
LEFT JOIN vw_inv_avg_daily_consumption avg ON avg.item_id = i.id
WHERE i.deleted_at IS NULL AND i.is_active = TRUE AND i.macro_category = 'consumo';

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'colunas vw_inv_avg_daily_consumption' AS check, string_agg(column_name, ', ' ORDER BY ordinal_position) AS resultado
  FROM information_schema.columns WHERE table_name = 'vw_inv_avg_daily_consumption'
UNION ALL
SELECT 'vw_inv_reorder_status existe', CASE WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'vw_inv_reorder_status') THEN 'sim' ELSE 'NÃO' END
UNION ALL
SELECT 'vw_inv_stock_coverage existe',  CASE WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'vw_inv_stock_coverage') THEN 'sim' ELSE 'NÃO' END;
