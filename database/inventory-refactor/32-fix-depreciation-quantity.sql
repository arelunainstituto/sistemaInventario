-- =====================================================
-- INVENTORY REFACTOR — Fix
-- Quantity > 0 em movimentos de depreciação
-- =====================================================
-- inv_movements.quantity tem CHECK (quantity > 0). A função de
-- depreciação estava inserindo quantity = 0 (apenas o valor financeiro
-- importava). Trocamos para quantity = 1 (uma unidade patrimonial,
-- simbólico), preservando unit_cost/total_cost como o valor depreciado.
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

        IF v_acq_year > p_year THEN CONTINUE; END IF;

        IF v_acq_year = p_year THEN
            v_proration := (13 - v_acq_month) / 12.0;
        ELSE
            v_proration := 1.0;
        END IF;

        v_processed   := v_processed + 1;
        v_dep_value   := v_item.acquisition_value * (v_item.depreciation_rate / 100.0) * v_proration;
        v_new_value   := GREATEST(v_item.cmp - v_dep_value, 0);
        v_total_value := v_total_value + v_dep_value;

        UPDATE inv_items SET cmp = v_new_value WHERE id = v_item.id;

        IF v_new_value = 0 THEN
            UPDATE inv_items SET asset_status = 'baixado' WHERE id = v_item.id;
            v_written_off := v_written_off + 1;
        END IF;

        -- quantity = 1 (uma unidade patrimonial simbólica) para satisfazer
        -- CHECK (quantity > 0). O valor financeiro vai em unit_cost/total_cost.
        IF EXISTS (SELECT 1 FROM inv_stock WHERE item_id = v_item.id AND quantity > 0) THEN
            INSERT INTO inv_movements (
                type, subtype, item_id, from_location_id, quantity,
                unit_cost, total_cost, cmp_at_moment, justification, user_id
            )
            SELECT 'depreciacao', 'anual', v_item.id, s.location_id, 1,
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
        ELSE
            -- Fallback: item sem stock (entrada ainda não foi lançada)
            INSERT INTO inv_movements (
                type, subtype, item_id, quantity,
                unit_cost, total_cost, cmp_at_moment, justification, user_id
            ) VALUES (
                'depreciacao', 'anual', v_item.id, 1,
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

-- Limpa o registro órfão (run criado mas que falhou no INSERT do movimento)
-- antes de tentar reexecutar:
-- DELETE FROM inv_depreciation_runs WHERE year = 2026;
