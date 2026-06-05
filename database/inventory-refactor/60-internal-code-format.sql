-- =====================================================
-- INVENTORY REFACTOR — 60. Código de Registro Interno (novo formato)
-- =====================================================
-- Substitui o esquema `SKU` (SKUXXX, 3 dígitos, pool único, gerado por
-- seq_inv_sku) por DOIS pools independentes prefixados pelo tipo de
-- produto:
--
--   • Uso e Consumo  →  1XXXXXX   (prefixo '1', 6 dígitos sequenciais)
--   • Patrimônio     →  2XXXXXX   (prefixo '2', 6 dígitos sequenciais)
--
-- Exemplos:
--   1000001  Seringa 25ml
--   1000002  Máscara descartável
--   2000001  Notebook 8Gb 512Gb
--   2000002  Smartphone 5G 256Gb
--
-- Justificativa: SKU exige composição lógica (Tipo + Produto + Marca +
-- Variação) que o sistema ainda NÃO suporta. Até que essa estrutura
-- exista, o identificador do cadastro passa a ser apenas o
-- "Código de Registro Interno" — uma sequência simples prefixada pelo
-- tipo, suficiente para identificar o cadastro sem mascarar atributos.
--
-- REQUER MIGRAÇÃO MANUAL. Aplicar UMA VEZ no ambiente, antes do
-- importador rodar com a planilha real (após 55-clean-test-data.sql).
--
-- Idempotente: re-aplicar não causa dano.
-- =====================================================

BEGIN;

-- ---------- 1) Novas sequences por tipo de produto ----------
CREATE SEQUENCE IF NOT EXISTS seq_inv_code_consumo    START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_inv_code_patrimonio START 1 INCREMENT 1;

GRANT USAGE ON SEQUENCE seq_inv_code_consumo, seq_inv_code_patrimonio TO authenticated;

-- ---------- 2) Reescrever a função BEFORE INSERT do inv_items ----------
-- Esta função já existe (criada em 30-fase3). Aqui substituímos a
-- geração do internal_code para usar o novo formato.
-- Mantemos a lógica de patrimony_number, controls_lot/uses_serial e
-- reorder_point exatamente como estava.

CREATE OR REPLACE FUNCTION fn_inv_items_before_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Código de Registro Interno (novo formato 1XXXXXX / 2XXXXXX)
    IF NEW.internal_code IS NULL OR NEW.internal_code = '' THEN
        IF NEW.macro_category = 'consumo' THEN
            NEW.internal_code := '1' || LPAD(nextval('seq_inv_code_consumo')::TEXT, 6, '0');
        ELSIF NEW.macro_category = 'patrimonial' THEN
            NEW.internal_code := '2' || LPAD(nextval('seq_inv_code_patrimonio')::TEXT, 6, '0');
        END IF;
    END IF;

    -- Lote/serial automáticos por categoria (RN03)
    IF NEW.macro_category = 'consumo' THEN
        NEW.controls_lot := TRUE;
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

-- ---------- 3) Helper RPC para reiniciar contadores ----------
-- Permite ao operador (ou ao importador, em cenário excepcional)
-- definir o próximo valor de cada sequence sem precisar acessar
-- o SQL Editor diretamente.
--   SELECT fn_inv_set_code_sequences(255, 0);   -- consumo=255, patrim=0
--   SELECT fn_inv_set_code_sequences(NULL, 10); -- só patrimônio=10
DROP FUNCTION IF EXISTS fn_inv_set_code_sequences(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION fn_inv_set_code_sequences(
    p_consumo    INTEGER DEFAULT NULL,
    p_patrimonio INTEGER DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_msg TEXT := '';
BEGIN
    IF p_consumo IS NOT NULL THEN
        PERFORM setval('seq_inv_code_consumo',    GREATEST(p_consumo, 1),    p_consumo > 0);
        v_msg := v_msg || 'consumo=' || p_consumo || ' ';
    END IF;
    IF p_patrimonio IS NOT NULL THEN
        PERFORM setval('seq_inv_code_patrimonio', GREATEST(p_patrimonio, 1), p_patrimonio > 0);
        v_msg := v_msg || 'patrimonio=' || p_patrimonio;
    END IF;
    RETURN COALESCE(NULLIF(TRIM(v_msg), ''), 'nenhuma alteração');
END;
$$;

GRANT EXECUTE ON FUNCTION fn_inv_set_code_sequences(INTEGER, INTEGER) TO authenticated;

-- ---------- 4) Cleanup do esquema antigo ----------
-- Remove a sequence e o helper antigos. Se ainda houver items com
-- internal_code no formato "SKUXXX" (sobreviventes da limpeza), eles
-- ficam intactos — só o gerador é trocado.
DROP FUNCTION IF EXISTS fn_inv_set_sku_sequence(INTEGER);
DROP SEQUENCE IF EXISTS seq_inv_sku;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- 1) Novas sequences existem e começam em 1
SELECT sequencename, last_value
  FROM pg_sequences
 WHERE sequencename IN ('seq_inv_code_consumo', 'seq_inv_code_patrimonio', 'seq_inv_patrimony')
 ORDER BY sequencename;

-- 2) Sequence antiga não existe mais
SELECT 'seq_inv_sku ainda existe? (esperado: 0 linhas)' AS check
UNION ALL
SELECT sequencename FROM pg_sequences WHERE sequencename = 'seq_inv_sku';

-- 3) Smoke test (NÃO executa INSERT — apenas mostra o próximo código que sairia)
SELECT
    '1' || LPAD((nextval('seq_inv_code_consumo'))::TEXT, 6, '0') AS proximo_consumo,
    '2' || LPAD((nextval('seq_inv_code_patrimonio'))::TEXT, 6, '0') AS proximo_patrimonio;
-- ⚠️ As duas chamadas acima consumiram 1 número de cada sequence. Se
-- quiser voltar para 1, rode:
--   SELECT fn_inv_set_code_sequences(0, 0);
