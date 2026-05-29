-- =====================================================
-- INVENTORY REFACTOR — Sprint 4C
-- Log de acesso (§17) + janela de consumo por categoria (§11.3)
-- =====================================================
-- Endereça gaps 2 e 6 da auditoria:
--   • inv_access_log: registra mutações + leituras sensíveis
--   • inv_system_settings: configuração (retenção do log)
--   • inv_categories.consumption_window_days: janela ajustável (30/90)
--   • Atualiza vw_inv_avg_daily_consumption e dependentes
--   • pg_cron mensal: purga registos de log > retenção configurada
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CONFIGURAÇÕES DO SISTEMA (key/value)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_system_settings (
    key          VARCHAR(60) PRIMARY KEY,
    value        TEXT NOT NULL,
    description  TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by   UUID REFERENCES auth.users(id)
);

INSERT INTO inv_system_settings (key, value, description) VALUES
    ('access_log_retention_months', '24', 'Meses para manter registos em inv_access_log (purga mensal via cron)')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE inv_system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_settings_select" ON inv_system_settings;
CREATE POLICY "inv_settings_select" ON inv_system_settings FOR SELECT TO authenticated USING (true);

-- =====================================================
-- 2. LOG DE ACESSO (§17)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_access_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES auth.users(id),
    ip            INET,
    user_agent    TEXT,
    method        VARCHAR(10) NOT NULL,
    path          VARCHAR(300) NOT NULL,
    entity_type   VARCHAR(40),     -- inferido do path (items, entries, …)
    entity_id     VARCHAR(80),     -- UUID/SKU da entidade afetada quando aplicável
    status_code   INT,
    duration_ms   INT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_log_user    ON inv_access_log (user_id);
CREATE INDEX IF NOT EXISTS idx_inv_log_method  ON inv_access_log (method);
CREATE INDEX IF NOT EXISTS idx_inv_log_entity  ON inv_access_log (entity_type);
CREATE INDEX IF NOT EXISTS idx_inv_log_created ON inv_access_log (created_at DESC);

ALTER TABLE inv_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_log_select" ON inv_access_log;
CREATE POLICY "inv_log_select" ON inv_access_log FOR SELECT TO authenticated USING (true);

-- =====================================================
-- 3. JANELA DE CONSUMO POR CATEGORIA (§11.3)
-- =====================================================
ALTER TABLE inv_categories
    ADD COLUMN IF NOT EXISTS consumption_window_days INT NOT NULL DEFAULT 30
    CHECK (consumption_window_days IN (30, 60, 90, 180, 365));

COMMENT ON COLUMN inv_categories.consumption_window_days IS
    'Janela em dias para cálculo do consumo médio (§11.3). 30 default, 90 recomendado para sazonais.';

-- =====================================================
-- 4. ATUALIZAR VIEWS PARA USAR A JANELA DA CATEGORIA
-- =====================================================
-- vw_inv_avg_daily_consumption agora respeita a janela da subcategoria
-- (fallback 30 dias quando item não tem subcategoria atribuída).
CREATE OR REPLACE VIEW vw_inv_avg_daily_consumption AS
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

-- =====================================================
-- 5. pg_cron — purga mensal do log conforme retenção configurada
-- =====================================================
-- A função é chamada pelo cron e lê o valor de inv_system_settings.
CREATE OR REPLACE FUNCTION fn_inv_purge_access_log()
RETURNS INT AS $$
DECLARE
    v_months INT;
    v_deleted INT;
BEGIN
    SELECT COALESCE(value::INT, 24) INTO v_months
      FROM inv_system_settings WHERE key = 'access_log_retention_months';

    DELETE FROM inv_access_log
     WHERE created_at < NOW() - (v_months || ' months')::INTERVAL;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- 6. AGENDAR CRON (fora da transação)
-- =====================================================
SELECT cron.schedule(
    'inv-purge-access-log-monthly',
    '0 2 1 * *',   -- dia 1 de cada mês às 02h00
    $$SELECT fn_inv_purge_access_log();$$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inv-purge-access-log-monthly');

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'inv_system_settings'  AS objeto, COUNT(*)::TEXT AS valor FROM inv_system_settings
UNION ALL SELECT 'inv_access_log',        COUNT(*)::TEXT FROM inv_access_log
UNION ALL SELECT 'categorias com janela diferente de 30',
                  COUNT(*)::TEXT FROM inv_categories WHERE consumption_window_days <> 30;
