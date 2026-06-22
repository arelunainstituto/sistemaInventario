-- =====================================================
-- INVENTORY REFACTOR — 114. controls_lot manual (checkbox no cadastro)
-- =====================================================
-- Até aqui, fn_inv_items_before_insert FORÇAVA controls_lot = TRUE para todo
-- item de consumo (RN03). Agora o cadastro do item tem um checkbox "controla
-- lote", então itens de consumo podem optar por NÃO controlar lote (saída
-- abate direto do saldo, sem FEFO).
--
-- Mudança mínima: para consumo, em vez de sobrescrever para TRUE, usa o valor
-- informado (COALESCE com TRUE como default — mantém o comportamento antigo
-- quando o campo não vem). Patrimônio continua controls_lot=FALSE /
-- uses_serial=TRUE (controla por número de série, não por lote).
--
-- O resto da função (formato do internal_code 1XXXXXX/2XXXXXX da migração 60,
-- patrimony_number, asset_status, reorder_point) é preservado IDÊNTICO.
--
-- Idempotente (CREATE OR REPLACE). Trigger BEFORE INSERT — edições de
-- controls_lot vão direto na coluna via UPDATE (a API valida).
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_inv_items_before_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Código de Registro Interno (formato 1XXXXXX / 2XXXXXX — migração 60)
    IF NEW.internal_code IS NULL OR NEW.internal_code = '' THEN
        IF NEW.macro_category = 'consumo' THEN
            NEW.internal_code := '1' || LPAD(nextval('seq_inv_code_consumo')::TEXT, 6, '0');
        ELSIF NEW.macro_category = 'patrimonial' THEN
            NEW.internal_code := '2' || LPAD(nextval('seq_inv_code_patrimonio')::TEXT, 6, '0');
        END IF;
    END IF;

    -- Lote/serial por categoria (RN03).
    -- CONSUMO: controls_lot agora é escolha do usuário (checkbox no cadastro).
    --   Default TRUE quando não informado, preservando o comportamento antigo.
    -- PATRIMONIAL: sempre por número de série (controls_lot=FALSE).
    IF NEW.macro_category = 'consumo' THEN
        NEW.controls_lot := COALESCE(NEW.controls_lot, TRUE);
        NEW.uses_serial  := FALSE;
    ELSIF NEW.macro_category = 'patrimonial' THEN
        NEW.controls_lot := FALSE;
        NEW.uses_serial  := TRUE;
        IF NEW.patrimony_number IS NULL THEN
            NEW.patrimony_number := 'PAT-' || LPAD(nextval('seq_inv_patrimony')::TEXT, 6, '0');
        END IF;
        IF NEW.asset_status IS NULL THEN
            NEW.asset_status := 'em_uso';
        END IF;
    END IF;

    IF NEW.reorder_point IS NULL OR NEW.reorder_point = 0 THEN
        NEW.reorder_point := NEW.min_stock;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- A função deve preservar o valor informado para consumo (deve retornar > 0):
--   SELECT count(*) FROM pg_proc
--    WHERE proname = 'fn_inv_items_before_insert'
--      AND pg_get_functiondef(oid) LIKE '%COALESCE(NEW.controls_lot, TRUE)%';
