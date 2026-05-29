-- =====================================================
-- INVENTORY REFACTOR — Finalize Sprint 4C
-- =====================================================
-- O 40-sprint4c-log-window.sql abortou no CREATE OR REPLACE VIEW
-- (corrigido em 41). Como tudo estava dentro de BEGIN/COMMIT, nem
-- inv_access_log nem inv_system_settings foram criadas.
--
-- Este script cria APENAS as partes pendentes:
--   • inv_system_settings + seed
--   • inv_access_log + RLS + índices
--   • fn_inv_purge_access_log
--   • pg_cron schedule
--
-- Idempotente. Pode ser executado mais de uma vez sem efeitos colaterais.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CONFIGURAÇÕES DO SISTEMA
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
    entity_type   VARCHAR(40),
    entity_id     VARCHAR(80),
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
-- 3. FUNÇÃO DE PURGA
-- =====================================================
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
-- 4. AGENDAR CRON (fora da transação)
-- =====================================================
SELECT cron.schedule(
    'inv-purge-access-log-monthly',
    '0 2 1 * *',
    $$SELECT fn_inv_purge_access_log();$$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inv-purge-access-log-monthly');

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'inv_system_settings'             AS objeto, COUNT(*)::TEXT AS valor FROM inv_system_settings
UNION ALL SELECT 'inv_access_log existe', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inv_access_log') THEN 'sim' ELSE 'NÃO' END
UNION ALL SELECT 'cron job agendado',     CASE WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inv-purge-access-log-monthly') THEN 'sim' ELSE 'NÃO (pg_cron desativado?)' END;
