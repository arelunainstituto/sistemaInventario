-- Recalcular estoque baseado nas movimentações restantes
-- Execute este script APÓS remover as duplicatas
-- 
-- Este script irá:
-- 1. Recalcular a quantidade_atual de cada produto baseado nas movimentações
-- 2. Validar se os valores estão corretos

BEGIN;

-- Recalcular todos os estoques
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

-- Validação: Produtos com estoque negativo (problema!)
SELECT 
    p.id,
    p.nome_material,
    p.marca,
    e.quantidade_atual as estoque_calculado,
    (
        SELECT COUNT(*) 
        FROM movimentacoeslaboratorio m 
        WHERE m.produto_id = p.id
    ) as total_movimentacoes
FROM produtoslaboratorio p
JOIN estoquelaboratorio e ON e.produto_id = p.id
WHERE e.quantidade_atual < 0 AND p.ativo = true
ORDER BY e.quantidade_atual;

-- Estatísticas do recálculo
SELECT 
    COUNT(*) as produtos_recalculados,
    SUM(quantidade_atual) as estoque_total,
    COUNT(CASE WHEN quantidade_atual = 0 THEN 1 END) as produtos_zerados,
    COUNT(CASE WHEN quantidade_atual < 0 THEN 1 END) as produtos_com_estoque_negativo,
    COUNT(CASE WHEN quantidade_atual > 0 THEN 1 END) as produtos_com_estoque_positivo
FROM estoquelaboratorio e
JOIN produtoslaboratorio p ON p.id = e.produto_id
WHERE p.ativo = true;

-- ⚠️ IMPORTANTE: Revise os resultados acima
-- Se não houver produtos com estoque negativo, execute: COMMIT;
-- Se houver problemas, execute: ROLLBACK; e investigue

-- COMMIT; -- Descomente esta linha quando tiver certeza
