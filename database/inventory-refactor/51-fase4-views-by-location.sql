-- =====================================================
-- INVENTORY REFACTOR — Fase 4.2
-- Views e MV "by_location" + fn_inv_consume usando min efetivo
-- =====================================================
-- Estratégia:
--   Esta migração é aditiva no nível das views: cria as versões
--   *_by_location ao lado das views agregadas existentes (sem alterá-las).
--   Os relatórios atuais continuam servindo dados globais para
--   retro-compatibilidade. A Fase 4.3 (próxima) atualiza os endpoints API
--   para usar as novas views quando o filtro ?location_id= for fornecido.
--
--   fn_inv_consume é redefinida (CREATE OR REPLACE) para ler o min_stock
--   efetivo da localização — única mudança de comportamento desta fase.
--   Resolução do min: location_override > item_global > 0.
--
--   A janela de consumo usada em vw_inv_avg_daily_consumption_by_location
--   vem de vw_inv_item_effective_params (Fase 4.1), que aplica
--   location_override > category > 30.
--
-- Idempotente. Não derruba views existentes.
-- =====================================================

BEGIN;

-- ---------- 1) vw_inv_total_stock_by_location ----------
CREATE OR REPLACE VIEW vw_inv_total_stock_by_location AS
SELECT
    s.item_id,
    s.location_id,
    SUM(s.quantity) AS total_qty
FROM inv_stock s
GROUP BY s.item_id, s.location_id;

COMMENT ON VIEW vw_inv_total_stock_by_location IS
'Stock total por (item, location) somando lotes. Substitui a leitura '
'global de vw_inv_total_stock quando o relatório aceita filtro location.';

-- ---------- 2) vw_inv_avg_daily_consumption_by_location ----------
-- Considera apenas saídas de consumo a partir da localização (from_location_id).
-- Transferências entre localizações entram como saída da origem (NÃO contam
-- como consumo "real" do Instituto, mas SIM como saída daquela localização,
-- alinhado com a definição de cobertura local).
CREATE OR REPLACE VIEW vw_inv_avg_daily_consumption_by_location AS
SELECT
    ep.item_id,
    ep.location_id,
    ep.item_name,
    ep.internal_code,
    ep.location_name,
    ep.unit_name,
    ep.consumption_window_days AS window_days,
    ep.source_window_days,
    COALESCE(SUM(m.quantity), 0)                                            AS total_qty,
    COALESCE(SUM(m.quantity), 0)::NUMERIC / ep.consumption_window_days      AS avg_daily
FROM vw_inv_item_effective_params ep
LEFT JOIN inv_movements m
       ON  m.item_id          = ep.item_id
       AND m.from_location_id = ep.location_id
       AND m.type IN ('saida', 'transferencia_saida', 'depreciacao')
       AND m.occurred_at >= NOW() - (ep.consumption_window_days || ' days')::INTERVAL
GROUP BY
    ep.item_id, ep.location_id, ep.item_name, ep.internal_code,
    ep.location_name, ep.unit_name,
    ep.consumption_window_days, ep.source_window_days;

COMMENT ON VIEW vw_inv_avg_daily_consumption_by_location IS
'Consumo médio diário por (item, location). Janela vem do parâmetro '
'efetivo (location override > category > 30 dias).';

-- ---------- 3) vw_inv_reorder_status_by_location ----------
CREATE OR REPLACE VIEW vw_inv_reorder_status_by_location AS
SELECT
    ep.item_id,
    ep.location_id,
    ep.item_name,
    ep.internal_code,
    ep.location_name,
    ep.unit_name,
    COALESCE(ts.total_qty, 0)               AS current_stock,
    ep.min_stock,
    ep.max_stock,
    ep.lead_time_days,
    ep.reorder_point,
    ac.avg_daily,
    ep.consumption_window_days              AS window_days,
    CASE
        WHEN COALESCE(ts.total_qty, 0) <= 0                                        THEN 'rutura'
        WHEN ep.min_stock > 0 AND COALESCE(ts.total_qty, 0) <  ep.min_stock        THEN 'abaixo_minimo'
        WHEN ep.reorder_point > 0 AND COALESCE(ts.total_qty, 0) < ep.reorder_point THEN 'abaixo_reposicao'
        WHEN ep.max_stock IS NOT NULL AND COALESCE(ts.total_qty, 0) > ep.max_stock THEN 'acima_maximo'
        ELSE 'ok'
    END                                     AS status,
    ep.is_override,
    ep.source_min_stock,
    ep.source_max_stock,
    ep.source_lead_time_days,
    ep.source_reorder_point
FROM vw_inv_item_effective_params ep
LEFT JOIN vw_inv_total_stock_by_location ts
       ON ts.item_id = ep.item_id AND ts.location_id = ep.location_id
LEFT JOIN vw_inv_avg_daily_consumption_by_location ac
       ON ac.item_id = ep.item_id AND ac.location_id = ep.location_id;

COMMENT ON VIEW vw_inv_reorder_status_by_location IS
'Status de reposição (rutura/abaixo_minimo/abaixo_reposicao/acima_maximo/ok) '
'por (item, location), usando parâmetros efetivos da localização.';

-- ---------- 4) vw_inv_stock_coverage_by_location ----------
CREATE OR REPLACE VIEW vw_inv_stock_coverage_by_location AS
SELECT
    ep.item_id,
    ep.location_id,
    ep.item_name,
    ep.internal_code,
    ep.location_name,
    ep.unit_name,
    COALESCE(ts.total_qty, 0)        AS current_stock,
    ac.avg_daily,
    ep.consumption_window_days       AS window_days,
    CASE
        WHEN ac.avg_daily IS NULL OR ac.avg_daily = 0 THEN NULL
        ELSE COALESCE(ts.total_qty, 0) / ac.avg_daily
    END                              AS coverage_days,
    ep.is_override,
    ep.source_window_days
FROM vw_inv_item_effective_params ep
LEFT JOIN vw_inv_total_stock_by_location ts
       ON ts.item_id = ep.item_id AND ts.location_id = ep.location_id
LEFT JOIN vw_inv_avg_daily_consumption_by_location ac
       ON ac.item_id = ep.item_id AND ac.location_id = ep.location_id;

COMMENT ON VIEW vw_inv_stock_coverage_by_location IS
'Cobertura em dias (stock / consumo médio diário) por (item, location). '
'NULL quando consumo médio é zero (nenhuma saída na janela).';

-- ---------- 5) vw_inv_kardex_by_location ----------
-- Resolved location = localização que sofreu o efeito do movimento:
--   entrada / transferencia_entrada → to_location
--   saida / transferencia_saida / depreciacao → from_location
--   ajuste / inventario → lado preenchido (a função grava só um)
-- Running balance particionado por (item, resolved_location).
CREATE OR REPLACE VIEW vw_inv_kardex_by_location AS
SELECT
    m.id,
    m.item_id,
    i.name              AS item_name,
    i.internal_code,
    m.occurred_at,
    m.type,
    m.subtype,
    m.quantity,
    m.unit_cost,
    m.cmp_at_moment,
    CASE
        WHEN m.type IN ('entrada','transferencia_entrada')           THEN m.to_location_id
        WHEN m.type IN ('saida','transferencia_saida','depreciacao') THEN m.from_location_id
        WHEN m.type IN ('ajuste','inventario') THEN COALESCE(m.to_location_id, m.from_location_id)
        ELSE COALESCE(m.from_location_id, m.to_location_id)
    END                 AS location_id,
    fl.name             AS from_location,
    tl.name             AS to_location,
    lo.lot_number,
    m.justification,
    m.user_id,
    SUM(
        CASE
            WHEN m.type IN ('entrada','transferencia_entrada')           THEN m.quantity
            WHEN m.type IN ('saida','transferencia_saida','depreciacao') THEN -m.quantity
            WHEN m.type = 'ajuste'      AND m.to_location_id   IS NOT NULL THEN  m.quantity
            WHEN m.type = 'ajuste'      AND m.from_location_id IS NOT NULL THEN -m.quantity
            WHEN m.type = 'inventario'  AND m.to_location_id   IS NOT NULL THEN  m.quantity
            WHEN m.type = 'inventario'  AND m.from_location_id IS NOT NULL THEN -m.quantity
            ELSE 0
        END
    ) OVER (
        PARTITION BY
            m.item_id,
            CASE
                WHEN m.type IN ('entrada','transferencia_entrada')           THEN m.to_location_id
                WHEN m.type IN ('saida','transferencia_saida','depreciacao') THEN m.from_location_id
                WHEN m.type IN ('ajuste','inventario') THEN COALESCE(m.to_location_id, m.from_location_id)
                ELSE COALESCE(m.from_location_id, m.to_location_id)
            END
        ORDER BY m.occurred_at, m.created_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_balance_at_location
FROM       inv_movements m
JOIN       inv_items     i  ON i.id = m.item_id
LEFT JOIN  inv_locations fl ON fl.id = m.from_location_id
LEFT JOIN  inv_locations tl ON tl.id = m.to_location_id
LEFT JOIN  inv_lots      lo ON lo.id = m.lot_id;

COMMENT ON VIEW vw_inv_kardex_by_location IS
'Kardex com saldo acumulado por (item, location). location_id resolvido '
'pelo tipo do movimento; running_balance_at_location particionado.';

-- ---------- 6) mvw_inv_consumption_trend_by_location ----------
-- Tendência mensal de consumo por (item, location) — últimos 16 meses.
-- CROSS JOIN com inv_locations para "zerar" meses sem consumo (gráficos
-- ficam consistentes mesmo quando uma loja não consumiu nada).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_matviews
         WHERE schemaname = 'public' AND matviewname = 'mvw_inv_consumption_trend_by_location'
    ) THEN
        EXECUTE $sql$
            CREATE MATERIALIZED VIEW mvw_inv_consumption_trend_by_location AS
            WITH series AS (
                SELECT date_trunc('month', generate_series(
                    date_trunc('month', NOW()) - INTERVAL '15 months',
                    date_trunc('month', NOW()),
                    INTERVAL '1 month'
                ))::DATE AS month_start
            ),
            consumption AS (
                SELECT
                    m.item_id,
                    m.from_location_id                          AS location_id,
                    date_trunc('month', m.occurred_at)::DATE    AS month_start,
                    SUM(m.quantity)                             AS total_qty
                FROM inv_movements m
                WHERE m.type IN ('saida','transferencia_saida','depreciacao')
                  AND m.from_location_id IS NOT NULL
                  AND m.occurred_at >= date_trunc('month', NOW()) - INTERVAL '15 months'
                GROUP BY m.item_id, m.from_location_id, date_trunc('month', m.occurred_at)
            )
            SELECT
                i.id   AS item_id,
                i.name AS item_name,
                i.internal_code,
                l.id   AS location_id,
                l.name AS location_name,
                u.name AS unit_name,
                s.month_start,
                COALESCE(c.total_qty, 0)::NUMERIC AS total_qty
            FROM       inv_items     i
            CROSS JOIN inv_locations l
            CROSS JOIN series        s
            LEFT JOIN  inv_units     u  ON u.id = l.unit_id
            LEFT JOIN  consumption   c
                   ON c.item_id     = i.id
                  AND c.location_id = l.id
                  AND c.month_start = s.month_start
            WHERE i.macro_category = 'consumo'
              AND i.is_active = TRUE
              AND i.deleted_at IS NULL
              AND l.is_active = TRUE
              AND l.deleted_at IS NULL
        $sql$;
    END IF;
END $$;

-- Índice para o refresh CONCURRENTLY (Postgres exige UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_mvw_inv_trend_loc
    ON mvw_inv_consumption_trend_by_location (item_id, location_id, month_start);

COMMENT ON MATERIALIZED VIEW mvw_inv_consumption_trend_by_location IS
'Tendência mensal de consumo últimos 16 meses por (item, location). '
'Refrescada diariamente via pg_cron inv-refresh-mviews-daily.';

-- ---------- 7) Atualiza pg_cron para incluir a nova MV ----------
DO $$
BEGIN
    -- Desagenda e reagenda para garantir que o comando inclui a nova MV.
    -- pg_cron pode não estar disponível em ambientes self-hosted antigos.
    BEGIN
        PERFORM cron.unschedule('inv-refresh-mviews-daily');
    EXCEPTION WHEN OTHERS THEN
        NULL; -- job não existia ou pg_cron indisponível
    END;

    BEGIN
        PERFORM cron.schedule(
            'inv-refresh-mviews-daily',
            '0 3 * * *',
            $cmd$REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_inv_consumption_trend;
                 REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_inv_user_activity;
                 REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_inv_consumption_trend_by_location;$cmd$
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron indisponível — refresh manual necessário para mvw_inv_consumption_trend_by_location';
    END;
END $$;

-- ---------- 8) fn_inv_consume com min_stock efetivo ----------
-- Única mudança de COMPORTAMENTO desta fase: a confirmação de "stock cairá
-- abaixo do mínimo" passa a usar o mínimo efetivo da localização (override >
-- item global > 0) em vez do mínimo global do item.
CREATE OR REPLACE FUNCTION fn_inv_consume(
    p_item                   UUID,
    p_location               UUID,
    p_qty                    NUMERIC,
    p_lot                    UUID,
    p_subtype                VARCHAR,
    p_justification          TEXT,
    p_user                   UUID,
    p_confirmed_low_stock    BOOLEAN DEFAULT FALSE,
    p_movement_type          VARCHAR DEFAULT 'saida'
) RETURNS UUID AS $$
DECLARE
    v_item        inv_items%ROWTYPE;
    v_lot_id      UUID := p_lot;
    v_stock_qty   NUMERIC;
    v_new_qty     NUMERIC;
    v_movement_id UUID;
    v_min_stock   NUMERIC;
BEGIN
    IF p_qty IS NULL OR p_qty <= 0 THEN
        RAISE EXCEPTION 'Quantidade deve ser maior que zero' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_item FROM inv_items WHERE id = p_item AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item não encontrado: %', p_item USING ERRCODE = '02000';
    END IF;

    -- RN04: FEFO automático quando item controla lote e lote não informado
    IF v_item.controls_lot AND v_lot_id IS NULL THEN
        SELECT s.lot_id INTO v_lot_id
          FROM inv_stock s
          JOIN inv_lots  l ON l.id = s.lot_id
         WHERE s.item_id     = p_item
           AND s.location_id = p_location
           AND s.quantity    >= p_qty
           AND l.is_active   = TRUE
         ORDER BY l.expiry_date ASC NULLS LAST
         LIMIT 1;

        IF v_lot_id IS NULL THEN
            RAISE EXCEPTION 'Item % controla lote (RN03): nenhum lote disponível com stock suficiente na localização', v_item.name
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF v_item.controls_lot AND v_lot_id IS NULL THEN
        RAISE EXCEPTION 'Item % controla lote — lote é obrigatório (RN03)', v_item.name
            USING ERRCODE = 'P0001';
    END IF;

    IF v_lot_id IS NULL THEN
        SELECT quantity INTO v_stock_qty
          FROM inv_stock
         WHERE item_id = p_item AND location_id = p_location AND lot_id IS NULL;
    ELSE
        SELECT quantity INTO v_stock_qty
          FROM inv_stock
         WHERE item_id = p_item AND location_id = p_location AND lot_id = v_lot_id;
    END IF;

    v_stock_qty := COALESCE(v_stock_qty, 0);

    IF v_stock_qty < p_qty THEN
        RAISE EXCEPTION 'Stock insuficiente (disponível: %, solicitado: %) — RN05', v_stock_qty, p_qty
            USING ERRCODE = 'P0002';
    END IF;

    v_new_qty := v_stock_qty - p_qty;

    -- Fase 4.2: resolução do min_stock efetivo da (item, location).
    -- location_override > item_global > 0
    SELECT COALESCE(p.min_stock, v_item.min_stock, 0) INTO v_min_stock
      FROM inv_items i
      LEFT JOIN inv_item_location_params p
             ON p.item_id     = i.id
            AND p.location_id = p_location
            AND p.deleted_at IS NULL
     WHERE i.id = p_item;

    -- §16: confirmação se a saída deixaria abaixo do mínimo EFETIVO da localização
    IF NOT p_confirmed_low_stock AND v_new_qty < v_min_stock AND v_min_stock > 0 THEN
        RAISE EXCEPTION 'LOW_STOCK_CONFIRMATION_REQUIRED|current=%|after=%|min=%',
            v_stock_qty, v_new_qty, v_min_stock
            USING ERRCODE = 'P0003';
    END IF;

    -- Justificação obrigatória para tipos não-rotineiros
    IF p_subtype IN ('avaria','extravio','perda','quebra','depreciacao')
       AND (p_justification IS NULL OR btrim(p_justification) = '') THEN
        RAISE EXCEPTION 'Justificação é obrigatória para tipo %', p_subtype USING ERRCODE = '22023';
    END IF;

    IF v_lot_id IS NULL THEN
        UPDATE inv_stock SET quantity = v_new_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_location AND lot_id IS NULL;
    ELSE
        UPDATE inv_stock SET quantity = v_new_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_location AND lot_id = v_lot_id;
    END IF;

    INSERT INTO inv_movements (
        type, subtype, item_id, lot_id, from_location_id, quantity,
        unit_cost, total_cost, cmp_at_moment, justification, user_id
    ) VALUES (
        p_movement_type, p_subtype, p_item, v_lot_id, p_location, p_qty,
        v_item.cmp, p_qty * v_item.cmp, v_item.cmp, p_justification, p_user
    ) RETURNING id INTO v_movement_id;

    IF v_item.macro_category = 'patrimonial' AND p_subtype = 'depreciacao' THEN
        UPDATE inv_items SET asset_status = 'baixado' WHERE id = p_item;
    END IF;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- =====================================================

-- 1) Views criadas (5 views + 1 MV)
SELECT object_type, object_name FROM (
    SELECT 'view'   AS object_type, viewname     AS object_name FROM pg_views
     WHERE schemaname = 'public' AND viewname IN (
        'vw_inv_total_stock_by_location',
        'vw_inv_avg_daily_consumption_by_location',
        'vw_inv_reorder_status_by_location',
        'vw_inv_stock_coverage_by_location',
        'vw_inv_kardex_by_location'
     )
    UNION ALL
    SELECT 'matview' AS object_type, matviewname  AS object_name FROM pg_matviews
     WHERE schemaname = 'public' AND matviewname = 'mvw_inv_consumption_trend_by_location'
) t ORDER BY object_type, object_name;
-- Esperado: 5 views + 1 matview

-- 2) Conferir cardinalidade da view "by_location" (deve ser similar à
--    vw_inv_item_effective_params, já que ambas são (item × location))
SELECT 'effective_params' AS view, COUNT(*) AS rows FROM vw_inv_item_effective_params
UNION ALL SELECT 'reorder_status_by_location', COUNT(*) FROM vw_inv_reorder_status_by_location
UNION ALL SELECT 'stock_coverage_by_location',  COUNT(*) FROM vw_inv_stock_coverage_by_location;
-- Esperado: rows iguais entre os 3 (mesmo grão (item × location))

-- 3) Refresh inicial da MV (a primeira execução não pode ser CONCURRENTLY)
REFRESH MATERIALIZED VIEW mvw_inv_consumption_trend_by_location;
SELECT COUNT(*) AS trend_rows FROM mvw_inv_consumption_trend_by_location;
-- Esperado: (items consumo) × (localizações) × 16 meses

-- 4) Comparar total agregado: soma das parciais = total global
SELECT
    (SELECT SUM(total_qty) FROM vw_inv_total_stock)             AS total_global,
    (SELECT SUM(total_qty) FROM vw_inv_total_stock_by_location) AS total_partido;
-- Esperado: ambos os valores iguais

-- 5) Testar fn_inv_consume com override de localização (rodar manualmente):
-- Setup: item consumo com min_stock=10 global, override min_stock=20 no Cristal
-- Tentar saída no Cristal que deixaria stock=15 (abaixo do override) sem confirm:
-- Esperado: ERROR P0003 'LOW_STOCK_CONFIRMATION_REQUIRED|...|min=20'

-- 6) Conferir cron schedule
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'inv-refresh-mviews-daily';
-- Esperado: command inclui REFRESH ... mvw_inv_consumption_trend_by_location
