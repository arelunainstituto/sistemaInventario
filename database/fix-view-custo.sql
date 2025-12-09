-- =====================================================
-- FIX V2: Adicionar custo_unitario à view vw_produtos_estoque
-- Data: 2025-10-21 (Atualizado)
-- =====================================================
-- Este script atualiza a view vw_produtos_estoque para incluir
-- informações de custo unitário dos produtos
-- 
-- CORREÇÕES APLICADAS:
--   ✅ c.custo_unitario → c.preco_unitario (campo correto)
--   ✅ c.data_registro → c.data_compra (campo correto)
-- =====================================================

-- Recriar a view com as informações de custo CORRETAS
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
    -- Custo médio de todas as compras
    (
        SELECT AVG(c.preco_unitario)
        FROM custoslaboratorio c
        WHERE c.produto_id = p.id 
        AND c.deleted_at IS NULL 
        AND c.ativo = TRUE
    ) AS custo_medio_unitario,
    -- Último custo de compra (mais recente)
    (
        SELECT c.preco_unitario
        FROM custoslaboratorio c
        WHERE c.produto_id = p.id 
        AND c.deleted_at IS NULL 
        AND c.ativo = TRUE
        ORDER BY c.data_compra DESC
        LIMIT 1
    ) AS custo_unitario
FROM produtoslaboratorio p
LEFT JOIN estoquelaboratorio e ON p.id = e.produto_id
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW vw_produtos_estoque IS 'View consolidada de produtos com informações de estoque e custo';

-- Verificar se a view foi criada corretamente
SELECT 
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_name = 'vw_produtos_estoque'
ORDER BY ordinal_position;

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ View vw_produtos_estoque atualizada com sucesso!';
    RAISE NOTICE 'Agora a view inclui os campos:';
    RAISE NOTICE '  - custo_medio_unitario: Média dos preços de compra';
    RAISE NOTICE '  - custo_unitario: Último preço de compra';
    RAISE NOTICE '  - referencia_lote, descricao, observacoes';
END $$;

