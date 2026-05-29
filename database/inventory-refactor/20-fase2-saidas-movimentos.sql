-- =====================================================
-- INVENTORY REFACTOR — FASE 2
-- Saídas + Movimentações Internas + Ajustes
-- =====================================================
-- Adiciona ao schema da Fase 1:
--   • Tabela inv_adjustment_reasons (motivos predefinidos)
--   • View vw_inv_patrimony_locations (resolve §9.2 sem duplicação)
--   • Função fn_inv_consume    (RN03, RN04 FEFO, RN05, RN06, RN09 manual)
--   • Função fn_inv_transfer   (gera 2 movimentos, valida can_send/receive)
--   • Função fn_inv_adjust     (RF06 ajuste >5%, RN05 exceção autorizada)
--
-- Atende: secções 8, 9, 10.2 + RN03, RN04, RN05, RN06, RN07, RN08, RN09
-- =====================================================

BEGIN;

-- =====================================================
-- 1. MOTIVOS DE AJUSTE
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_adjustment_reasons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(40) NOT NULL UNIQUE,
    label       VARCHAR(120) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tg_inv_adj_reasons_updated ON inv_adjustment_reasons;
CREATE TRIGGER tg_inv_adj_reasons_updated BEFORE UPDATE ON inv_adjustment_reasons
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

INSERT INTO inv_adjustment_reasons (code, label) VALUES
    ('correcao_erro',         'Correção de erro de lançamento'),
    ('sobra_inventario',      'Sobra encontrada em contagem'),
    ('quebra_nao_registada',  'Quebra/perda não registada'),
    ('desvio',                'Desvio / inconformidade'),
    ('outro',                 'Outro (especificar na justificação)')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE inv_adjustment_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_adj_reasons_auth_select" ON inv_adjustment_reasons;
CREATE POLICY "inv_adj_reasons_auth_select" ON inv_adjustment_reasons
    FOR SELECT TO authenticated USING (true);

-- =====================================================
-- 2. VIEW DE LOCALIZAÇÃO DE PATRIMÔNIO (§9.2)
-- =====================================================
-- Fonte única de verdade: a localização do bem é onde ele tem stock > 0.
-- Não duplicamos current_location_id em inv_items para evitar dessincronia.
CREATE OR REPLACE VIEW vw_inv_patrimony_locations AS
SELECT
    i.id                    AS item_id,
    i.name                  AS item_name,
    i.internal_code,
    i.patrimony_number,
    i.asset_status,
    s.location_id           AS current_location_id,
    l.name                  AS location_name,
    u.id                    AS unit_id,
    u.name                  AS unit_name,
    s.quantity              AS quantity_at_location,
    s.updated_at            AS location_updated_at
FROM inv_items i
LEFT JOIN inv_stock s     ON s.item_id = i.id AND s.quantity > 0
LEFT JOIN inv_locations l ON l.id = s.location_id
LEFT JOIN inv_units u     ON u.id = l.unit_id
WHERE i.macro_category = 'patrimonial'
  AND i.deleted_at IS NULL;

-- =====================================================
-- 3. fn_inv_consume — Saída de stock (§8 + RN03-06, RN09 manual)
-- =====================================================
-- Retorna o ID do movimento criado, ou levanta exceção com SQLSTATE
-- específicos que o API traduz em 4xx amigáveis.
CREATE OR REPLACE FUNCTION fn_inv_consume(
    p_item                   UUID,
    p_location               UUID,
    p_qty                    NUMERIC,
    p_lot                    UUID,
    p_subtype                VARCHAR,
    p_justification          TEXT,
    p_user                   UUID,
    p_confirmed_low_stock    BOOLEAN DEFAULT FALSE,
    p_movement_type          VARCHAR DEFAULT 'saida'  -- usado por fn_inv_transfer
) RETURNS UUID AS $$
DECLARE
    v_item        inv_items%ROWTYPE;
    v_lot_id      UUID := p_lot;
    v_stock_qty   NUMERIC;
    v_new_qty     NUMERIC;
    v_movement_id UUID;
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
           AND s.quantity    >= p_qty
           AND l.is_active   = TRUE
         ORDER BY l.expiry_date ASC NULLS LAST
         LIMIT 1;

        IF v_lot_id IS NULL THEN
            -- RN03: item controla lote mas não há lote com stock suficiente
            RAISE EXCEPTION 'Item % controla lote (RN03): nenhum lote disponível com stock suficiente na localização', v_item.name
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- RN03 reforço: se item controla lote, lot_id é obrigatório
    IF v_item.controls_lot AND v_lot_id IS NULL THEN
        RAISE EXCEPTION 'Item % controla lote — lote é obrigatório (RN03)', v_item.name
            USING ERRCODE = 'P0001';
    END IF;

    -- Busca stock atual no triplo (item, location, lot)
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

    -- RN05: stock não pode ficar negativo em saídas
    IF v_stock_qty < p_qty THEN
        RAISE EXCEPTION 'Stock insuficiente (disponível: %, solicitado: %) — RN05', v_stock_qty, p_qty
            USING ERRCODE = 'P0002';
    END IF;

    v_new_qty := v_stock_qty - p_qty;

    -- §16: confirmação se a saída deixaria abaixo do mínimo
    IF NOT p_confirmed_low_stock AND v_new_qty < v_item.min_stock AND v_item.min_stock > 0 THEN
        RAISE EXCEPTION 'LOW_STOCK_CONFIRMATION_REQUIRED|current=%|after=%|min=%',
            v_stock_qty, v_new_qty, v_item.min_stock
            USING ERRCODE = 'P0003';
    END IF;

    -- Justificação obrigatória para tipos não-rotineiros
    IF p_subtype IN ('avaria','extravio','perda','quebra','depreciacao')
       AND (p_justification IS NULL OR btrim(p_justification) = '') THEN
        RAISE EXCEPTION 'Justificação é obrigatória para tipo %', p_subtype USING ERRCODE = '22023';
    END IF;

    -- Aplica abate
    IF v_lot_id IS NULL THEN
        UPDATE inv_stock SET quantity = v_new_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_location AND lot_id IS NULL;
    ELSE
        UPDATE inv_stock SET quantity = v_new_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_location AND lot_id = v_lot_id;
    END IF;

    -- Grava movimento imutável (RN06: cmp_at_moment = CMP atual do item)
    INSERT INTO inv_movements (
        type, subtype, item_id, lot_id, from_location_id, quantity,
        unit_cost, total_cost, cmp_at_moment, justification, user_id
    ) VALUES (
        p_movement_type, p_subtype, p_item, v_lot_id, p_location, p_qty,
        v_item.cmp, p_qty * v_item.cmp, v_item.cmp, p_justification, p_user
    ) RETURNING id INTO v_movement_id;

    -- RN09 (manual): depreciação de patrimonial → asset_status='baixado'
    IF v_item.macro_category = 'patrimonial' AND p_subtype = 'depreciacao' THEN
        UPDATE inv_items SET asset_status = 'baixado' WHERE id = p_item;
    END IF;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. fn_inv_transfer — Transferência interna (§9)
-- =====================================================
CREATE OR REPLACE FUNCTION fn_inv_transfer(
    p_item          UUID,
    p_from          UUID,
    p_to            UUID,
    p_qty           NUMERIC,
    p_lot           UUID,
    p_justification TEXT,
    p_user          UUID
) RETURNS TABLE(saida_id UUID, entrada_id UUID) AS $$
DECLARE
    v_item            inv_items%ROWTYPE;
    v_from            inv_locations%ROWTYPE;
    v_to              inv_locations%ROWTYPE;
    v_saida_id        UUID;
    v_entrada_id      UUID;
    v_lot_used        UUID;
BEGIN
    IF p_from = p_to THEN
        RAISE EXCEPTION 'Localização de origem e destino não podem ser iguais (§9.2)' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_item FROM inv_items WHERE id = p_item AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item não encontrado' USING ERRCODE = '02000';
    END IF;

    SELECT * INTO v_from FROM inv_locations WHERE id = p_from AND deleted_at IS NULL;
    SELECT * INTO v_to   FROM inv_locations WHERE id = p_to   AND deleted_at IS NULL;
    IF v_from.id IS NULL OR v_to.id IS NULL THEN
        RAISE EXCEPTION 'Localização inválida' USING ERRCODE = '02000';
    END IF;
    IF NOT v_from.can_send    THEN RAISE EXCEPTION 'Origem (%) não permite envios (§5)', v_from.name USING ERRCODE='P0001'; END IF;
    IF NOT v_to.can_receive   THEN RAISE EXCEPTION 'Destino (%) não permite recepção (§5)', v_to.name USING ERRCODE='P0001'; END IF;

    -- Consome da origem reutilizando toda a lógica de RN03/04/05/06.
    -- p_confirmed_low_stock=TRUE: transferência não é considerada "saída crítica",
    -- pois o stock continua no Instituto, apenas muda de localização.
    v_saida_id := fn_inv_consume(
        p_item, p_from, p_qty, p_lot,
        'movimentacao_interna', p_justification, p_user,
        TRUE,                       -- confirmed_low_stock
        'transferencia_saida'       -- p_movement_type
    );

    -- Recupera o lote efetivamente usado (pode ter sido sugerido por FEFO)
    SELECT lot_id INTO v_lot_used FROM inv_movements WHERE id = v_saida_id;

    -- Insere stock no destino (UPSERT manual por causa dos índices parciais)
    IF v_lot_used IS NULL THEN
        UPDATE inv_stock SET quantity = quantity + p_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_to AND lot_id IS NULL;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (p_item, p_to, NULL, p_qty);
        END IF;
    ELSE
        UPDATE inv_stock SET quantity = quantity + p_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_to AND lot_id = v_lot_used;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (p_item, p_to, v_lot_used, p_qty);
        END IF;
    END IF;

    -- Movimento de entrada no destino (RN06: mesmo CMP)
    INSERT INTO inv_movements (
        type, subtype, item_id, lot_id, from_location_id, to_location_id,
        quantity, unit_cost, total_cost, cmp_at_moment, justification, user_id
    ) VALUES (
        'transferencia_entrada', 'movimentacao_interna', p_item, v_lot_used, p_from, p_to,
        p_qty, v_item.cmp, p_qty * v_item.cmp, v_item.cmp, p_justification, p_user
    ) RETURNING id INTO v_entrada_id;

    RETURN QUERY SELECT v_saida_id, v_entrada_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. fn_inv_adjust — Ajuste manual (§10.2 + RF06 + RN05 exceção)
-- =====================================================
CREATE OR REPLACE FUNCTION fn_inv_adjust(
    p_item             UUID,
    p_location         UUID,
    p_lot              UUID,
    p_delta            NUMERIC,
    p_reason_code      VARCHAR,
    p_justification    TEXT,
    p_user             UUID,
    p_user_roles       TEXT[],
    p_force_negative   BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
    v_item         inv_items%ROWTYPE;
    v_reason       inv_adjustment_reasons%ROWTYPE;
    v_stock_qty    NUMERIC;
    v_new_qty      NUMERIC;
    v_abs_pct      NUMERIC;
    v_is_admin     BOOLEAN;
    v_movement_id  UUID;
BEGIN
    IF p_delta IS NULL OR p_delta = 0 THEN
        RAISE EXCEPTION 'Delta do ajuste não pode ser zero' USING ERRCODE = '22023';
    END IF;
    IF p_justification IS NULL OR btrim(p_justification) = '' THEN
        RAISE EXCEPTION 'Justificação é obrigatória em ajustes (§10.2)' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_item FROM inv_items WHERE id = p_item AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado' USING ERRCODE='02000'; END IF;

    SELECT * INTO v_reason FROM inv_adjustment_reasons WHERE code = p_reason_code AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Motivo de ajuste inválido: %', p_reason_code USING ERRCODE='22023'; END IF;

    v_is_admin := 'Inventory_Admin' = ANY(p_user_roles) OR 'admin' = ANY(p_user_roles) OR 'Admin' = ANY(p_user_roles);

    -- Stock atual no triplo
    IF p_lot IS NULL THEN
        SELECT quantity INTO v_stock_qty FROM inv_stock
         WHERE item_id = p_item AND location_id = p_location AND lot_id IS NULL;
    ELSE
        SELECT quantity INTO v_stock_qty FROM inv_stock
         WHERE item_id = p_item AND location_id = p_location AND lot_id = p_lot;
    END IF;
    v_stock_qty := COALESCE(v_stock_qty, 0);
    v_new_qty   := v_stock_qty + p_delta;

    -- RF06: ajuste com magnitude > 5% exige Inventory_Admin
    v_abs_pct := ABS(p_delta) / GREATEST(v_stock_qty, 1);
    IF v_abs_pct > 0.05 AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Ajuste > 5%% do stock atual requer perfil Inventory_Admin (RF06)' USING ERRCODE = '42501';
    END IF;

    -- RN05 exceção: stock pode ficar negativo apenas se Admin + force_negative
    IF v_new_qty < 0 THEN
        IF NOT v_is_admin THEN
            RAISE EXCEPTION 'Ajuste resultaria em stock negativo — requer Inventory_Admin (RN05)' USING ERRCODE = '42501';
        END IF;
        IF NOT p_force_negative THEN
            RAISE EXCEPTION 'NEGATIVE_STOCK_CONFIRMATION_REQUIRED|current=%|after=%|delta=%',
                v_stock_qty, v_new_qty, p_delta USING ERRCODE = 'P0004';
        END IF;
    END IF;

    -- Aplica ajuste (UPSERT manual)
    IF p_lot IS NULL THEN
        UPDATE inv_stock SET quantity = v_new_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_location AND lot_id IS NULL;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (p_item, p_location, NULL, v_new_qty);
        END IF;
    ELSE
        UPDATE inv_stock SET quantity = v_new_qty, updated_at = NOW()
         WHERE item_id = p_item AND location_id = p_location AND lot_id = p_lot;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (p_item, p_location, p_lot, v_new_qty);
        END IF;
    END IF;

    -- Movimento (qty é sempre positiva — sinal vai no subtype)
    INSERT INTO inv_movements (
        type, subtype, item_id, lot_id,
        from_location_id, to_location_id,
        quantity, unit_cost, total_cost, cmp_at_moment, justification, user_id
    ) VALUES (
        'ajuste',
        p_reason_code || (CASE WHEN p_delta < 0 THEN '_neg' ELSE '_pos' END),
        p_item, p_lot,
        CASE WHEN p_delta < 0 THEN p_location ELSE NULL END,
        CASE WHEN p_delta > 0 THEN p_location ELSE NULL END,
        ABS(p_delta), v_item.cmp, ABS(p_delta) * v_item.cmp, v_item.cmp,
        p_justification, p_user
    ) RETURNING id INTO v_movement_id;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO PÓS-EXECUÇÃO
-- =====================================================
SELECT 'inv_adjustment_reasons' AS objeto, COUNT(*)::TEXT AS valor FROM inv_adjustment_reasons
UNION ALL
SELECT 'vw_inv_patrimony_locations', COUNT(*)::TEXT FROM vw_inv_patrimony_locations
UNION ALL
SELECT 'fn_inv_consume', pg_get_function_identity_arguments('fn_inv_consume'::regproc)
UNION ALL
SELECT 'fn_inv_transfer', pg_get_function_identity_arguments('fn_inv_transfer'::regproc)
UNION ALL
SELECT 'fn_inv_adjust', pg_get_function_identity_arguments('fn_inv_adjust'::regproc);
