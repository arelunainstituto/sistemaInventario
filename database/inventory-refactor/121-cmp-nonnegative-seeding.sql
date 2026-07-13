-- =====================================================
-- INVENTORY REFACTOR — 121. CMP não-negativo com saldo negativo (seeding)
-- =====================================================
-- Sintoma (produção): ao registrar uma ENTRADA de item que está com saldo
-- NEGATIVO (permitido pelo modo seeding), o recálculo do custo médio (CMP)
-- falhava com:
--   new row for relation "inv_items" violates check constraint "inv_items_cmp_check"
--   (inv_items.cmp tem CHECK (cmp >= 0), 10-fase1:148)
--
-- Causa: fn_inv_recalc_cmp faz média ponderada usando o SALDO ATUAL do item:
--   cmp = (saldo*cmp_atual + qtd*custo) / (saldo + qtd)
-- Com saldo negativo (seeding), o numerador/denominador podem produzir um CMP
-- NEGATIVO, que viola o CHECK.
--
-- Correção: saldo negativo não faz sentido na média ponderada de custo —
-- tratamos como 0 (base = GREATEST(saldo, 0)). Assim, enquanto o saldo estiver
-- negativo, o novo CMP passa a ser o CUSTO DESTA ENTRADA; quando o saldo real
-- normalizar (positivo), volta à média ponderada normal. Guarda final garante
-- CMP >= 0.
--
-- Aditiva pura (CREATE OR REPLACE). Não toca dados. Idempotente.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_inv_recalc_cmp(
    p_item_id   UUID,
    p_entry_qty NUMERIC,
    p_unit_cost NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    v_total_stock NUMERIC;
    v_base_stock  NUMERIC;
    v_current_cmp NUMERIC;
    v_new_cmp     NUMERIC;
BEGIN
    SELECT COALESCE(SUM(quantity), 0), MAX(i.cmp)
      INTO v_total_stock, v_current_cmp
      FROM inv_stock s
      JOIN inv_items i ON i.id = s.item_id
     WHERE s.item_id = p_item_id;

    IF v_current_cmp IS NULL THEN
        v_current_cmp := 0;
    END IF;

    -- Saldo negativo (seeding) NÃO entra na média ponderada — daria CMP < 0.
    -- Trata como 0: o novo CMP vira o custo desta entrada até o saldo normalizar.
    v_base_stock := GREATEST(v_total_stock, 0);

    IF (v_base_stock + p_entry_qty) <= 0 THEN
        v_new_cmp := p_unit_cost;
    ELSE
        v_new_cmp := ((v_base_stock * v_current_cmp) + (p_entry_qty * p_unit_cost))
                     / (v_base_stock + p_entry_qty);
    END IF;

    -- Guarda final: CMP nunca negativo (respeita inv_items_cmp_check).
    v_new_cmp := GREATEST(COALESCE(v_new_cmp, 0), 0);

    UPDATE inv_items SET cmp = v_new_cmp WHERE id = p_item_id;
    RETURN v_new_cmp;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Confirma que a função tem a base clampada (deve retornar > 0):
--   SELECT count(*) FROM pg_proc
--    WHERE proname = 'fn_inv_recalc_cmp'
--      AND pg_get_functiondef(oid) LIKE '%GREATEST(v_total_stock, 0)%';
