-- =====================================================
-- INVENTORY REFACTOR — 122. Controle de lote OPCIONAL
-- =====================================================
-- "Não controlar lote" passa a significar apenas que o lote NÃO é obrigatório —
-- o campo continua existindo. Assim:
--   • ENTRADA: cria/usa lote sempre que um lote for INFORMADO (mesmo em item
--     que não controla). RN03 (lote obrigatório) só vale para item que controla.
--   • SAÍDA: se houver estoque em LOTE na localização, consome por FEFO mesmo
--     que o item não controle lote (não deixa estoque em lote preso). Sem lote
--     em estoque → abate direto do bucket sem-lote. Item que CONTROLA lote sem
--     lote disponível continua caindo na RN03 (salvo modo seeding).
--
-- Com isso, um item que já tinha lotes pode ser marcado como "não controla
-- lote" sem travar (a API deixa de bloquear) e o estoque em lote continua
-- consumível.
--
-- Redefine fn_inv_process_entry_line (base: 53) e fn_inv_consume (base: 113),
-- mudando SÓ o gate do lote. Idempotente.
-- =====================================================

BEGIN;

-- ---------- ENTRADA: cria lote quando informado (não só quando controla) ----------
CREATE OR REPLACE FUNCTION fn_inv_process_entry_line()
RETURNS TRIGGER AS $$
DECLARE
    v_item        inv_items%ROWTYPE;
    v_lot_id      UUID;
    v_new_cmp     NUMERIC;
    v_supplier_id UUID;
    v_user_id     UUID;
    v_doc_type    VARCHAR(40);
    v_doc_number  VARCHAR(80);
BEGIN
    SELECT * INTO v_item FROM inv_items WHERE id = NEW.item_id;

    -- RN03: item que controla lote exige lote informado.
    IF v_item.controls_lot AND (NEW.lot_number IS NULL OR NEW.lot_number = '') THEN
        RAISE EXCEPTION 'Item % controla lote — número de lote é obrigatório (RN03)', v_item.name;
    END IF;

    -- Cria/recupera lote sempre que um lote for INFORMADO (item pode não
    -- controlar lote e ainda assim registrar um lote opcional). Sem lote → sem_lote.
    IF NEW.lot_number IS NOT NULL AND NEW.lot_number <> '' THEN
        INSERT INTO inv_lots (item_id, lot_number, manufacture_date, expiry_date, serial_number)
        VALUES (NEW.item_id, NEW.lot_number, NEW.manufacture_date, NEW.expiry_date, NEW.serial_number)
        ON CONFLICT (item_id, lot_number) DO UPDATE
            SET expiry_date      = COALESCE(EXCLUDED.expiry_date,      inv_lots.expiry_date),
                manufacture_date = COALESCE(EXCLUDED.manufacture_date, inv_lots.manufacture_date),
                serial_number    = COALESCE(EXCLUDED.serial_number,    inv_lots.serial_number)
        RETURNING id INTO v_lot_id;
    END IF;

    -- Recalcula CMP (RN06)
    v_new_cmp := fn_inv_recalc_cmp(NEW.item_id, NEW.consumption_qty, NEW.unit_cost);

    -- UPSERT manual em inv_stock
    IF v_lot_id IS NULL THEN
        UPDATE inv_stock SET quantity = quantity + NEW.consumption_qty, updated_at = NOW()
         WHERE item_id = NEW.item_id AND location_id = NEW.location_id AND lot_id IS NULL;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (NEW.item_id, NEW.location_id, NULL, NEW.consumption_qty);
        END IF;
    ELSE
        UPDATE inv_stock SET quantity = quantity + NEW.consumption_qty, updated_at = NOW()
         WHERE item_id = NEW.item_id AND location_id = NEW.location_id AND lot_id = v_lot_id;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (NEW.item_id, NEW.location_id, v_lot_id, NEW.consumption_qty);
        END IF;
    END IF;

    SELECT supplier_id, user_id, document_type, document_number
      INTO v_supplier_id, v_user_id, v_doc_type, v_doc_number
      FROM inv_entries WHERE id = NEW.entry_id;

    INSERT INTO inv_movements (
        type, subtype, item_id, lot_id, to_location_id, quantity,
        unit_cost, total_cost, cmp_at_moment, document_type, document_number,
        supplier_id, user_id, occurred_at
    ) VALUES (
        'entrada', 'recepcao_fiscal', NEW.item_id, v_lot_id, NEW.location_id, NEW.consumption_qty,
        NEW.unit_cost, NEW.total_cost, v_new_cmp, v_doc_type, v_doc_number,
        v_supplier_id, v_user_id, NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- SAÍDA: FEFO se houver estoque em lote (mesmo sem controlar) ----------
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

    -- FEFO quando o lote não foi informado: tenta um lote em estoque na
    -- localização (validade mais próxima). Vale para item que CONTROLA lote E
    -- para item que deixou de controlar mas ainda tem estoque em lote.
    IF v_lot_id IS NULL THEN
        SELECT s.lot_id INTO v_lot_id
          FROM inv_stock s
          JOIN inv_lots  l ON l.id = s.lot_id
         WHERE s.item_id     = p_item
           AND s.location_id = p_location
           AND (v_allow_neg OR s.quantity >= p_qty)
           AND l.is_active   = TRUE
         ORDER BY l.expiry_date ASC NULLS LAST
         LIMIT 1;

        -- Item que CONTROLA lote e não achou lote → RN03 (salvo seeding).
        -- Item que NÃO controla e não tem lote em estoque → segue sem lote.
        IF v_lot_id IS NULL AND v_item.controls_lot AND NOT v_allow_neg THEN
            RAISE EXCEPTION 'Item % controla lote (RN03): nenhum lote disponível na localização', v_item.name
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Stock atual no triplo (item, localização, lote — ou bucket sem lote)
    IF v_lot_id IS NULL THEN
        SELECT quantity INTO v_stock_qty
          FROM inv_stock WHERE item_id = p_item AND location_id = p_location AND lot_id IS NULL;
    ELSE
        SELECT quantity INTO v_stock_qty
          FROM inv_stock WHERE item_id = p_item AND location_id = p_location AND lot_id = v_lot_id;
    END IF;
    v_stock_qty := COALESCE(v_stock_qty, 0);

    -- RN05 com bypass condicional pelo flag global (seeding)
    IF v_stock_qty < p_qty AND NOT v_allow_neg THEN
        RAISE EXCEPTION 'Stock insuficiente (disponível: %, solicitado: %) — RN05', v_stock_qty, p_qty
            USING ERRCODE = 'P0002';
    END IF;

    v_new_qty := v_stock_qty - p_qty;

    SELECT COALESCE(p.min_stock, v_item.min_stock, 0) INTO v_min_stock
      FROM inv_items i
      LEFT JOIN inv_item_location_params p
             ON p.item_id = i.id AND p.location_id = p_location AND p.deleted_at IS NULL
     WHERE i.id = p_item;

    IF NOT p_confirmed_low_stock AND v_new_qty < v_min_stock AND v_min_stock > 0 THEN
        RAISE EXCEPTION 'LOW_STOCK_CONFIRMATION_REQUIRED|current=%|after=%|min=%',
            v_stock_qty, v_new_qty, v_min_stock USING ERRCODE = 'P0003';
    END IF;

    IF p_subtype IN ('avaria','extravio','perda','quebra','depreciacao')
       AND (p_justification IS NULL OR btrim(p_justification) = '') THEN
        RAISE EXCEPTION 'Justificação é obrigatória para tipo %', p_subtype USING ERRCODE = '22023';
    END IF;

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
-- Entrada cria lote quando informado (procura o gate novo):
--   SELECT count(*) FROM pg_proc WHERE proname='fn_inv_process_entry_line'
--     AND pg_get_functiondef(oid) LIKE '%NEW.lot_number IS NOT NULL AND NEW.lot_number <> %';
-- Saída FEFO sem depender de controls_lot (o IF do FEFO não menciona controls_lot):
--   SELECT count(*) FROM pg_proc WHERE proname='fn_inv_consume'
--     AND pg_get_functiondef(oid) LIKE '%FEFO quando o lote não foi informado%';
