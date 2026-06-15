-- =====================================================
-- INVENTORY REFACTOR — 110. Patrimônio: unidades por número de série
--                            + colaborador nas movimentações
-- =====================================================
-- Fase 2 do épico Patrimônio. Introduz o controle por NÚMERO DE SÉRIE:
-- cada unidade física de um item patrimonial (ex.: "Macbook Air v2025")
-- é uma linha em inv_serial_units — identificável, com localização e
-- colaborador atuais, valor de aquisição e estado (em_uso/inativo/baixado).
--
-- Decisões (confirmadas com o cliente):
--   • Patrimônio NÃO usa inv_stock — as unidades em inv_serial_units SÃO o
--     "stock" (cada unidade = 1 ativo). Consumo continua em inv_stock/lotes.
--   • Número de série único POR PRODUTO (item_id, serial_number).
--   • Colaborador = funcionário do RH (rh_employees), fonte única.
--   • inv_movements ganha serial_unit_id + from/to_employee_id. A Fase 2 usa
--     na entrada (1 movimento 'entrada' por unidade); movimentação (Fase 3) e
--     baixa (Fase 4) reaproveitam as mesmas colunas.
--
-- REQUER MIGRAÇÃO MANUAL. Aplicar UMA VEZ. Idempotente.
-- =====================================================

BEGIN;

-- ---------- 1) Tabela de unidades por número de série ----------
CREATE TABLE IF NOT EXISTS inv_serial_units (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id             UUID NOT NULL REFERENCES inv_items(id) ON DELETE RESTRICT,
    serial_number       VARCHAR(120) NOT NULL,

    -- Aquisição (por unidade — base p/ depreciação por unidade na Fase 6)
    acquisition_date    DATE,
    acquisition_value   NUMERIC(14,2) CHECK (acquisition_value IS NULL OR acquisition_value >= 0),
    supplier_id         UUID REFERENCES inv_suppliers(id),
    acquisition_doc     VARCHAR(80),

    -- Localização e colaborador ATUAIS (o "onde está / com quem está")
    current_location_id UUID REFERENCES inv_locations(id),
    current_holder_id   UUID REFERENCES rh_employees(id),

    -- Ciclo de vida do ativo
    status              VARCHAR(20) NOT NULL DEFAULT 'em_uso'
                        CHECK (status IN ('em_uso','inativo','baixado')),
    write_off_reason    TEXT,
    write_off_date      DATE,

    -- Auditoria
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES auth.users(id),
    updated_by          UUID REFERENCES auth.users(id)
);

-- Número de série único por produto (o mesmo NS pode existir em produtos
-- diferentes, mas não repetir dentro do mesmo item). Ignora soft-deleted.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_serial_units_item_serial
    ON inv_serial_units (item_id, serial_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inv_serial_units_item     ON inv_serial_units (item_id)             WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_serial_units_location ON inv_serial_units (current_location_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_serial_units_holder   ON inv_serial_units (current_holder_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_serial_units_status   ON inv_serial_units (status)              WHERE deleted_at IS NULL;

-- updated_at automático (reusa a função do módulo)
DROP TRIGGER IF EXISTS tg_inv_serial_units_updated ON inv_serial_units;
CREATE TRIGGER tg_inv_serial_units_updated BEFORE UPDATE ON inv_serial_units
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

-- RLS: leitura para utilizadores do inventário; escrita só via service role
-- (mesma política das demais tabelas inv_*, ver 03-rls-defense-in-depth.sql).
ALTER TABLE inv_serial_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inv_serial_units_inventory_user_select ON inv_serial_units;
CREATE POLICY inv_serial_units_inventory_user_select ON inv_serial_units
    FOR SELECT TO authenticated USING (public.fn_inv_user_can_access());

-- ---------- 2) Movimentações: número de série + colaborador ----------
-- A movimentação de patrimônio pode ter origem/destino como localização
-- E/OU colaborador. serial_unit_id liga o movimento à unidade física.
ALTER TABLE inv_movements
    ADD COLUMN IF NOT EXISTS serial_unit_id   UUID REFERENCES inv_serial_units(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS from_employee_id UUID REFERENCES rh_employees(id),
    ADD COLUMN IF NOT EXISTS to_employee_id   UUID REFERENCES rh_employees(id);

CREATE INDEX IF NOT EXISTS idx_inv_mov_serial_unit ON inv_movements (serial_unit_id) WHERE serial_unit_id IS NOT NULL;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- 1) Tabela existe e está vazia
SELECT 'inv_serial_units' AS tabela, count(*) AS linhas FROM inv_serial_units;

-- 2) Colunas novas em inv_movements
SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'inv_movements'
   AND column_name IN ('serial_unit_id','from_employee_id','to_employee_id')
 ORDER BY column_name;

-- 3) RLS ligado
SELECT relname, relrowsecurity
  FROM pg_class
 WHERE relname = 'inv_serial_units';
