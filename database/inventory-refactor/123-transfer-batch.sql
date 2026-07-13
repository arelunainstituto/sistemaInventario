-- =====================================================
-- INVENTORY REFACTOR — 123. Transferência multi-item (mesma origem/destino)
-- =====================================================
-- A transferência de consumo passa a mover VÁRIOS itens de uma vez, todos da
-- mesma ORIGEM para o mesmo DESTINO (igual à saída multi-linha). Como cada
-- transferência gera 2 movimentos (saída na origem + entrada no destino) via
-- fn_inv_transfer, processamos as linhas dentro de UMA função — logo, numa
-- única transação: se qualquer linha falhar, TODA a transferência é desfeita.
--
-- Reutiliza fn_inv_transfer por linha (que já delega o débito da origem ao
-- fn_inv_consume — FEFO, RN05/seeding — e credita o destino com o mesmo CMP).
--
-- Idempotente.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_inv_transfer_batch(
    p_from          UUID,
    p_to            UUID,
    p_lines         jsonb,
    p_justification TEXT,
    p_user          UUID
) RETURNS jsonb AS $$
DECLARE
    v_line     jsonb;
    v_saida    UUID;
    v_entrada  UUID;
    v_results  jsonb := '[]'::jsonb;
BEGIN
    IF p_from IS NULL OR p_to IS NULL THEN
        RAISE EXCEPTION 'Origem e destino são obrigatórios' USING ERRCODE = '22023';
    END IF;
    IF p_from = p_to THEN
        RAISE EXCEPTION 'Localizações origem e destino não podem ser iguais' USING ERRCODE = '22023';
    END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Pelo menos uma linha é obrigatória' USING ERRCODE = '22023';
    END IF;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT saida_id, entrada_id
          INTO v_saida, v_entrada
          FROM fn_inv_transfer(
              (v_line->>'item_id')::uuid,
              p_from,
              p_to,
              (v_line->>'quantity')::numeric,
              NULLIF(v_line->>'lot_id', '')::uuid,
              p_justification,
              p_user
          );
        v_results := v_results || jsonb_build_object('saida_id', v_saida, 'entrada_id', v_entrada);
    END LOOP;

    RETURN v_results;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION fn_inv_transfer_batch(UUID, UUID, jsonb, TEXT, UUID) TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- SELECT proname FROM pg_proc WHERE proname = 'fn_inv_transfer_batch';
