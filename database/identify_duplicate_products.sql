-- Encontrar produtos duplicados (mesmo nome, marca, criados quase ao mesmo tempo)
-- Execute este script primeiro para VISUALIZAR os duplicados antes de deletar

WITH duplicates AS (
    SELECT 
        nome_material,
        marca,
        data_criacao::date as dia_criacao,
        COUNT(*) as qtd_duplicadas,
        ARRAY_AGG(id ORDER BY data_criacao) as ids,
        ARRAY_AGG(data_criacao ORDER BY data_criacao) as datas,
        MIN(data_criacao) as primeira_criacao,
        MAX(data_criacao) as ultima_criacao
    FROM produtoslaboratorio
    WHERE ativo = true AND deleted_at IS NULL
    GROUP BY nome_material, marca, data_criacao::date
    HAVING COUNT(*) > 1
)
SELECT 
    nome_material,
    marca,
    dia_criacao,
    qtd_duplicadas,
    ids,
    primeira_criacao,
    ultima_criacao,
    EXTRACT(EPOCH FROM (ultima_criacao - primeira_criacao)) as segundos_entre_duplicatas
FROM duplicates
ORDER BY qtd_duplicadas DESC, dia_criacao DESC;

-- Estatísticas gerais
SELECT 
    COUNT(DISTINCT nome_material || marca) as produtos_unicos_afetados,
    SUM(qtd_duplicadas) as total_duplicatas,
    SUM(qtd_duplicadas - 1) as registros_a_remover
FROM (
    SELECT 
        nome_material,
        marca,
        data_criacao::date as dia_criacao,
        COUNT(*) as qtd_duplicadas
    FROM produtoslaboratorio
    WHERE ativo = true AND deleted_at IS NULL
    GROUP BY nome_material, marca, data_criacao::date
    HAVING COUNT(*) > 1
) subquery;
