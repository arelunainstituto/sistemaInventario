-- =====================================================
-- INVENTORY REFACTOR — 113. Seeding: saída de item com lote SEM stock
-- =====================================================
-- Problema (reportado em produção): com o modo seeding ligado
-- (allow_negative_stock = true), itens que NÃO controlam lote já podiam sair
-- em negativo (a 100 cria a linha lot-less negativa). Mas itens que CONTROLAM
-- lote e estão com stock ZERO continuavam bloqueados:
--
--   "Item ACIDO CITRICO controla lote (RN03): nenhum lote disponível na
--    localização"
--
-- Causa: em fn_inv_consume, quando o item controla lote e nenhum lote é
-- informado, o FEFO procura um lote em inv_stock para abater. Sem nenhum lote
-- em stock, o FEFO não acha nada e a função levanta RN03 ANTES de chegar à
-- regra de stock negativo — então o flag de seeding nunca é considerado.
--
-- Correção: relaxar RN03 (lote obrigatório) APENAS durante o seeding. Se o
-- flag global está ON e não há lote em stock para abater, a saída segue
-- contra o bucket SEM lote (lot_id NULL), deixando o saldo negativo — igual
-- ao que já acontece com itens sem controle de lote. Fora do seeding, o erro
-- original continua valendo.
--
-- Nota de reconciliação: o saldo negativo fica numa linha lot-less. Quando o
-- stock real entrar (com lotes), faça um ajuste para zerar o lot-less.
--
-- Idempotente (CREATE OR REPLACE). Só altera fn_inv_consume.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_inv_consume(
    p_item                   UUID,
    p_location               UUID,
    p_qty                    NUMERIC,
    p_lot                    UUID,
    p_subtype                VARCHAR,
    p_justification          TEXT,
    p_user                   UUID,
    p_confirmed_low_stock    BOOLEAN DEFAULT FALSE,
    p_movement_type          VARCHAR DEFAULT 'saida'
) RETURNS UUID AS $$
DECLARE
    v_item        inv_items%ROWTYPE;
    v_lot_id      UUID := p_lot;
    v_stock_qty   NUMERIC;
    v_new_qty     NUMERIC;
    v_movement_id UUID;
    v_min_stock   NUMERIC;
    v_allow_neg   BOOLEAN := fn_inv_negative_stock_allowed();
BEGIN
    IF p_qty IS NULL OR p_qty <= 0 THEN
        RAISE EXCEPTION 'Quantidade deve ser maior que zero' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_item FROM inv_items WHERE id = p_item AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item não encontrado: %', p_item USING ERRCODE = '02000';
    END IF;

    -- RN04: FEFO automático quando item controla lote e lote não informado
    IF v_item.controls_lot AND v_lot_id IS NULL THEN
        SELECT s.lot_id INTO v_lot_id
          FROM inv_stock s
          JOIN inv_lots  l ON l.id = s.lot_id
         WHERE s.item_id     = p_item
           AND s.location_id = p_location
           AND (v_allow_neg OR s.quantity >= p_qty)
           AND l.is_active   = TRUE
         ORDER BY l.expiry_date ASC NULLS LAST
         LIMIT 1;

        -- RN03: lote é obrigatório para item que controla lote. Exceção de
        -- SEEDING: se o flag global permite negativo e NÃO há lote em stock
        -- para abater, não bloqueia — segue com v_lot_id = NULL (consumo
        -- contra o bucket sem lote, que ficará negativo). Fora do seeding,
        -- mantém o erro original.
        IF v_lot_id IS NULL AND NOT v_allow_neg THEN
            RAISE EXCEPTION 'Item % controla lote (RN03): nenhum lote disponível na localização', v_item.name
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Stock atual no triplo (item, localização, lote — ou bucket sem lote)
    IF v_lot_id IS NULL THEN
        SELECT quantity INTO v_stock_qty
          FROM inv_stock
         WHERE item_id = p_item AND location_id = p_location AND lot_id IS NULL;
    ELSE
        SELECT quantity INTO v_stock_qty
          FROM inv_stock
         WHERE item_id = p_item AND location_id = p_location AND lot_id = v_lot_id;
    END IF;

    v_stock_qty := COALESCE(v_stock_qty, 0);

    -- RN05 com bypass condicional pelo flag global
    IF v_stock_qty < p_qty AND NOT v_allow_neg THEN
        RAISE EXCEPTION 'Stock insuficiente (disponível: %, solicitado: %) — RN05', v_stock_qty, p_qty
            USING ERRCODE = 'P0002';
    END IF;

    v_new_qty := v_stock_qty - p_qty;

    -- min_stock efetivo (Fase 4.2: location_override > item_global > 0)
    SELECT COALESCE(p.min_stock, v_item.min_stock, 0) INTO v_min_stock
      FROM inv_items i
      LEFT JOIN inv_item_location_params p
             ON p.item_id     = i.id
            AND p.location_id = p_location
            AND p.deleted_at IS NULL
     WHERE i.id = p_item;

    -- §16: confirmação se a saída deixaria abaixo do mínimo
    IF NOT p_confirmed_low_stock AND v_new_qty < v_min_stock AND v_min_stock > 0 THEN
        RAISE EXCEPTION 'LOW_STOCK_CONFIRMATION_REQUIRED|current=%|after=%|min=%',
            v_stock_qty, v_new_qty, v_min_stock
            USING ERRCODE = 'P0003';
    END IF;

    -- Justificação obrigatória para tipos não-rotineiros
    IF p_subtype IN ('avaria','extravio','perda','quebra','depreciacao')
       AND (p_justification IS NULL OR btrim(p_justification) = '') THEN
        RAISE EXCEPTION 'Justificação é obrigatória para tipo %', p_subtype USING ERRCODE = '22023';
    END IF;

    -- Aplica abate (UPSERT defensivo — permite criar row negativa se não existir)
    IF v_lot_id IS NULL THEN
        UPDATE inv_stock SET quantity = v_new_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_location AND lot_id IS NULL;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (p_item, p_location, NULL, v_new_qty);
        END IF;
    ELSE
        UPDATE inv_stock SET quantity = v_new_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_location AND lot_id = v_lot_id;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (p_item, p_location, v_lot_id, v_new_qty);
        END IF;
    END IF;

    INSERT INTO inv_movements (
        type, subtype, item_id, lot_id, from_location_id, quantity,
        unit_cost, total_cost, cmp_at_moment, justification, user_id
    ) VALUES (
        p_movement_type, p_subtype, p_item, v_lot_id, p_location, p_qty,
        v_item.cmp, p_qty * v_item.cmp, v_item.cmp, p_justification, p_user
    ) RETURNING id INTO v_movement_id;

    IF v_item.macro_category = 'patrimonial' AND p_subtype = 'depreciacao' THEN
        UPDATE inv_items SET asset_status = 'baixado' WHERE id = p_item;
    END IF;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Estado do flag (precisa estar ON para o seeding funcionar):
--   SELECT fn_inv_negative_stock_allowed();
--
-- Confirma que a função tem o relaxe de lote do seeding (deve retornar > 0):
--   SELECT count(*) FROM pg_proc
--    WHERE proname = 'fn_inv_consume'
--      AND pg_get_functiondef(oid) LIKE '%v_lot_id IS NULL AND NOT v_allow_neg%';
