-- ⚠️ ATENÇÃO: Este script vai DELETAR dados permanentemente!
-- ⚠️ BACKUP OBRIGATÓRIO: Execute pg_dump ANTES de rodar este script!
-- 
-- Remove movimentações duplicadas, mantendo apenas a PRIMEIRA de cada grupo
-- Após remover, o estoque será recalculado automaticamente pelo trigger

BEGIN;

-- Criar tabela temporária com IDs a serem removidos
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

-- Mostrar o que será removido
SELECT 
    m.id,
    p.nome_material,
    m.tipo,
    m.quantidade,
    m.data_movimentacao,
    m.motivo
FROM movimentacoeslaboratorio m
JOIN produtoslaboratorio p ON m.produto_id = p.id
WHERE m.id IN (SELECT id_to_delete FROM movimentacoes_to_delete)
ORDER BY p.nome_material, m.data_movimentacao;

-- Deletar movimentações duplicadas
DELETE FROM movimentacoeslaboratorio
WHERE id IN (SELECT id_to_delete FROM movimentacoes_to_delete);

-- Mostrar resumo
SELECT 
    COUNT(*) as total_movimentacoes_removidas
FROM movimentacoes_to_delete;

-- Listar produtos afetados
SELECT 
    p.id,
    p.nome_material,
    p.marca,
    COUNT(DISTINCT m.id) as movimentacoes_removidas
FROM produtoslaboratorio p
JOIN movimentacoeslaboratorio m ON m.produto_id = p.id
WHERE m.id IN (SELECT id_to_delete FROM movimentacoes_to_delete)
GROUP BY p.id, p.nome_material, p.marca
ORDER BY movimentacoes_removidas DESC;

-- ⚠️ IMPORTANTE: Revise os resultados acima
-- Se estiver tudo correto, execute: COMMIT;
-- Se houver algum problema, execute: ROLLBACK;

-- COMMIT; -- Descomente esta linha quando tiver certeza
