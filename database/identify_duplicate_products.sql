-- Encontrar produtos duplicados (mesmo nome, marca, lote, criados quase ao mesmo tempo)
-- Execute este script primeiro para VISUALIZAR os duplicados antes de deletar

WITH duplicates AS (
    SELECT 
        p.nome_material,
        p.marca,
        COALESCE(p.referencia_lote, 'SEM_LOTE') as lote,
        p.data_criacao::date as dia_criacao,
        COUNT(*) as qtd_duplicadas,
        ARRAY_AGG(p.id ORDER BY p.data_criacao) as ids,
        ARRAY_AGG(p.data_criacao ORDER BY p.data_criacao) as datas,
        MIN(p.data_criacao) as primeira_criacao,
        MAX(p.data_criacao) as ultima_criacao,
        ARRAY_AGG(DISTINCT COALESCE(e.quantidade_atual, 0)) as estoques
    FROM produtoslaboratorio p
    LEFT JOIN estoquelaboratorio e ON e.produto_id = p.id
    WHERE p.ativo = true AND p.deleted_at IS NULL
    GROUP BY p.nome_material, p.marca, COALESCE(p.referencia_lote, 'SEM_LOTE'), p.data_criacao::date
    HAVING COUNT(*) > 1
)
SELECT 
    nome_material,
    marca,
    lote,
    dia_criacao,
    qtd_duplicadas,
    ids,
    estoques,
    primeira_criacao,
    ultima_criacao,
    EXTRACT(EPOCH FROM (ultima_criacao - primeira_criacao)) as segundos_entre_duplicatas,
    -- Flag se os estoques são idênticos (mais provável ser duplicata legítima)
    CASE 
        WHEN ARRAY_LENGTH(estoques, 1) = 1 THEN 'ESTOQUES_IDENTICOS'
        ELSE 'ESTOQUES_DIFERENTES'
    END as status_estoque
FROM duplicates
ORDER BY qtd_duplicadas DESC, dia_criacao DESC;

-- Estatísticas gerais
SELECT 
    COUNT(DISTINCT nome_material || marca || lote) as produtos_unicos_afetados,
    SUM(qtd_duplicadas) as total_duplicatas,
    SUM(qtd_duplicadas - 1) as registros_a_remover,
    SUM(CASE WHEN ARRAY_LENGTH(estoques, 1) = 1 THEN qtd_duplicadas - 1 ELSE 0 END) as duplicatas_com_estoque_identico,
    SUM(CASE WHEN ARRAY_LENGTH(estoques, 1) > 1 THEN qtd_duplicadas - 1 ELSE 0 END) as duplicatas_com_estoque_diferente
FROM (
    SELECT 
        p.nome_material,
        p.marca,
        COALESCE(p.referencia_lote, 'SEM_LOTE') as lote,
        p.data_criacao::date as dia_criacao,
        COUNT(*) as qtd_duplicadas,
        ARRAY_AGG(DISTINCT COALESCE(e.quantidade_atual, 0)) as estoques
    FROM produtoslaboratorio p
    LEFT JOIN estoquelaboratorio e ON e.produto_id = p.id
    WHERE p.ativo = true AND p.deleted_at IS NULL
    GROUP BY p.nome_material, p.marca, COALESCE(p.referencia_lote, 'SEM_LOTE'), p.data_criacao::date
    HAVING COUNT(*) > 1
) subquery;
