-- =====================================================
-- INVENTORY REFACTOR — Fase 6
-- Inativação (cancelamento) de movimentos por estorno
-- =====================================================
-- Motivação:
--   RN07 estabelece que inv_movements é imutável (sem UPDATE/DELETE).
--   Para corrigir lançamentos errados sem violar essa regra, adotamos
--   estorno por movimento espelho: cancelar um movimento M gera um
--   novo movimento E que reverte o efeito de M no stock.
--   Ambos ficam visíveis no Kardex e a relação é registada por
--   inv_movements.reversal_of_movement_id.
--
-- Características:
--   • Append-only preservado (RN07 inalterado).
--   • Auditoria completa: original + estorno + autor + motivo.
--   • Para transferências (par saida+entrada), cancela ambos atomicamente.
--   • Recalcula CMP do item após cancelar uma entrada.
--   • Só Inventory_Admin pode cancelar (gate no endpoint).
--   • Idempotente — falha se o movimento já foi cancelado.
--
-- Aditiva pura — schema novo + função nova.
-- =====================================================

BEGIN;

-- ---------- 1) Coluna de referência ao movimento original ----------
ALTER TABLE inv_movements
    ADD COLUMN IF NOT EXISTS reversal_of_movement_id UUID REFERENCES inv_movements(id) ON DELETE RESTRICT;

COMMENT ON COLUMN inv_movements.reversal_of_movement_id IS
'Quando preenchido, indica que este movimento é o ESTORNO do movimento '
'referenciado. O movimento original é considerado "cancelado" quando há '
'pelo menos um estorno apontando para ele.';

CREATE INDEX IF NOT EXISTS idx_inv_mov_reversal
    ON inv_movements (reversal_of_movement_id)
    WHERE reversal_of_movement_id IS NOT NULL;

-- ---------- 2) View auxiliar: estado de cancelamento por movimento ----------
CREATE OR REPLACE VIEW vw_inv_movements_with_status AS
SELECT
    m.*,
    -- TRUE se este movimento foi cancelado (existe estorno apontando para ele)
    EXISTS (
        SELECT 1 FROM inv_movements r
        WHERE r.reversal_of_movement_id = m.id
    ) AS is_cancelled,
    -- ID do estorno (se houver)
    (SELECT r.id FROM inv_movements r
     WHERE r.reversal_of_movement_id = m.id
     ORDER BY r.created_at DESC LIMIT 1) AS reversal_id,
    -- TRUE se este movimento É um estorno (de outro)
    (m.reversal_of_movement_id IS NOT NULL) AS is_reversal
FROM inv_movements m;

COMMENT ON VIEW vw_inv_movements_with_status IS
'Movimentos enriquecidos com flags is_cancelled (foi cancelado por um estorno) '
'e is_reversal (é um movimento de estorno) + reversal_id. Usado pelo Kardex '
'e modais de view para mostrar badges de status.';

-- ---------- 3) Helper: recalcula CMP do item após mudanças ----------
-- CMP padrão é incremental, mas após cancelar uma entrada antiga não dá para
-- "desfazer" o efeito histórico. Recalculamos do zero usando média ponderada
-- de TODOS os custos de entrada vigentes (não-estornados).
CREATE OR REPLACE FUNCTION fn_inv_recalc_cmp_full(p_item_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total_qty NUMERIC := 0;
    v_total_value NUMERIC := 0;
    v_new_cmp NUMERIC;
BEGIN
    -- Soma quantidade × custo de todas as entradas vigentes
    SELECT
        COALESCE(SUM(m.quantity), 0),
        COALESCE(SUM(m.quantity * m.unit_cost), 0)
      INTO v_total_qty, v_total_value
      FROM inv_movements m
     WHERE m.item_id = p_item_id
       AND m.type = 'entrada'
       AND m.reversal_of_movement_id IS NULL
       AND NOT EXISTS (
           SELECT 1 FROM inv_movements r
           WHERE r.reversal_of_movement_id = m.id
       );

    v_new_cmp := CASE
        WHEN v_total_qty > 0 THEN v_total_value / v_total_qty
        ELSE 0
    END;

    UPDATE inv_items SET cmp = v_new_cmp WHERE id = p_item_id;
    RETURN v_new_cmp;
END;
$$ LANGUAGE plpgsql;

-- ---------- 4) Função principal: fn_inv_cancel_movement ----------
CREATE OR REPLACE FUNCTION fn_inv_cancel_movement(
    p_movement_id UUID,
    p_user_id     UUID,
    p_reason      TEXT
) RETURNS UUID AS $$
DECLARE
    v_orig            inv_movements%ROWTYPE;
    v_pair            inv_movements%ROWTYPE;
    v_existing        UUID;
    v_reversal_id     UUID;
    v_reversal_type   VARCHAR;
    v_subtype         VARCHAR;
    v_justification   TEXT;
BEGIN
    -- Validação de motivo
    IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Motivo de cancelamento é obrigatório (mínimo 5 caracteres)'
            USING ERRCODE = '22023';
    END IF;

    -- Lê o movimento original
    SELECT * INTO v_orig FROM inv_movements WHERE id = p_movement_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimento % não encontrado', p_movement_id USING ERRCODE = '02000';
    END IF;

    -- Não cancelar um estorno
    IF v_orig.reversal_of_movement_id IS NOT NULL THEN
        RAISE EXCEPTION 'Não é possível cancelar um movimento que já é um estorno'
            USING ERRCODE = '22023';
    END IF;

    -- Idempotência
    SELECT id INTO v_existing
      FROM inv_movements
     WHERE reversal_of_movement_id = p_movement_id LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RAISE EXCEPTION 'Movimento já foi cancelado (estorno: %)', v_existing
            USING ERRCODE = '22023';
    END IF;

    -- Para transferências, cancela atomicamente o par (saida + entrada)
    IF v_orig.type IN ('transferencia_saida','transferencia_entrada') THEN
        -- Localiza o par: mesmo item+lot+qty+occurred_at em tipo oposto
        SELECT * INTO v_pair
          FROM inv_movements
         WHERE item_id     = v_orig.item_id
           AND lot_id      IS NOT DISTINCT FROM v_orig.lot_id
           AND quantity    = v_orig.quantity
           AND occurred_at = v_orig.occurred_at
           AND type = CASE v_orig.type
                          WHEN 'transferencia_saida' THEN 'transferencia_entrada'
                          ELSE 'transferencia_saida'
                      END
           AND id <> v_orig.id
         ORDER BY created_at DESC
         LIMIT 1;
        IF v_pair.id IS NULL THEN
            RAISE EXCEPTION 'Par de transferência não encontrado para movimento %', p_movement_id
                USING ERRCODE = 'P0001';
        END IF;
        -- Já está cancelado o par?
        SELECT id INTO v_existing
          FROM inv_movements
         WHERE reversal_of_movement_id = v_pair.id LIMIT 1;
        IF v_existing IS NOT NULL THEN
            RAISE EXCEPTION 'O par desta transferência já foi cancelado (estorno: %)', v_existing
                USING ERRCODE = '22023';
        END IF;
    END IF;

    v_subtype       := 'estorno';
    v_justification := format('ESTORNO de movimento %s [%s]: %s',
                              left(v_orig.id::TEXT, 8), v_orig.type, p_reason);

    -- Mapeia tipo do estorno + aplica reversão no stock
    IF v_orig.type = 'entrada' THEN
        v_reversal_type := 'saida';
        -- Reverter: subtrair quantidade do stock na to_location
        PERFORM fn_inv_apply_stock_delta(v_orig.item_id, v_orig.to_location_id, v_orig.lot_id, -v_orig.quantity, TRUE);

    ELSIF v_orig.type = 'saida' THEN
        v_reversal_type := 'entrada';
        PERFORM fn_inv_apply_stock_delta(v_orig.item_id, v_orig.from_location_id, v_orig.lot_id, +v_orig.quantity, FALSE);

    ELSIF v_orig.type = 'ajuste' THEN
        v_reversal_type := 'ajuste';
        -- Ajuste positivo (to_location) → reverter subtraindo de to_location
        IF v_orig.to_location_id IS NOT NULL THEN
            PERFORM fn_inv_apply_stock_delta(v_orig.item_id, v_orig.to_location_id, v_orig.lot_id, -v_orig.quantity, TRUE);
        ELSIF v_orig.from_location_id IS NOT NULL THEN
            PERFORM fn_inv_apply_stock_delta(v_orig.item_id, v_orig.from_location_id, v_orig.lot_id, +v_orig.quantity, FALSE);
        END IF;

    ELSIF v_orig.type = 'transferencia_saida' THEN
        v_reversal_type := 'transferencia_entrada';
        -- v_orig: saiu de from. Reverter: devolver +qty para from.
        PERFORM fn_inv_apply_stock_delta(v_orig.item_id, v_orig.from_location_id, v_orig.lot_id, +v_orig.quantity, FALSE);

    ELSIF v_orig.type = 'transferencia_entrada' THEN
        v_reversal_type := 'transferencia_saida';
        -- v_orig: entrou em to. Reverter: tirar -qty de to.
        PERFORM fn_inv_apply_stock_delta(v_orig.item_id, v_orig.to_location_id, v_orig.lot_id, -v_orig.quantity, TRUE);

    ELSE
        RAISE EXCEPTION 'Tipo % não suportado para cancelamento (% / depreciação requer fluxo dedicado)',
                        v_orig.type, v_orig.type
            USING ERRCODE = '22023';
    END IF;

    -- Cria movimento de estorno (RN07: insert puro, sem UPDATE)
    INSERT INTO inv_movements (
        type, subtype, item_id, lot_id,
        from_location_id, to_location_id,
        quantity, unit_cost, total_cost, cmp_at_moment,
        document_type, document_number,
        justification, user_id,
        reversal_of_movement_id, occurred_at
    ) VALUES (
        v_reversal_type, v_subtype, v_orig.item_id, v_orig.lot_id,
        -- Troca from/to para refletir o movimento inverso
        v_orig.to_location_id, v_orig.from_location_id,
        v_orig.quantity, v_orig.unit_cost, v_orig.total_cost, v_orig.cmp_at_moment,
        v_orig.document_type, v_orig.document_number,
        v_justification, p_user_id,
        v_orig.id, NOW()
    ) RETURNING id INTO v_reversal_id;

    -- Se é transferência, cancela o par também
    IF v_pair.id IS NOT NULL THEN
        INSERT INTO inv_movements (
            type, subtype, item_id, lot_id,
            from_location_id, to_location_id,
            quantity, unit_cost, total_cost, cmp_at_moment,
            document_type, document_number,
            justification, user_id,
            reversal_of_movement_id, occurred_at
        ) VALUES (
            CASE v_pair.type
                WHEN 'transferencia_saida'   THEN 'transferencia_entrada'
                WHEN 'transferencia_entrada' THEN 'transferencia_saida'
            END,
            v_subtype, v_pair.item_id, v_pair.lot_id,
            v_pair.to_location_id, v_pair.from_location_id,
            v_pair.quantity, v_pair.unit_cost, v_pair.total_cost, v_pair.cmp_at_moment,
            v_pair.document_type, v_pair.document_number,
            format('ESTORNO de movimento %s [%s — par da transferência cancelada]: %s',
                   left(v_pair.id::TEXT, 8), v_pair.type, p_reason),
            p_user_id,
            v_pair.id, NOW()
        );
        -- Aplica delta do par no stock também
        IF v_pair.type = 'transferencia_saida' THEN
            PERFORM fn_inv_apply_stock_delta(v_pair.item_id, v_pair.from_location_id, v_pair.lot_id, +v_pair.quantity, FALSE);
        ELSE
            PERFORM fn_inv_apply_stock_delta(v_pair.item_id, v_pair.to_location_id, v_pair.lot_id, -v_pair.quantity, TRUE);
        END IF;
    END IF;

    -- Recalcula CMP do item se cancelou uma entrada
    IF v_orig.type = 'entrada' THEN
        PERFORM fn_inv_recalc_cmp_full(v_orig.item_id);
    END IF;

    RETURN v_reversal_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_inv_cancel_movement(UUID, UUID, TEXT) IS
'Cancela um movimento gerando um estorno espelho (RN07-safe). Aplica o '
'delta inverso no stock e recalcula CMP do item se a entrada foi cancelada. '
'Para transferências, cancela atomicamente os 2 movimentos do par.';

-- ---------- 5) Helper para aplicar delta de stock ----------
-- Reaproveita a lógica de UPSERT manual (índices parciais NULL/NOT NULL no
-- inv_stock impedem ON CONFLICT genérico). Bypass de RN05 quando reverter
-- requer permitir stock temporariamente negativo (force_negative=TRUE).
CREATE OR REPLACE FUNCTION fn_inv_apply_stock_delta(
    p_item_id     UUID,
    p_location_id UUID,
    p_lot_id      UUID,
    p_delta       NUMERIC,
    p_allow_neg   BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
    v_qty NUMERIC;
BEGIN
    -- Tenta UPDATE
    IF p_lot_id IS NULL THEN
        UPDATE inv_stock
           SET quantity   = quantity + p_delta,
               updated_at = NOW()
         WHERE item_id     = p_item_id
           AND location_id = p_location_id
           AND lot_id IS NULL
         RETURNING quantity INTO v_qty;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (p_item_id, p_location_id, NULL, p_delta) RETURNING quantity INTO v_qty;
        END IF;
    ELSE
        UPDATE inv_stock
           SET quantity   = quantity + p_delta,
               updated_at = NOW()
         WHERE item_id     = p_item_id
           AND location_id = p_location_id
           AND lot_id      = p_lot_id
         RETURNING quantity INTO v_qty;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (p_item_id, p_location_id, p_lot_id, p_delta) RETURNING quantity INTO v_qty;
        END IF;
    END IF;

    -- RN05 estrito mas com bypass para estorno de entrada
    IF v_qty < 0 AND NOT p_allow_neg THEN
        RAISE EXCEPTION 'Cancelamento resultaria em stock negativo (%) — operação bloqueada por RN05', v_qty
            USING ERRCODE = 'P0002';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ---------- 6) fn_inv_cancel_entry — cancela todos os movimentos de uma entrada ----------
-- Uma entrada (inv_entries) gera N movimentos type='entrada' (um por linha
-- em inv_entry_lines). Cancelar a entrada inteira itera atomicamente sobre
-- esses movimentos e gera o estorno espelho de cada um.
CREATE OR REPLACE FUNCTION fn_inv_cancel_entry(
    p_entry_id UUID,
    p_user_id  UUID,
    p_reason   TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_entry      inv_entries%ROWTYPE;
    v_movement   inv_movements%ROWTYPE;
    v_cancelled  INTEGER := 0;
BEGIN
    SELECT * INTO v_entry FROM inv_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Entrada % não encontrada', p_entry_id USING ERRCODE = '02000';
    END IF;

    -- Itera pelos movimentos de entrada gerados por este documento fiscal
    -- (match por document_type + document_number + supplier_id — chaves do RN02).
    FOR v_movement IN
        SELECT m.* FROM inv_movements m
         WHERE m.type            = 'entrada'
           AND m.document_type   = v_entry.document_type
           AND m.document_number = v_entry.document_number
           AND m.supplier_id     IS NOT DISTINCT FROM v_entry.supplier_id
           AND m.reversal_of_movement_id IS NULL
           AND NOT EXISTS (
               SELECT 1 FROM inv_movements r WHERE r.reversal_of_movement_id = m.id
           )
    LOOP
        PERFORM fn_inv_cancel_movement(v_movement.id, p_user_id, p_reason);
        v_cancelled := v_cancelled + 1;
    END LOOP;

    IF v_cancelled = 0 THEN
        RAISE EXCEPTION 'Nenhum movimento da entrada % está disponível para cancelamento (todos já cancelados ou inexistentes)', p_entry_id
            USING ERRCODE = '22023';
    END IF;

    RETURN v_cancelled;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_inv_cancel_entry(UUID, UUID, TEXT) IS
'Cancela todos os movimentos type=entrada gerados por uma entrada (inv_entries). '
'Itera atomicamente — falha em uma linha aborta toda a operação (rollback).';

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- 1) Coluna criada
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'inv_movements' AND column_name = 'reversal_of_movement_id';

-- 2) View criada
SELECT * FROM vw_inv_movements_with_status LIMIT 3;

-- 3) Teste manual (rodar depois):
-- a) Criar uma entrada teste, conferir CMP
-- b) SELECT fn_inv_cancel_movement('<entry_movement_id>', auth.uid(), 'Teste de cancelamento — erro de digitação');
-- c) Conferir: estorno criado, stock revertido, CMP recalculado, view mostra is_cancelled=TRUE
-- d) Repetir cancelamento → deve falhar com "Movimento já foi cancelado"
