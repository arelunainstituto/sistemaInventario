-- Encontrar movimentações duplicadas (mesmo produto, quantidade, tipo, timestamp próximo)
-- Execute este script primeiro para VISUALIZAR os duplicados antes de deletar

WITH duplicates AS (
    SELECT 
        produto_id,
        tipo,
        quantidade,
        DATE_TRUNC('minute', data_movimentacao) as minuto,
        COUNT(*) as qtd_duplicadas,
        ARRAY_AGG(id ORDER BY data_movimentacao) as ids,
        ARRAY_AGG(data_movimentacao ORDER BY data_movimentacao) as datas,
        MIN(data_movimentacao) as primeira_movimentacao,
        MAX(data_movimentacao) as ultima_movimentacao
    FROM movimentacoeslaboratorio
    GROUP BY produto_id, tipo, quantidade, DATE_TRUNC('minute', data_movimentacao)
    HAVING COUNT(*) > 1
)
SELECT 
    d.produto_id,
    p.nome_material,
    p.marca,
    d.tipo,
    d.quantidade,
    d.minuto,
    d.qtd_duplicadas,
    d.ids,
    d.primeira_movimentacao,
    d.ultima_movimentacao,
    EXTRACT(EPOCH FROM (d.ultima_movimentacao - d.primeira_movimentacao)) as segundos_entre_duplicatas
FROM duplicates d
JOIN produtoslaboratorio p ON p.id = d.produto_id
ORDER BY d.qtd_duplicadas DESC, d.minuto DESC;

-- Estatísticas gerais
SELECT 
    COUNT(*) as grupos_duplicados,
    SUM(qtd_duplicadas) as total_movimentacoes_duplicadas,
    SUM(qtd_duplicadas - 1) as registros_a_remover,
    SUM(CASE WHEN tipo = 'entrada' THEN qtd_duplicadas - 1 ELSE 0 END) as entradas_a_remover,
    SUM(CASE WHEN tipo = 'saida' THEN qtd_duplicadas - 1 ELSE 0 END) as saidas_a_remover
FROM (
    SELECT 
        produto_id,
        tipo,
        quantidade,
        DATE_TRUNC('minute', data_movimentacao) as minuto,
        COUNT(*) as qtd_duplicadas
    FROM movimentacoeslaboratorio
    GROUP BY produto_id, tipo, quantidade, DATE_TRUNC('minute', data_movimentacao)
    HAVING COUNT(*) > 1
) subquery;
