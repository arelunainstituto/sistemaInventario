-- =====================================================
-- FIX V2: Correção dos campos custo_unitario na view
-- Data: 2025-10-21
-- =====================================================
-- PROBLEMA IDENTIFICADO:
-- A view estava usando campos INEXISTENTES:
--   ❌ c.custo_unitario  → Correto: c.preco_unitario
--   ❌ c.data_registro   → Correto: c.data_compra
-- =====================================================

-- Recriar a view com os campos CORRETOS
CREATE OR REPLACE VIEW vw_produtos_estoque AS
SELECT 
    p.id,
    p.qr_code,
    p.codigo_barras,
    p.categoria,
    p.nome_material,
    p.marca,
    p.fornecedor,
    p.referencia_lote,
    p.unidade_medida,
    p.localizacao,
    p.data_validade,
    p.descricao,
    p.observacoes,
    p.ativo,
    COALESCE(e.quantidade_atual, 0) AS quantidade_atual,
    COALESCE(e.quantidade_minima, 0) AS quantidade_minima,
    COALESCE(e.quantidade_maxima, 0) AS quantidade_maxima,
    COALESCE(e.status, 'ok') AS status,
    e.ultima_entrada,
    e.ultima_saida,
    e.ultima_atualizacao,
    -- ✅ CORRIGIDO: usando preco_unitario (não custo_unitario)
    (
        SELECT AVG(c.preco_unitario)
        FROM custoslaboratorio c
        WHERE c.produto_id = p.id 
        AND c.deleted_at IS NULL 
        AND c.ativo = TRUE
    ) AS custo_medio_unitario,
    -- ✅ CORRIGIDO: usando preco_unitario e data_compra
    (
        SELECT c.preco_unitario
        FROM custoslaboratorio c
        WHERE c.produto_id = p.id 
        AND c.deleted_at IS NULL 
        AND c.ativo = TRUE
        ORDER BY c.data_compra DESC  -- ✅ CORRIGIDO: era data_registro
        LIMIT 1
    ) AS custo_unitario
FROM produtoslaboratorio p
LEFT JOIN estoquelaboratorio e ON p.id = e.produto_id
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW vw_produtos_estoque IS 'View consolidada de produtos com informações de estoque e custo (CORRIGIDA v2)';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- 1. Ver a estrutura da view
SELECT 
    column_name, 
    data_type,
    CASE 
        WHEN column_name IN ('custo_unitario', 'custo_medio_unitario') THEN '✅ Campo de custo'
        ELSE ''
    END as nota
FROM information_schema.columns
WHERE table_name = 'vw_produtos_estoque'
ORDER BY ordinal_position;

-- 2. Testar se os dados aparecem (executar após a correção)
SELECT 
    nome_material,
    categoria,
    quantidade_atual,
    custo_unitario,
    custo_medio_unitario,
    CASE 
        WHEN custo_unitario IS NULL THEN '⚠️ Sem registro de custo'
        ELSE '✅ Custo encontrado'
    END as status_custo
FROM vw_produtos_estoque
LIMIT 10;

-- =====================================================
-- MENSAGEM DE SUCESSO
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ========================================';
    RAISE NOTICE '✅ View vw_produtos_estoque CORRIGIDA!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Correções aplicadas:';
    RAISE NOTICE '  ✅ c.custo_unitario → c.preco_unitario';
    RAISE NOTICE '  ✅ c.data_registro → c.data_compra';
    RAISE NOTICE '  ✅ Adicionados filtros: deleted_at e ativo';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Campos disponíveis na view:';
    RAISE NOTICE '  • custo_unitario - Último preço de compra';
    RAISE NOTICE '  • custo_medio_unitario - Média dos preços';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Execute o SELECT acima para testar!';
    RAISE NOTICE '';
END $$;

