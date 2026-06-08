-- =====================================================
-- INVENTORY REFACTOR — 100. Feature flag: permitir stock negativo
-- =====================================================
-- Cenário: durante a fase inicial de cadastro/lançamentos (seeding),
-- operadores precisam fazer saídas mesmo quando o stock no sistema
-- ainda não reflete a realidade do físico. RN05 (não-negativo)
-- bloqueia isso por design.
--
-- Esta migração adiciona uma feature flag GLOBAL em inv_system_settings:
--   • OFF (default)  → RN05 aplica como sempre (operador NÃO consegue
--                       deixar negativo; só admin via fn_inv_adjust).
--   • ON             → fn_inv_consume e fn_inv_adjust permitem que
--                       o stock fique negativo para QUALQUER role.
--                       Útil temporariamente — DESLIGAR após o seeding.
--
-- Toggle de uso (após aplicar a migration uma vez):
--   ON:   SELECT fn_inv_set_negative_stock(TRUE);
--   OFF:  SELECT fn_inv_set_negative_stock(FALSE);
--   READ: SELECT fn_inv_negative_stock_allowed();
--
-- Idempotente.
-- =====================================================

BEGIN;

-- ---------- 1) Setting ----------
INSERT INTO inv_system_settings (key, value, description) VALUES
    ('allow_negative_stock', 'false',
     'Quando true, fn_inv_consume e fn_inv_adjust permitem stock negativo para qualquer role. Use temporariamente durante seeding.')
ON CONFLICT (key) DO NOTHING;

-- ---------- 2) Helper: lê o flag ----------
CREATE OR REPLACE FUNCTION fn_inv_negative_stock_allowed()
RETURNS BOOLEAN
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT lower(btrim(value)) IN ('true','t','1','yes','on')
           FROM inv_system_settings
          WHERE key = 'allow_negative_stock'),
        FALSE
    );
$$;

GRANT EXECUTE ON FUNCTION fn_inv_negative_stock_allowed() TO authenticated;

-- ---------- 3) Helper: toggle ----------
CREATE OR REPLACE FUNCTION fn_inv_set_negative_stock(p_enabled BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TEXT := to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS TZ');
BEGIN
    INSERT INTO inv_system_settings (key, value, description, updated_at, updated_by)
    VALUES (
        'allow_negative_stock',
        CASE WHEN p_enabled THEN 'true' ELSE 'false' END,
        'Quando true, fn_inv_consume e fn_inv_adjust permitem stock negativo para qualquer role.',
        NOW(),
        NULL
    )
    ON CONFLICT (key) DO UPDATE SET
        value      = EXCLUDED.value,
        updated_at = NOW();

    RETURN 'allow_negative_stock = ' || CASE WHEN p_enabled THEN 'TRUE (PERMITIDO)' ELSE 'false (bloqueado)' END
           || ' @ ' || v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_inv_set_negative_stock(BOOLEAN) TO authenticated;

-- ---------- 4) fn_inv_consume: bypass condicional ----------
-- Reaproveita a versão vigente (Fase 4 — min_stock efetivo) e adiciona
-- check do flag na verificação de stock insuficiente.
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

        IF v_lot_id IS NULL THEN
            RAISE EXCEPTION 'Item % controla lote (RN03): nenhum lote disponível na localização', v_item.name
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF v_item.controls_lot AND v_lot_id IS NULL THEN
        RAISE EXCEPTION 'Item % controla lote — lote é obrigatório (RN03)', v_item.name
            USING ERRCODE = 'P0001';
    END IF;

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

-- ---------- 5) fn_inv_adjust: bypass condicional ----------
-- Mantém RF06 (>5% = Admin) intacto. Apenas relaxa a RN05 quando o
-- flag está ON: qualquer role consegue deixar negativo, com a
-- confirmação NEGATIVE_STOCK_CONFIRMATION_REQUIRED continuando obrigatória
-- (o frontend já faz double-confirm via force_negative).
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
    v_can_neg      BOOLEAN;
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
    v_can_neg  := v_is_admin OR fn_inv_negative_stock_allowed();

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

    -- RF06: ajuste com magnitude > 5% exige Inventory_Admin (NÃO RELAXA com o flag)
    v_abs_pct := ABS(p_delta) / GREATEST(v_stock_qty, 1);
    IF v_abs_pct > 0.05 AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Ajuste > 5%% do stock atual requer perfil Inventory_Admin (RF06)' USING ERRCODE = '42501';
    END IF;

    -- RN05 com bypass: Admin OU flag global ligado pode deixar negativo.
    -- Confirmação dupla (force_negative) continua exigida pelo frontend.
    IF v_new_qty < 0 THEN
        IF NOT v_can_neg THEN
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
-- VERIFICAÇÃO
-- =====================================================

-- Estado atual do flag
SELECT key, value, description, updated_at
  FROM inv_system_settings
 WHERE key = 'allow_negative_stock';

-- Test do helper
SELECT fn_inv_negative_stock_allowed() AS allow_negative_stock_now;

-- =====================================================
-- COMO USAR (depois desta migration aplicada)
-- =====================================================
--
-- LIGAR (permitir stock negativo para todos):
--   SELECT fn_inv_set_negative_stock(TRUE);
--
-- DESLIGAR (voltar ao comportamento normal, RN05 estrito):
--   SELECT fn_inv_set_negative_stock(FALSE);
--
-- CONSULTAR o estado:
--   SELECT fn_inv_negative_stock_allowed();
--
-- Não precisa de deploy de código pra mudar — toggle é só SQL.
