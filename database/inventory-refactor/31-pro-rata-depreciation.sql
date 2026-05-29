-- =====================================================
-- INVENTORY REFACTOR — Sprint 4A.1
-- Depreciação Pro Rata Temporis (RN09 refinada)
-- =====================================================
-- Reescreve fn_inv_run_depreciation para calcular depreciação
-- proporcional aos meses restantes no ano de aquisição.
--
-- Regras:
--   • Ano de aquisição > ano da execução: pula (data futura)
--   • Ano de aquisição = ano da execução: depreciação proporcional
--     = taxa × (meses_restantes_no_ano / 12)
--     incluindo o mês de aquisição (ex.: maio = 8 meses até dezembro)
--   • Ano de aquisição < ano da execução: depreciação cheia
--   • Item sem acquisition_date: depreciação cheia (compatível)
-- =====================================================

BEGIN;

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
    v_acq_year        INT;
    v_acq_month       INT;
    v_proration       NUMERIC;
BEGIN
    -- RN09: uma vez por ano
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
        v_acq_year  := COALESCE(EXTRACT(YEAR  FROM v_item.acquisition_date)::INT, p_year - 1);
        v_acq_month := COALESCE(EXTRACT(MONTH FROM v_item.acquisition_date)::INT, 1);

        -- Bem ainda não foi adquirido neste ano (data de aquisição futura)
        IF v_acq_year > p_year THEN
            CONTINUE;
        END IF;

        -- Pro rata: ano de aquisição = ano da execução
        IF v_acq_year = p_year THEN
            -- Meses restantes do ano contando a partir do mês de aquisição
            v_proration := (13 - v_acq_month) / 12.0;
        ELSE
            v_proration := 1.0;
        END IF;

        v_processed := v_processed + 1;
        v_dep_value := v_item.acquisition_value * (v_item.depreciation_rate / 100.0) * v_proration;
        v_new_value := GREATEST(v_item.cmp - v_dep_value, 0);
        v_total_value := v_total_value + v_dep_value;

        UPDATE inv_items SET cmp = v_new_value WHERE id = v_item.id;

        IF v_new_value = 0 THEN
            UPDATE inv_items SET asset_status = 'baixado' WHERE id = v_item.id;
            v_written_off := v_written_off + 1;
        END IF;

        -- Movimento auditável (qty=0 simbólico, valor financeiro vai em unit_cost/total_cost)
        INSERT INTO inv_movements (
            type, subtype, item_id, from_location_id, quantity,
            unit_cost, total_cost, cmp_at_moment, justification, user_id
        )
        SELECT 'depreciacao', 'anual', v_item.id, s.location_id, 0,
               v_dep_value, v_dep_value, v_new_value,
               'Depreciação anual ' || p_year::TEXT
                 || ' — taxa ' || v_item.depreciation_rate || '%'
                 || (CASE WHEN v_proration < 1
                          THEN ' (pro rata: ' || ROUND(v_proration * 100, 1) || '%, adq. ' || v_item.acquisition_date::TEXT || ')'
                          ELSE '' END),
               p_user
          FROM inv_stock s
         WHERE s.item_id = v_item.id AND s.quantity > 0
         LIMIT 1;

        -- Se o item não tem stock (entrada ainda não foi lançada), grava o movimento
        -- com from_location_id NULL como fallback
        IF NOT EXISTS (SELECT 1 FROM inv_stock WHERE item_id = v_item.id AND quantity > 0) THEN
            INSERT INTO inv_movements (
                type, subtype, item_id, quantity,
                unit_cost, total_cost, cmp_at_moment, justification, user_id
            ) VALUES (
                'depreciacao', 'anual', v_item.id, 0,
                v_dep_value, v_dep_value, v_new_value,
                'Depreciação anual ' || p_year::TEXT
                  || ' — taxa ' || v_item.depreciation_rate || '%'
                  || (CASE WHEN v_proration < 1
                           THEN ' (pro rata: ' || ROUND(v_proration * 100, 1) || '%, adq. ' || v_item.acquisition_date::TEXT || ')'
                           ELSE '' END)
                  || ' [sem stock — registro contábil]',
                p_user
            );
        END IF;
    END LOOP;

    UPDATE inv_depreciation_runs
       SET items_processed   = v_processed,
           items_written_off = v_written_off,
           total_value       = v_total_value
     WHERE id = v_run_id;

    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Exemplo: item adquirido em 01/05/2026, valor €500, taxa 20%, executando 2026:
--   meses restantes = 13 - 5 = 8 meses
--   proration = 8 / 12 = 0.6667
--   depreciação = 500 × 0.20 × 0.6667 = €66,67
SELECT pg_get_functiondef('fn_inv_run_depreciation'::regproc);
