-- =====================================================
-- INVENTORY REFACTOR — 111. Patrimônio: depreciação POR UNIDADE
-- =====================================================
-- Fase 6 do épico Patrimônio. Move a depreciação do nível do ITEM (modelo)
-- para o nível da UNIDADE (cada número de série):
--   • A TAXA de depreciação continua no item (propriedade do modelo, ex.:
--     "Macbook deprecia 20%/ano").
--   • O VALOR DE AQUISIÇÃO, a DATA e o VALOR CONTÁBIL (book_value) são da
--     UNIDADE — cada bem físico deprecia conforme a própria aquisição.
--
-- fn_inv_run_depreciation passa a iterar inv_serial_units (status='em_uso'),
-- pro-rata pela data de aquisição da unidade, reduz o book_value da unidade,
-- baixa a unidade quando zera e grava um movimento 'depreciacao' por unidade
-- (com serial_unit_id). A API (POST /depreciation/run) e a tela continuam iguais
-- — a mudança é transparente (run.items_processed agora conta UNIDADES).
--
-- REQUER MIGRAÇÃO MANUAL. Aplicar APÓS 110-patrimonio-serie.sql. Idempotente.
-- =====================================================

BEGIN;

-- ---------- 1) Valor contábil por unidade ----------
ALTER TABLE inv_serial_units
    ADD COLUMN IF NOT EXISTS book_value NUMERIC(14,2)
        CHECK (book_value IS NULL OR book_value >= 0);

-- Inicializa o valor contábil das unidades existentes com o valor de aquisição
-- (unidades novas recebem book_value na entrada — ver api/inventory/patrimony.js).
UPDATE inv_serial_units
   SET book_value = acquisition_value
 WHERE book_value IS NULL AND acquisition_value IS NOT NULL;

-- ---------- 2) Depreciação por unidade ----------
CREATE OR REPLACE FUNCTION fn_inv_run_depreciation(
    p_year         INT,
    p_user         UUID DEFAULT NULL,
    p_triggered_by VARCHAR DEFAULT 'manual'
) RETURNS UUID AS $$
DECLARE
    v_run_id      UUID;
    v_u           RECORD;
    v_processed   INT := 0;
    v_written_off INT := 0;
    v_total_value NUMERIC := 0;
    v_dep_value   NUMERIC;   -- depreciação linear calculada
    v_old_value   NUMERIC;   -- valor contábil antes
    v_new_value   NUMERIC;   -- valor contábil depois (>= 0)
    v_actual      NUMERIC;   -- redução efetiva (clampada)
    v_acq_year    INT;
    v_acq_month   INT;
    v_proration   NUMERIC;
BEGIN
    -- RN09: uma vez por ano
    IF EXISTS (SELECT 1 FROM inv_depreciation_runs WHERE year = p_year) THEN
        RAISE EXCEPTION 'Depreciação para o ano % já foi executada (RN09)', p_year USING ERRCODE='23505';
    END IF;

    INSERT INTO inv_depreciation_runs (year, run_by, triggered_by, status)
    VALUES (p_year, p_user, p_triggered_by, 'concluido')
    RETURNING id INTO v_run_id;

    -- Itera UNIDADES patrimoniais em uso. Taxa vem do item (modelo); valor de
    -- aquisição/data e valor contábil vêm da unidade.
    FOR v_u IN
        SELECT su.id, su.item_id, su.acquisition_date, su.acquisition_value,
               su.book_value, su.current_location_id, i.depreciation_rate
          FROM inv_serial_units su
          JOIN inv_items i ON i.id = su.item_id
         WHERE su.deleted_at IS NULL
           AND su.status = 'em_uso'
           AND i.depreciation_rate > 0
           AND su.acquisition_value > 0
    LOOP
        v_acq_year  := COALESCE(EXTRACT(YEAR  FROM v_u.acquisition_date)::INT, p_year - 1);
        v_acq_month := COALESCE(EXTRACT(MONTH FROM v_u.acquisition_date)::INT, 1);

        -- Unidade ainda não adquirida neste ano (data futura)
        IF v_acq_year > p_year THEN CONTINUE; END IF;

        -- Pro rata no ano de aquisição (inclui o mês de aquisição)
        IF v_acq_year = p_year THEN
            v_proration := (13 - v_acq_month) / 12.0;
        ELSE
            v_proration := 1.0;
        END IF;

        v_dep_value := v_u.acquisition_value * (v_u.depreciation_rate / 100.0) * v_proration;
        v_old_value := COALESCE(v_u.book_value, v_u.acquisition_value);
        v_new_value := GREATEST(v_old_value - v_dep_value, 0);
        v_actual    := v_old_value - v_new_value;   -- redução efetiva (não passa de 0)

        v_processed   := v_processed + 1;
        v_total_value := v_total_value + v_actual;

        UPDATE inv_serial_units SET book_value = v_new_value WHERE id = v_u.id;

        IF v_new_value = 0 THEN
            UPDATE inv_serial_units
               SET status           = 'baixado',
                   write_off_reason = COALESCE(write_off_reason, 'Totalmente depreciado em ' || p_year::TEXT),
                   write_off_date   = COALESCE(write_off_date, make_date(p_year, 12, 31))
             WHERE id = v_u.id;
            v_written_off := v_written_off + 1;
        END IF;

        -- Movimento auditável por unidade (quantity=1 p/ CHECK quantity>0; o
        -- valor financeiro vai em unit_cost/total_cost).
        -- Quando a unidade zera o valor contábil, o movimento usa subtype='baixa'
        -- para que a baixa por depreciação total apareça no histórico de Baixas
        -- (mesma lista da baixa manual), em vez de só na história da unidade.
        INSERT INTO inv_movements (
            type, subtype, item_id, serial_unit_id, from_location_id, quantity,
            unit_cost, total_cost, cmp_at_moment, justification, user_id
        ) VALUES (
            'depreciacao',
            CASE WHEN v_new_value = 0 THEN 'baixa' ELSE 'anual' END,
            v_u.item_id, v_u.id, v_u.current_location_id, 1,
            v_actual, v_actual, v_new_value,
            'Depreciação anual ' || p_year::TEXT || ' — taxa ' || v_u.depreciation_rate || '%'
              || (CASE WHEN v_proration < 1
                       THEN ' (pro rata: ' || ROUND(v_proration * 100, 1) || '%, adq. ' || v_u.acquisition_date::TEXT || ')'
                       ELSE '' END)
              || (CASE WHEN v_new_value = 0 THEN ' — baixa por depreciação total' ELSE '' END),
            p_user
        );
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
-- Coluna nova
SELECT column_name FROM information_schema.columns
 WHERE table_name='inv_serial_units' AND column_name='book_value';

-- Função reescrita (deve referenciar inv_serial_units)
SELECT pg_get_functiondef('fn_inv_run_depreciation'::regproc) LIKE '%inv_serial_units%' AS itera_unidades;

-- Exemplo: unidade adquirida em 01/05/2026, valor €1000, taxa 20%, ano 2026:
--   proration = (13-5)/12 = 0.6667 → depreciação = 1000 × 0.20 × 0.6667 = €133,33
--   book_value: 1000 → 866,67
