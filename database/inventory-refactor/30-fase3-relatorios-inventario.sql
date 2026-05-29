-- =====================================================
-- INVENTORY REFACTOR — FASE 3
-- Inventário Físico + Indicadores + Relatórios + RN09 + SKU
-- =====================================================
-- Adiciona ao schema das Fases 1 e 2:
--   • Migração de prefixo INV-XXXXXX → SKUXXX (sem hífen)
--   • Tabelas inv_inventory_sessions, inv_inventory_counts,
--     inv_depreciation_runs
--   • 8 views/materialized views para §11 e §12
--   • Funções: open/close/cancel session, run_depreciation
--   • pg_cron: refresh diário das mviews + depreciação anual
--
-- Atende: §10.3, §11.2-11.5, §12 (12.1-12.8), RN09, RF07.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. MIGRAÇÃO DO PREFIXO INV- → SKU
-- =====================================================
-- Atualiza items existentes e troca a sequence.
-- O sufixo passa a ter 3 dígitos com padding (SKU001…SKU999;
-- cresce naturalmente após 999).

CREATE SEQUENCE IF NOT EXISTS seq_inv_sku START 1 INCREMENT 1;

-- Renomear códigos existentes (idempotente)
UPDATE inv_items
   SET internal_code = 'SKU' || LPAD(
       LTRIM(REPLACE(internal_code, 'INV-', ''), '0'), 3, '0'
   )
 WHERE internal_code LIKE 'INV-%';

-- Reiniciar seq_inv_sku para o próximo número disponível
DO $$
DECLARE
    v_max INT;
BEGIN
    SELECT COALESCE(MAX(
        CASE WHEN internal_code ~ '^SKU[0-9]+$'
             THEN SUBSTRING(internal_code FROM 4)::INT
             ELSE 0 END
    ), 0) INTO v_max FROM inv_items;
    PERFORM setval('seq_inv_sku', GREATEST(v_max, 1), v_max > 0);
END $$;

-- Reescrever a função que gera o internal_code
CREATE OR REPLACE FUNCTION fn_inv_items_before_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.internal_code IS NULL OR NEW.internal_code = '' THEN
        NEW.internal_code := 'SKU' || LPAD(nextval('seq_inv_sku')::TEXT, 3, '0');
    END IF;

    -- Lote automático por categoria (RN03) — mantido da Fase 1
    IF NEW.macro_category = 'consumo' THEN
        NEW.controls_lot := TRUE;
        NEW.uses_serial  := FALSE;
    ELSIF NEW.macro_category = 'patrimonial' THEN
        NEW.controls_lot := FALSE;
        NEW.uses_serial  := TRUE;
        IF NEW.patrimony_number IS NULL THEN
            NEW.patrimony_number := 'PAT-' || LPAD(nextval('seq_inv_patrimony')::TEXT, 6, '0');
        END IF;
        IF NEW.asset_status IS NULL THEN
            NEW.asset_status := 'em_uso';
        END IF;
    END IF;

    IF NEW.reorder_point IS NULL OR NEW.reorder_point = 0 THEN
        NEW.reorder_point := NEW.min_stock;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A sequence antiga seq_inv_internal_code fica órfã (não bloqueia nada)
-- e pode ser dropada manualmente depois se quiser limpeza total.

-- =====================================================
-- 2. TABELAS DE SESSÃO DE INVENTÁRIO FÍSICO (§10.3)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_inventory_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id  UUID NOT NULL REFERENCES inv_locations(id) ON DELETE RESTRICT,
    status       VARCHAR(20) NOT NULL DEFAULT 'em_contagem'
                 CHECK (status IN ('em_contagem','validada','cancelada')),
    opened_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opened_by    UUID REFERENCES auth.users(id),
    closed_at    TIMESTAMPTZ,
    closed_by    UUID REFERENCES auth.users(id),
    notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_inv_sessions_location ON inv_inventory_sessions (location_id);
CREATE INDEX IF NOT EXISTS idx_inv_sessions_status   ON inv_inventory_sessions (status);

-- Apenas 1 sessão aberta por localização simultaneamente
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_sessions_open_per_location
    ON inv_inventory_sessions (location_id)
    WHERE status = 'em_contagem';

CREATE TABLE IF NOT EXISTS inv_inventory_counts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL REFERENCES inv_inventory_sessions(id) ON DELETE CASCADE,
    item_id       UUID NOT NULL REFERENCES inv_items(id) ON DELETE RESTRICT,
    lot_id        UUID REFERENCES inv_lots(id),
    expected_qty  NUMERIC(14,4) NOT NULL,
    counted_qty   NUMERIC(14,4),
    difference    NUMERIC(14,4) GENERATED ALWAYS AS
                  (COALESCE(counted_qty, 0) - expected_qty) STORED,
    notes         TEXT,
    counted_at    TIMESTAMPTZ
);

-- Unicidade por triplo (sessão, item, lote) tratando lot_id NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_counts_with_lot
    ON inv_inventory_counts (session_id, item_id, lot_id)
    WHERE lot_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_counts_no_lot
    ON inv_inventory_counts (session_id, item_id)
    WHERE lot_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_inv_counts_session ON inv_inventory_counts (session_id);
CREATE INDEX IF NOT EXISTS idx_inv_counts_item    ON inv_inventory_counts (item_id);

-- =====================================================
-- 3. TABELA DE EXECUÇÕES DE DEPRECIAÇÃO (RN09)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_depreciation_runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year              INT NOT NULL UNIQUE,
    run_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    run_by            UUID REFERENCES auth.users(id),
    triggered_by      VARCHAR(20) NOT NULL DEFAULT 'manual'
                      CHECK (triggered_by IN ('manual','cron')),
    items_processed   INT NOT NULL DEFAULT 0,
    items_written_off INT NOT NULL DEFAULT 0,
    total_value       NUMERIC(14,2) NOT NULL DEFAULT 0,
    status            VARCHAR(20) NOT NULL DEFAULT 'concluido'
                      CHECK (status IN ('concluido','falhou')),
    notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_inv_dep_year ON inv_depreciation_runs (year DESC);

-- =====================================================
-- 4. VIEWS REGULARES (sempre atuais)
-- =====================================================

-- 4.1 Consumo médio dos últimos 30 dias (§11.3)
CREATE OR REPLACE VIEW vw_inv_avg_daily_consumption AS
SELECT
    i.id                                AS item_id,
    i.name,
    i.internal_code,
    COALESCE(SUM(m.quantity), 0)        AS qty_consumed_30d,
    COALESCE(SUM(m.quantity), 0) / 30.0 AS avg_daily
FROM inv_items i
LEFT JOIN inv_movements m
       ON m.item_id = i.id
      AND m.type = 'saida'
      AND m.subtype = 'consumo'
      AND m.occurred_at >= NOW() - INTERVAL '30 days'
WHERE i.deleted_at IS NULL AND i.is_active = TRUE
GROUP BY i.id, i.name, i.internal_code;

-- 4.2 Stock total por item (denominador comum)
CREATE OR REPLACE VIEW vw_inv_total_stock AS
SELECT
    item_id,
    SUM(quantity) AS total_qty
FROM inv_stock
GROUP BY item_id;

-- 4.3 Ponto de reposição (§11.2 + §12.1)
CREATE OR REPLACE VIEW vw_inv_reorder_status AS
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

-- 4.4 Cobertura de stock em dias (§11.5 + §12.3)
CREATE OR REPLACE VIEW vw_inv_stock_coverage AS
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

-- 4.5 Valorização de stock (§12.4)
CREATE OR REPLACE VIEW vw_inv_valuation AS
SELECT
    i.id                                       AS item_id,
    i.internal_code,
    i.name,
    i.macro_category,
    cat.name                                   AS subcategory,
    u.name                                     AS unit_name,
    l.name                                     AS location_name,
    s.quantity,
    i.cmp,
    (s.quantity * i.cmp)                       AS line_value
FROM inv_stock s
JOIN inv_items i        ON i.id = s.item_id
LEFT JOIN inv_categories cat ON cat.id = i.subcategory_id
LEFT JOIN inv_locations l    ON l.id = s.location_id
LEFT JOIN inv_units u        ON u.id = l.unit_id
WHERE i.deleted_at IS NULL AND i.is_active = TRUE AND s.quantity > 0;

-- 4.6 Kardex — movimentos com saldo acumulado por item (§12.6)
CREATE OR REPLACE VIEW vw_inv_kardex AS
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
    fl.name             AS from_location,
    tl.name             AS to_location,
    lo.lot_number,
    m.justification,
    m.user_id,
    -- Saldo acumulado: entradas e transferencia_entrada/inventario somam;
    -- saídas e transferencia_saida subtraem; ajustes seguem o lado preenchido
    SUM(
        CASE
            WHEN m.type IN ('entrada','transferencia_entrada','depreciacao') THEN m.quantity
            WHEN m.type IN ('saida','transferencia_saida') THEN -m.quantity
            WHEN m.type = 'ajuste' AND m.to_location_id IS NOT NULL THEN m.quantity
            WHEN m.type = 'ajuste' AND m.from_location_id IS NOT NULL THEN -m.quantity
            WHEN m.type = 'inventario' AND m.to_location_id IS NOT NULL THEN m.quantity
            WHEN m.type = 'inventario' AND m.from_location_id IS NOT NULL THEN -m.quantity
            ELSE 0
        END
    ) OVER (PARTITION BY m.item_id ORDER BY m.occurred_at, m.created_at
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
FROM inv_movements m
JOIN inv_items i          ON i.id = m.item_id
LEFT JOIN inv_locations fl ON fl.id = m.from_location_id
LEFT JOIN inv_locations tl ON tl.id = m.to_location_id
LEFT JOIN inv_lots lo      ON lo.id = m.lot_id;

-- =====================================================
-- 5. MATERIALIZED VIEWS (refresh diário via pg_cron)
-- =====================================================

-- 5.1 Tendência mensal últimos 4 meses + mesmo período ano anterior (§11.4 + §12.7)
CREATE MATERIALIZED VIEW IF NOT EXISTS mvw_inv_consumption_trend AS
WITH series AS (
    SELECT
        i.id                              AS item_id,
        i.internal_code,
        i.name,
        DATE_TRUNC('month', m.occurred_at)::DATE AS month,
        SUM(m.quantity)                   AS qty
    FROM inv_items i
    LEFT JOIN inv_movements m
           ON m.item_id = i.id
          AND m.type = 'saida'
          AND m.subtype = 'consumo'
          AND m.occurred_at >= (DATE_TRUNC('month', NOW()) - INTERVAL '16 months')
    WHERE i.deleted_at IS NULL AND i.is_active = TRUE
    GROUP BY i.id, i.internal_code, i.name, DATE_TRUNC('month', m.occurred_at)
)
SELECT * FROM series WHERE month IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mvw_trend_item  ON mvw_inv_consumption_trend (item_id);
CREATE INDEX IF NOT EXISTS idx_mvw_trend_month ON mvw_inv_consumption_trend (month);

-- 5.2 Atividade por utilizador (§12.8) — refresh diário é suficiente
CREATE MATERIALIZED VIEW IF NOT EXISTS mvw_inv_user_activity AS
SELECT
    m.user_id,
    p.display_name,
    DATE_TRUNC('day', m.occurred_at)::DATE AS day,
    m.type,
    m.subtype,
    COUNT(*)             AS movement_count,
    SUM(m.quantity)      AS total_qty,
    SUM(m.total_cost)    AS total_value
FROM inv_movements m
LEFT JOIN user_profiles p ON p.id = m.user_id
WHERE m.occurred_at >= NOW() - INTERVAL '12 months'
GROUP BY m.user_id, p.display_name, DATE_TRUNC('day', m.occurred_at), m.type, m.subtype;

CREATE INDEX IF NOT EXISTS idx_mvw_user_user ON mvw_inv_user_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_mvw_user_day  ON mvw_inv_user_activity (day);

-- =====================================================
-- 6. FUNÇÕES — Sessão de Inventário Físico
-- =====================================================

-- 6.1 Abrir sessão: snapshot do stock esperado no momento
CREATE OR REPLACE FUNCTION fn_inv_open_session(
    p_location  UUID,
    p_user      UUID,
    p_notes     TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Trigger UNIQUE garante apenas 1 sessão aberta por localização
    INSERT INTO inv_inventory_sessions (location_id, opened_by, notes)
    VALUES (p_location, p_user, p_notes)
    RETURNING id INTO v_session_id;

    -- Popula contagens iniciais com snapshot do stock atual
    INSERT INTO inv_inventory_counts (session_id, item_id, lot_id, expected_qty)
    SELECT v_session_id, s.item_id, s.lot_id, s.quantity
      FROM inv_stock s
     WHERE s.location_id = p_location AND s.quantity > 0;

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- 6.2 Atualizar contagem de uma linha (operador conta na prática)
CREATE OR REPLACE FUNCTION fn_inv_update_count(
    p_count_id   UUID,
    p_counted    NUMERIC,
    p_notes      TEXT,
    p_user       UUID
) RETURNS VOID AS $$
DECLARE
    v_session_status VARCHAR;
BEGIN
    SELECT s.status INTO v_session_status
      FROM inv_inventory_sessions s
      JOIN inv_inventory_counts c ON c.session_id = s.id
     WHERE c.id = p_count_id;

    IF v_session_status IS NULL THEN
        RAISE EXCEPTION 'Linha de contagem não encontrada' USING ERRCODE = '02000';
    END IF;
    IF v_session_status <> 'em_contagem' THEN
        RAISE EXCEPTION 'Sessão já validada ou cancelada' USING ERRCODE = '22023';
    END IF;

    UPDATE inv_inventory_counts
       SET counted_qty = p_counted,
           notes       = COALESCE(p_notes, notes),
           counted_at  = NOW()
     WHERE id = p_count_id;
END;
$$ LANGUAGE plpgsql;

-- 6.3 Adicionar item à sessão (item que apareceu na contagem mas não tinha stock no sistema)
CREATE OR REPLACE FUNCTION fn_inv_add_count_line(
    p_session_id  UUID,
    p_item_id     UUID,
    p_lot_id      UUID,
    p_counted     NUMERIC,
    p_user        UUID
) RETURNS UUID AS $$
DECLARE
    v_count_id UUID;
BEGIN
    INSERT INTO inv_inventory_counts (session_id, item_id, lot_id, expected_qty, counted_qty, counted_at)
    VALUES (p_session_id, p_item_id, p_lot_id, 0, p_counted, NOW())
    RETURNING id INTO v_count_id;
    RETURN v_count_id;
END;
$$ LANGUAGE plpgsql;

-- 6.4 Validar sessão: gera ajustes em inv_movements para cada diferença
CREATE OR REPLACE FUNCTION fn_inv_close_session(
    p_session_id  UUID,
    p_user        UUID
) RETURNS INT AS $$
DECLARE
    v_session   inv_inventory_sessions%ROWTYPE;
    v_count     inv_inventory_counts%ROWTYPE;
    v_item      inv_items%ROWTYPE;
    v_movements INT := 0;
    v_new_stock NUMERIC;
BEGIN
    SELECT * INTO v_session FROM inv_inventory_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada' USING ERRCODE='02000'; END IF;
    IF v_session.status <> 'em_contagem' THEN
        RAISE EXCEPTION 'Sessão já está % — não pode validar', v_session.status USING ERRCODE='22023';
    END IF;

    FOR v_count IN
        SELECT * FROM inv_inventory_counts
         WHERE session_id = p_session_id AND counted_qty IS NOT NULL
           AND ABS(COALESCE(counted_qty,0) - expected_qty) > 0
    LOOP
        SELECT * INTO v_item FROM inv_items WHERE id = v_count.item_id;
        v_new_stock := v_count.counted_qty;

        -- Atualiza stock para o valor contado (UPSERT manual)
        IF v_count.lot_id IS NULL THEN
            UPDATE inv_stock SET quantity = v_new_stock, updated_at = NOW()
             WHERE item_id = v_count.item_id AND location_id = v_session.location_id AND lot_id IS NULL;
            IF NOT FOUND THEN
                INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
                VALUES (v_count.item_id, v_session.location_id, NULL, v_new_stock);
            END IF;
        ELSE
            UPDATE inv_stock SET quantity = v_new_stock, updated_at = NOW()
             WHERE item_id = v_count.item_id AND location_id = v_session.location_id AND lot_id = v_count.lot_id;
            IF NOT FOUND THEN
                INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
                VALUES (v_count.item_id, v_session.location_id, v_count.lot_id, v_new_stock);
            END IF;
        END IF;

        -- Grava movimento de inventário (sinal pelo from/to)
        INSERT INTO inv_movements (
            type, subtype, item_id, lot_id,
            from_location_id, to_location_id,
            quantity, unit_cost, total_cost, cmp_at_moment,
            justification, user_id
        ) VALUES (
            'inventario',
            'sessao_' || p_session_id::TEXT,
            v_count.item_id, v_count.lot_id,
            CASE WHEN v_count.difference < 0 THEN v_session.location_id ELSE NULL END,
            CASE WHEN v_count.difference > 0 THEN v_session.location_id ELSE NULL END,
            ABS(v_count.difference), v_item.cmp, ABS(v_count.difference) * v_item.cmp, v_item.cmp,
            'Ajuste por inventário físico — sessão ' || p_session_id::TEXT, p_user
        );
        v_movements := v_movements + 1;
    END LOOP;

    UPDATE inv_inventory_sessions
       SET status = 'validada', closed_at = NOW(), closed_by = p_user
     WHERE id = p_session_id;

    RETURN v_movements;
END;
$$ LANGUAGE plpgsql;

-- 6.5 Cancelar sessão (descarta sem gerar ajustes)
CREATE OR REPLACE FUNCTION fn_inv_cancel_session(
    p_session_id  UUID,
    p_user        UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE inv_inventory_sessions
       SET status = 'cancelada', closed_at = NOW(), closed_by = p_user
     WHERE id = p_session_id AND status = 'em_contagem';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sessão não pode ser cancelada (não existe ou já fechada)' USING ERRCODE='22023';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. FUNÇÃO — Depreciação Anual (RN09 automática)
-- =====================================================
CREATE OR REPLACE FUNCTION fn_inv_run_depreciation(
    p_year         INT,
    p_user         UUID DEFAULT NULL,
    p_triggered_by VARCHAR DEFAULT 'manual'
) RETURNS UUID AS $$
DECLARE
    v_run_id          UUID;
    v_item            inv_items%ROWTYPE;
    v_processed       INT := 0;
    v_written_off     INT := 0;
    v_total_value     NUMERIC := 0;
    v_dep_value       NUMERIC;
    v_new_value       NUMERIC;
BEGIN
    -- Detecta execução duplicada para o mesmo ano (RN09 — uma vez por ano)
    IF EXISTS (SELECT 1 FROM inv_depreciation_runs WHERE year = p_year) THEN
        RAISE EXCEPTION 'Depreciação para o ano % já foi executada (RN09)', p_year USING ERRCODE='23505';
    END IF;

    INSERT INTO inv_depreciation_runs (year, run_by, triggered_by, status)
    VALUES (p_year, p_user, p_triggered_by, 'concluido')
    RETURNING id INTO v_run_id;

    FOR v_item IN
        SELECT * FROM inv_items
         WHERE macro_category = 'patrimonial'
           AND deleted_at IS NULL
           AND asset_status = 'em_uso'
           AND depreciation_rate > 0
           AND acquisition_value > 0
    LOOP
        v_processed := v_processed + 1;
        v_dep_value := v_item.acquisition_value * (v_item.depreciation_rate / 100.0);
        v_new_value := GREATEST(v_item.cmp - v_dep_value, 0);
        v_total_value := v_total_value + v_dep_value;

        UPDATE inv_items SET cmp = v_new_value WHERE id = v_item.id;

        IF v_new_value = 0 THEN
            UPDATE inv_items SET asset_status = 'baixado' WHERE id = v_item.id;
            v_written_off := v_written_off + 1;
        END IF;

        -- Movimento auditável (1 unidade simbólica representando a baixa anual)
        INSERT INTO inv_movements (
            type, subtype, item_id, from_location_id, quantity,
            unit_cost, total_cost, cmp_at_moment, justification, user_id
        )
        SELECT 'depreciacao', 'anual', v_item.id, s.location_id, 0,
               v_dep_value, v_dep_value, v_new_value,
               'Depreciação anual ' || p_year::TEXT || ' — taxa ' || v_item.depreciation_rate || '%',
               p_user
          FROM inv_stock s
         WHERE s.item_id = v_item.id AND s.quantity > 0
         LIMIT 1;
    END LOOP;

    UPDATE inv_depreciation_runs
       SET items_processed   = v_processed,
           items_written_off = v_written_off,
           total_value       = v_total_value
     WHERE id = v_run_id;

    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. RLS para as tabelas novas
-- =====================================================
ALTER TABLE inv_inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_inventory_counts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_depreciation_runs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_sessions_select" ON inv_inventory_sessions;
CREATE POLICY "inv_sessions_select" ON inv_inventory_sessions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inv_counts_select" ON inv_inventory_counts;
CREATE POLICY "inv_counts_select" ON inv_inventory_counts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inv_dep_select" ON inv_depreciation_runs;
CREATE POLICY "inv_dep_select" ON inv_depreciation_runs FOR SELECT TO authenticated USING (true);

COMMIT;

-- =====================================================
-- 9. pg_cron jobs (executar APENAS UMA VEZ — fora da transação)
-- =====================================================
-- pré-requisito: extensão pg_cron habilitada no Supabase.
-- Se não estiver, descomente a linha abaixo (precisa privilégio superuser):
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Refresh diário das materialized views às 03h00 UTC
SELECT cron.schedule(
    'inv-refresh-mviews-daily',
    '0 3 * * *',
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_inv_consumption_trend;
      REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_inv_user_activity;$$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inv-refresh-mviews-daily');

-- Depreciação anual em 1 de janeiro às 04h00 UTC
SELECT cron.schedule(
    'inv-annual-depreciation',
    '0 4 1 1 *',
    $$SELECT fn_inv_run_depreciation(EXTRACT(YEAR FROM NOW())::INT, NULL, 'cron');$$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inv-annual-depreciation');

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'inv_inventory_sessions' AS objeto, COUNT(*)::TEXT AS valor FROM inv_inventory_sessions
UNION ALL SELECT 'inv_inventory_counts',   COUNT(*)::TEXT FROM inv_inventory_counts
UNION ALL SELECT 'inv_depreciation_runs',  COUNT(*)::TEXT FROM inv_depreciation_runs
UNION ALL SELECT 'items com prefixo SKU',  COUNT(*)::TEXT FROM inv_items WHERE internal_code LIKE 'SKU%'
UNION ALL SELECT 'next SKU number',        currval('seq_inv_sku')::TEXT;
