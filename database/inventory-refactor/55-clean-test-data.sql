-- =====================================================
-- INVENTORY REFACTOR — Limpeza de dados de teste
-- =====================================================
-- Objetivo: preparar o sistema para importação inicial da planilha
-- do Instituto Areluna. Apaga TUDO que foi criado durante o
-- desenvolvimento/validação (itens, entradas, saídas, categorias,
-- localizações e fornecedores com nome "teste"/similar) e zera as
-- tabelas operacionais que dependem desses dados.
--
-- Preserva:
--   • Estrutura (roles, permissions, modules, system_settings)
--   • Roles do inventário (Inventory_Admin/Operador/Consulta/Contabilidade)
--   • Configurações do log de acesso
--   • Unidades operacionais (inv_units: Marquês, Cristal, ProStoral)
--     — só remove sublocais que tenham "teste" no nome
--   • inv_access_log (auditoria histórica)
--
-- Apaga:
--   • Todos os movimentos (TRUNCATE — RN07 impede DELETE seletivo)
--   • Todo o stock atual
--   • Todas as entradas/saídas/inventários físicos
--   • Lotes (vão ser recriados nas primeiras entradas reais)
--   • Overrides de parâmetros por localização
--   • Execuções de depreciação
--   • Itens/categorias/locations/suppliers com "teste" no nome
--
-- Reset:
--   • Sequence seq_inv_sku para 1 (próxima importação começa em SKU001)
--   • Sequence seq_inv_patrimony para 1
--
-- ⚠️ DESTRUTIVO — rodar apenas em ambiente vazio/pré-produção.
-- Idempotente: pode ser rodado várias vezes sem efeito adicional após o primeiro.
-- =====================================================

BEGIN;

-- ---------- 1) Operacional: zerar tudo ----------
-- TRUNCATE CASCADE remove dados transacionais que dependem dos cadastros.
-- Usamos TRUNCATE para inv_movements porque RN07 (fn_inv_movements_immutable)
-- bloqueia UPDATE/DELETE; TRUNCATE é DDL e bypassa triggers de linha.

TRUNCATE TABLE
    inv_movements,
    inv_stock,
    inv_lots,
    inv_entry_lines,
    inv_entries,
    inv_inventory_counts,
    inv_inventory_sessions,
    inv_item_location_params,
    inv_depreciation_runs
RESTART IDENTITY CASCADE;

-- ---------- 2) Apagar itens de teste ----------
-- Preserva itens reais cadastrados pelo usuário (se houver).
DELETE FROM inv_items
 WHERE name ILIKE '%teste%'
    OR name ILIKE '%test%'
    OR internal_code ILIKE 'TEST%';

-- ---------- 3) Apagar sublocais de teste ----------
-- (inv_units = Marquês/Cristal/ProStoral fica intacto; só sublocais)
DELETE FROM inv_locations
 WHERE name ILIKE '%teste%'
    OR name ILIKE '%test%';

-- ---------- 4) Apagar categorias de teste ----------
DELETE FROM inv_categories
 WHERE name ILIKE '%teste%'
    OR name ILIKE '%test%';

-- ---------- 5) Apagar fornecedores de teste ----------
DELETE FROM inv_suppliers
 WHERE name ILIKE '%teste%'
    OR name ILIKE '%test%';

-- ---------- 6) Reset das sequences para SKU e PAT começarem do 1 ----------
DO $$
BEGIN
    -- seq_inv_sku é a sequence usada por fn_inv_generate_sku
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'seq_inv_sku') THEN
        PERFORM setval('seq_inv_sku', 1, false);
        RAISE NOTICE 'Sequence seq_inv_sku resetada para 1';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'seq_inv_patrimony') THEN
        PERFORM setval('seq_inv_patrimony', 1, false);
        RAISE NOTICE 'Sequence seq_inv_patrimony resetada para 1';
    END IF;
END $$;

-- ---------- 7) Helper RPC para o importador ajustar a sequence ----------
-- Usado depois de inserir SKUs com internal_code explícito (SKU001-SKU254).
-- O próximo item criado por trigger usará seq_inv_sku.nextval = max+1.
CREATE OR REPLACE FUNCTION fn_inv_set_sku_sequence(p_value INTEGER)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN setval('seq_inv_sku', GREATEST(p_value, 1), true);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_inv_set_sku_sequence(INTEGER) TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- 1) Contadores devem mostrar 0 nas tabelas operacionais
SELECT 'inv_movements'             AS tabela, COUNT(*) AS rows FROM inv_movements
UNION ALL SELECT 'inv_stock',                COUNT(*) FROM inv_stock
UNION ALL SELECT 'inv_lots',                 COUNT(*) FROM inv_lots
UNION ALL SELECT 'inv_entries',              COUNT(*) FROM inv_entries
UNION ALL SELECT 'inv_entry_lines',          COUNT(*) FROM inv_entry_lines
UNION ALL SELECT 'inv_inventory_sessions',   COUNT(*) FROM inv_inventory_sessions
UNION ALL SELECT 'inv_inventory_counts',     COUNT(*) FROM inv_inventory_counts
UNION ALL SELECT 'inv_item_location_params', COUNT(*) FROM inv_item_location_params
UNION ALL SELECT 'inv_depreciation_runs',    COUNT(*) FROM inv_depreciation_runs;

-- 2) Itens/categorias/locations/suppliers restantes (após apagar testes)
SELECT 'inv_items'      AS tabela, COUNT(*) AS rows FROM inv_items
UNION ALL SELECT 'inv_categories', COUNT(*) FROM inv_categories
UNION ALL SELECT 'inv_locations',  COUNT(*) FROM inv_locations
UNION ALL SELECT 'inv_suppliers',  COUNT(*) FROM inv_suppliers
UNION ALL SELECT 'inv_units',      COUNT(*) FROM inv_units;

-- 3) Unidades preservadas (Marquês/Cristal/ProStoral)
SELECT id, code, name, is_active FROM inv_units ORDER BY name;

-- 4) Sequences resetadas
SELECT sequencename, last_value
  FROM pg_sequences
 WHERE sequencename IN ('seq_inv_sku', 'seq_inv_patrimony');
