-- =====================================================
-- INVENTORY REFACTOR — Fase 5 (correção)
-- Corrige occurred_at de entradas — usa o instante real do lançamento
-- ao invés do document_date (cast DATE→TIMESTAMPTZ deslocava por fuso)
-- =====================================================
-- Bug:
--   fn_inv_process_entry_line gravava
--     occurred_at = document_date::TIMESTAMPTZ
--   document_date é DATE puro. Cast para TIMESTAMPTZ usa 00:00 no fuso
--   da sessão Postgres (UTC no Supabase). Clientes em outros fusos viam
--   a data "anterior" no Kardex.
--
-- Decisão semântica:
--   occurred_at = momento real do lançamento no sistema (NOW()).
--   document_date = data fiscal/comercial do documento (continua em
--   inv_entries e disponível para relatórios e auditoria).
--   Os dois conceitos não precisam coincidir — uma fatura datada
--   01/Jun pode ser lançada em 05/Jun.
--
-- Aditiva pura: redefine função, não toca movimentos existentes.
-- (RN07 bloqueia UPDATE de inv_movements de qualquer forma.)
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_inv_process_entry_line()
RETURNS TRIGGER AS $$
DECLARE
    v_item            inv_items%ROWTYPE;
    v_lot_id          UUID;
    v_new_cmp         NUMERIC;
    v_supplier_id     UUID;
    v_user_id         UUID;
    v_doc_type        VARCHAR(40);
    v_doc_number      VARCHAR(80);
BEGIN
    SELECT * INTO v_item FROM inv_items WHERE id = NEW.item_id;

    -- RN03: item que controla lote exige lote
    IF v_item.controls_lot AND (NEW.lot_number IS NULL OR NEW.lot_number = '') THEN
        RAISE EXCEPTION 'Item % controla lote — número de lote é obrigatório (RN03)', v_item.name;
    END IF;

    -- Cria/recupera lote se item controla
    IF v_item.controls_lot THEN
        INSERT INTO inv_lots (item_id, lot_number, manufacture_date, expiry_date, serial_number)
        VALUES (NEW.item_id, NEW.lot_number, NEW.manufacture_date, NEW.expiry_date, NEW.serial_number)
        ON CONFLICT (item_id, lot_number) DO UPDATE
            SET expiry_date     = COALESCE(EXCLUDED.expiry_date,     inv_lots.expiry_date),
                manufacture_date= COALESCE(EXCLUDED.manufacture_date,inv_lots.manufacture_date),
                serial_number   = COALESCE(EXCLUDED.serial_number,   inv_lots.serial_number)
        RETURNING id INTO v_lot_id;
    END IF;

    -- Recalcula CMP (RN06)
    v_new_cmp := fn_inv_recalc_cmp(NEW.item_id, NEW.consumption_qty, NEW.unit_cost);

    -- UPSERT manual em inv_stock
    IF v_lot_id IS NULL THEN
        UPDATE inv_stock
           SET quantity   = quantity + NEW.consumption_qty,
               updated_at = NOW()
         WHERE item_id     = NEW.item_id
           AND location_id = NEW.location_id
           AND lot_id IS NULL;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (NEW.item_id, NEW.location_id, NULL, NEW.consumption_qty);
        END IF;
    ELSE
        UPDATE inv_stock
           SET quantity   = quantity + NEW.consumption_qty,
               updated_at = NOW()
         WHERE item_id     = NEW.item_id
           AND location_id = NEW.location_id
           AND lot_id      = v_lot_id;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (NEW.item_id, NEW.location_id, v_lot_id, NEW.consumption_qty);
        END IF;
    END IF;

    -- Lê metadata do cabeçalho da entrada
    SELECT supplier_id, user_id, document_type, document_number
      INTO v_supplier_id, v_user_id, v_doc_type, v_doc_number
      FROM inv_entries WHERE id = NEW.entry_id;

    -- Gera movimento. occurred_at = NOW() (momento real do lançamento);
    -- document_date e document_number permanecem no cabeçalho da entrada
    -- (inv_entries) e em inv_movements.document_number para rastreio fiscal.
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

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Após registrar uma entrada nova, conferir:
-- SELECT occurred_at, document_number FROM inv_movements
--  WHERE type='entrada' ORDER BY occurred_at DESC LIMIT 5;
-- Esperado: occurred_at próximo do horário atual (não meia-noite UTC).
