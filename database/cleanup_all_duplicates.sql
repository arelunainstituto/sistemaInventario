-- ================================================
-- SCRIPT COMPLETO DE LIMPEZA DO PROSTORAL
-- ================================================
-- Execute este script COMPLETO de uma vez após backup
-- Ele vai limpar produtos E movimentações duplicadas

BEGIN;

-- ================================================
-- PASSO 1: Remover Produtos Duplicados
-- ================================================

CREATE TEMP TABLE produtos_to_deactivate AS
WITH duplicates AS (
    SELECT 
        p.nome_material,
        p.marca,
        COALESCE(p.referencia_lote, 'SEM_LOTE') as lote,
        p.data_criacao::date as dia_criacao,
        ARRAY_AGG(p.id ORDER BY p.data_criacao) as ids,
        ARRAY_AGG(DISTINCT COALESCE(e.quantidade_atual, 0)) as estoques
    FROM produtoslaboratorio p
    LEFT JOIN estoquelaboratorio e ON e.produto_id = p.id
    WHERE p.ativo = true AND p.deleted_at IS NULL
    GROUP BY p.nome_material, p.marca, COALESCE(p.referencia_lote, 'SEM_LOTE'), p.data_criacao::date
    HAVING COUNT(*) > 1
    AND ARRAY_LENGTH(ARRAY_AGG(DISTINCT COALESCE(e.quantidade_atual, 0)), 1) = 1
)
SELECT UNNEST(ids[2:]) as id_to_deactivate
FROM duplicates;

-- Desativar produtos duplicados
UPDATE produtoslaboratorio
SET 
    ativo = false,
    deleted_at = NOW(),
    observacoes = COALESCE(observacoes || E'\n', '') || '⚠️ Removido automaticamente - duplicado em ' || NOW()::date
WHERE id IN (SELECT id_to_deactivate FROM produtos_to_deactivate);

SELECT 
    COUNT(*) as produtos_desativados
FROM produtos_to_deactivate;

-- ================================================
-- PASSO 2: Remover Movimentações Duplicadas
-- ================================================

CREATE TEMP TABLE movimentacoes_to_delete AS
WITH duplicates AS (
    SELECT 
        produto_id,
        tipo,
        quantidade,
        DATE_TRUNC('minute', data_movimentacao) as minuto,
        ARRAY_AGG(id ORDER BY data_movimentacao) as ids
    FROM movimentacoeslaboratorio
    GROUP BY produto_id, tipo, quantidade, DATE_TRUNC('minute', data_movimentacao)
    HAVING COUNT(*) > 1
)
SELECT UNNEST(ids[2:]) as id_to_delete
FROM duplicates;

-- Deletar movimentações duplicadas
DELETE FROM movimentacoeslaboratorio
WHERE id IN (SELECT id_to_delete FROM movimentacoes_to_delete);

SELECT 
    COUNT(*) as movimentacoes_removidas
FROM movimentacoes_to_delete;

-- ================================================
-- PASSO 3: Recalcular Estoque
-- ================================================

UPDATE estoquelaboratorio e
SET 
    quantidade_atual = COALESCE(
        (
            SELECT 
                SUM(CASE 
                    WHEN m.tipo = 'entrada' THEN m.quantidade 
                    ELSE -m.quantidade 
                END)
            FROM movimentacoeslaboratorio m
            WHERE m.produto_id = e.produto_id
        ), 
        0
    )
WHERE EXISTS (
    SELECT 1 FROM produtoslaboratorio p 
    WHERE p.id = e.produto_id AND p.ativo = true
);

-- ================================================
-- RESUMO FINAL
-- ================================================

SELECT 
    'RESUMO DA LIMPEZA' as titulo,
    (SELECT COUNT(*) FROM produtos_to_deactivate) as produtos_desativados,
    (SELECT COUNT(*) FROM movimentacoes_to_delete) as movimentacoes_removidas,
    (SELECT COUNT(*) FROM estoquelaboratorio e JOIN produtoslaboratorio p ON p.id = e.produto_id WHERE p.ativo = true) as produtos_ativos_restantes;

-- Produtos com estoque negativo (sinal de problema)
SELECT 
    'VALIDAÇÃO: Produtos com estoque negativo' as alerta,
    COUNT(*) as quantidade_problemas
FROM estoquelaboratorio e
JOIN produtoslaboratorio p ON p.id = e.produto_id
WHERE e.quantidade_atual < 0 AND p.ativo = true;

-- ⚠️ IMPORTANTE: Revise os resultados acima
-- Se estiver tudo correto, descomente a linha abaixo:
-- COMMIT;
