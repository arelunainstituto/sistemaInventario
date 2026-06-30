-- =====================================================
-- INVENTORY REFACTOR — 118. Saída de consumo em lote (multi-item)
-- =====================================================
-- A saída de consumo passa a aceitar VÁRIOS itens num mesmo registro (igual à
-- entrada, que já é multi-linha). Como cada saída é um movimento independente
-- (não há tabela de cabeçalho), processamos as linhas dentro de UMA função —
-- logo, numa única transação: se qualquer linha falhar (stock insuficiente,
-- lote, etc.), TODA a saída é desfeita (atômico).
--
-- Reutiliza fn_inv_consume por linha (FEFO, RN05/seeding, §16 mínimo, etc.),
-- então herda todo o comportamento já validado. As exceções (incl.
-- LOW_STOCK_CONFIRMATION_REQUIRED P0003) propagam para a API tratar.
--
-- Idempotente.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_inv_consume_batch(
    p_lines               jsonb,
    p_justification       TEXT,
    p_user                UUID,
    p_confirmed_low_stock BOOLEAN DEFAULT FALSE
) RETURNS jsonb AS $$
DECLARE
    v_line jsonb;
    v_mid  UUID;
    v_ids  UUID[] := '{}';
BEGIN
    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Pelo menos uma linha é obrigatória' USING ERRCODE = '22023';
    END IF;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_mid := fn_inv_consume(
            (v_line->>'item_id')::uuid,
            (v_line->>'location_id')::uuid,
            (v_line->>'quantity')::numeric,
            NULLIF(v_line->>'lot_id', '')::uuid,
            'consumo',
            p_justification,
            p_user,
            p_confirmed_low_stock,
            'saida'
        );
        v_ids := array_append(v_ids, v_mid);
    END LOOP;

    RETURN to_jsonb(v_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION fn_inv_consume_batch(jsonb, TEXT, UUID, BOOLEAN) TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- SELECT proname FROM pg_proc WHERE proname = 'fn_inv_consume_batch';
