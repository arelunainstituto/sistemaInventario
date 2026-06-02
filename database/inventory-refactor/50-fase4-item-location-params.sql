-- =====================================================
-- INVENTORY REFACTOR — Fase 4.1
-- Parâmetros de stock por (item, localização) com fallback
-- =====================================================
-- Motivação:
--   Hoje, inv_items tem min_stock/max_stock/lead_time_days/reorder_point/
--   avg_daily_consumption como colunas GLOBAIS. Isso não funciona quando o
--   Cristal e o Marquês têm perfis de consumo diferentes para o mesmo item.
--   Esta migração adiciona uma camada de override por localização SEM
--   remover os campos globais — eles continuam servindo como DEFAULT.
--
-- Hierarquia de resolução do parâmetro efetivo:
--   location_override > item_global > sistema_default
--
-- Janela de consumo: location_override > category > 30
--
-- Estratégia de deploy:
--   - Esta migração é PURAMENTE ADITIVA: cria tabela vazia, trigger e view.
--   - O sistema continua usando inv_items.* (não há mudança de comportamento).
--   - Fase 4.2 (próxima) refatora as views/funções para passarem a ler
--     da nova view vw_inv_item_effective_params.
--
-- Idempotente, reversível (DROP TABLE/VIEW).
-- =====================================================

BEGIN;

-- ---------- 1) Tabela inv_item_location_params ----------

CREATE TABLE IF NOT EXISTS inv_item_location_params (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id                  UUID NOT NULL REFERENCES inv_items(id)     ON DELETE CASCADE,
    location_id              UUID NOT NULL REFERENCES inv_locations(id) ON DELETE RESTRICT,

    -- Parâmetros: TODOS nullable. NULL significa "herdar do item global".
    min_stock                NUMERIC(14,4) CHECK (min_stock IS NULL OR min_stock >= 0),
    max_stock                NUMERIC(14,4) CHECK (max_stock IS NULL OR max_stock >= 0),
    lead_time_days           INTEGER       CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
    reorder_point            NUMERIC(14,4) CHECK (reorder_point IS NULL OR reorder_point >= 0),
    consumption_window_days  INTEGER       CHECK (consumption_window_days IS NULL OR consumption_window_days IN (30, 60, 90, 180, 365)),

    -- Reservado para Fase 5 (auto-cálculo). Por ora apenas marcador.
    auto_calculated          BOOLEAN NOT NULL DEFAULT FALSE,
    last_calculated_at       TIMESTAMPTZ,
    notes                    TEXT,

    -- Audit (RN10)
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by               UUID,
    updated_by               UUID,
    deleted_at               TIMESTAMPTZ,

    -- max >= min quando ambos definidos
    CONSTRAINT chk_ilp_max_gte_min CHECK (
        max_stock IS NULL OR min_stock IS NULL OR max_stock >= min_stock
    )
);

COMMENT ON TABLE inv_item_location_params IS
'Overrides de parâmetros de stock por (item, localização). NULL em qualquer '
'parâmetro significa "herdar do item global" (inv_items.<campo>). Apenas '
'itens com macro_category=consumo podem ter overrides — garantido por trigger.';

-- ---------- 2) Índices ----------

CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_item_loc_params
    ON inv_item_location_params (item_id, location_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inv_item_loc_params_loc
    ON inv_item_location_params (location_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inv_item_loc_params_item
    ON inv_item_location_params (item_id)
    WHERE deleted_at IS NULL;

-- ---------- 3) Triggers ----------

-- 3.1 updated_at automático (reaproveita fn_inv_set_updated_at de 10-fase1…)
DROP TRIGGER IF EXISTS tg_inv_ilp_updated ON inv_item_location_params;
CREATE TRIGGER tg_inv_ilp_updated
    BEFORE UPDATE ON inv_item_location_params
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

-- 3.2 Bloqueia overrides para itens patrimoniais (regra do gestor)
CREATE OR REPLACE FUNCTION fn_inv_ilp_check_macro()
RETURNS TRIGGER AS $$
DECLARE
    v_macro TEXT;
BEGIN
    SELECT macro_category INTO v_macro FROM inv_items WHERE id = NEW.item_id;
    IF v_macro IS NULL THEN
        RAISE EXCEPTION 'Item % não encontrado', NEW.item_id USING ERRCODE = '02000';
    END IF;
    IF v_macro <> 'consumo' THEN
        RAISE EXCEPTION 'Overrides de parâmetros por localização são suportados apenas para itens de consumo (item % é %)', NEW.item_id, v_macro
            USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_inv_ilp_check_macro ON inv_item_location_params;
CREATE TRIGGER tg_inv_ilp_check_macro
    BEFORE INSERT OR UPDATE OF item_id ON inv_item_location_params
    FOR EACH ROW EXECUTE FUNCTION fn_inv_ilp_check_macro();

-- ---------- 4) RLS ----------

ALTER TABLE inv_item_location_params ENABLE ROW LEVEL SECURITY;

-- Reaproveita o helper de defense-in-depth da migração 03
DROP POLICY IF EXISTS inv_item_location_params_inventory_user_select ON inv_item_location_params;
CREATE POLICY inv_item_location_params_inventory_user_select
    ON inv_item_location_params FOR SELECT TO authenticated
    USING (public.fn_inv_user_can_access());

-- ---------- 5) View de resolução do parâmetro efetivo ----------
--
-- Para cada (item consumo ativo × location ativa que pode receber/enviar),
-- devolve o parâmetro efetivo após COALESCE com:
--   location_override → item_global → category_default → null/0
--
-- Colunas:
--   item_id, location_id, item_name, location_name, unit_name,
--   min_stock, max_stock, lead_time_days, reorder_point, consumption_window_days,
--   is_override (TRUE se há ao menos um campo overridden para esse par),
--   source_<campo> ('location' | 'item' | 'category' | 'default')

CREATE OR REPLACE VIEW vw_inv_item_effective_params AS
SELECT
    i.id                                           AS item_id,
    l.id                                           AS location_id,
    i.name                                         AS item_name,
    i.internal_code,
    l.name                                         AS location_name,
    u.name                                         AS unit_name,
    i.subcategory_id,

    -- min_stock: override > item global > 0
    COALESCE(p.min_stock, i.min_stock, 0)          AS min_stock,
    CASE
        WHEN p.min_stock IS NOT NULL THEN 'location'
        WHEN i.min_stock IS NOT NULL THEN 'item'
        ELSE                              'default'
    END                                            AS source_min_stock,

    -- max_stock: override > item global > NULL
    COALESCE(p.max_stock, i.max_stock)             AS max_stock,
    CASE
        WHEN p.max_stock IS NOT NULL THEN 'location'
        WHEN i.max_stock IS NOT NULL THEN 'item'
        ELSE                              'default'
    END                                            AS source_max_stock,

    -- lead_time_days: override > item global > 0
    COALESCE(p.lead_time_days, i.lead_time_days, 0) AS lead_time_days,
    CASE
        WHEN p.lead_time_days IS NOT NULL THEN 'location'
        WHEN i.lead_time_days IS NOT NULL THEN 'item'
        ELSE                                   'default'
    END                                            AS source_lead_time_days,

    -- reorder_point: override > item global > min_stock efetivo
    COALESCE(p.reorder_point, i.reorder_point, COALESCE(p.min_stock, i.min_stock, 0)) AS reorder_point,
    CASE
        WHEN p.reorder_point IS NOT NULL THEN 'location'
        WHEN i.reorder_point IS NOT NULL THEN 'item'
        ELSE                                  'default'
    END                                            AS source_reorder_point,

    -- consumption_window_days: override > category > 30
    COALESCE(p.consumption_window_days, c.consumption_window_days, 30) AS consumption_window_days,
    CASE
        WHEN p.consumption_window_days IS NOT NULL THEN 'location'
        WHEN c.consumption_window_days IS NOT NULL THEN 'category'
        ELSE                                            'default'
    END                                            AS source_window_days,

    -- Flag agregada: há ao menos um override para esse par
    (p.id IS NOT NULL)                             AS is_override,
    p.auto_calculated,
    p.last_calculated_at,
    p.notes                                        AS override_notes

FROM       inv_items     i
CROSS JOIN inv_locations l
LEFT JOIN  inv_units     u  ON u.id = l.unit_id
LEFT JOIN  inv_categories c ON c.id = i.subcategory_id
LEFT JOIN  inv_item_location_params p
       ON  p.item_id     = i.id
       AND p.location_id = l.id
       AND p.deleted_at IS NULL
WHERE i.macro_category = 'consumo'
  AND i.is_active = TRUE
  AND i.deleted_at IS NULL
  AND l.is_active = TRUE
  AND l.deleted_at IS NULL;

COMMENT ON VIEW vw_inv_item_effective_params IS
'Parâmetro efetivo de stock para cada par (item consumo × location ativa). '
'Aplica COALESCE: location_override → item_global → category/default. Source '
'columns indicam de onde veio cada valor (location/item/category/default).';

COMMIT;

-- =====================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- =====================================================

-- 1) Tabela criada e vazia
SELECT 'inv_item_location_params' AS table, COUNT(*) AS rows FROM inv_item_location_params;
-- Esperado: 0 rows

-- 2) View retorna 1 linha por (item consumo ativo × location ativa)
SELECT 'item_consumo_ativo' AS metric,
       (SELECT COUNT(*) FROM inv_items WHERE macro_category='consumo' AND is_active AND deleted_at IS NULL) AS qty
UNION ALL
SELECT 'location_ativa',
       (SELECT COUNT(*) FROM inv_locations WHERE is_active AND deleted_at IS NULL)
UNION ALL
SELECT 'cartesian_esperado',
       (SELECT COUNT(*) FROM inv_items WHERE macro_category='consumo' AND is_active AND deleted_at IS NULL)
       * (SELECT COUNT(*) FROM inv_locations WHERE is_active AND deleted_at IS NULL)
UNION ALL
SELECT 'view_real', COUNT(*) FROM vw_inv_item_effective_params;
-- Esperado: cartesian_esperado == view_real

-- 3) Sem overrides, todos os parâmetros devem vir do item ou default
SELECT
    COUNT(*) FILTER (WHERE source_min_stock      = 'location') AS overrides_min,
    COUNT(*) FILTER (WHERE source_max_stock      = 'location') AS overrides_max,
    COUNT(*) FILTER (WHERE source_lead_time_days = 'location') AS overrides_lead,
    COUNT(*) FILTER (WHERE source_window_days    = 'location') AS overrides_window
FROM vw_inv_item_effective_params;
-- Esperado: tudo 0 (nenhum override ainda)

-- 4) Teste do bloqueio para patrimoniais (rodar manualmente)
-- DO $$
-- DECLARE v_pat_id UUID; v_loc_id UUID;
-- BEGIN
--     SELECT id INTO v_pat_id FROM inv_items WHERE macro_category='patrimonial' LIMIT 1;
--     SELECT id INTO v_loc_id FROM inv_locations  WHERE is_active LIMIT 1;
--     INSERT INTO inv_item_location_params (item_id, location_id, min_stock)
--     VALUES (v_pat_id, v_loc_id, 1);
-- END $$;
-- Esperado: ERROR 22023 'Overrides … apenas para itens de consumo'

-- 5) Teste de inserção válida + leitura via view (rodar manualmente)
-- INSERT INTO inv_item_location_params (item_id, location_id, min_stock)
-- VALUES (
--     (SELECT id FROM inv_items WHERE macro_category='consumo' LIMIT 1),
--     (SELECT id FROM inv_locations WHERE is_active LIMIT 1),
--     999
-- );
-- SELECT item_id, location_id, min_stock, source_min_stock, is_override
--   FROM vw_inv_item_effective_params
--  WHERE is_override = TRUE;
-- Esperado: 1 linha com min_stock=999 e source_min_stock='location'
