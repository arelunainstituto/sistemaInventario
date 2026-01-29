-- ⚠️ ATENÇÃO: Este script vai MODIFICAR dados!
-- ⚠️ BACKUP OBRIGATÓRIO: Execute pg_dump ANTES de rodar este script!
-- 
-- Remove produtos duplicados, mantendo apenas o PRIMEIRO criado
-- Os duplicados serão marcados como inativos e deleted_at será preenchido

BEGIN;

-- Criar tabela temporária com IDs a serem removidos
CREATE TEMP TABLE produtos_to_deactivate AS
WITH duplicates AS (
    SELECT 
        nome_material,
        marca,
        data_criacao::date as dia_criacao,
        ARRAY_AGG(id ORDER BY data_criacao) as ids
    FROM produtoslaboratorio
    WHERE ativo = true AND deleted_at IS NULL
    GROUP BY nome_material, marca, data_criacao::date
    HAVING COUNT(*) > 1
)
SELECT UNNEST(ids[2:]) as id_to_deactivate
FROM duplicates;

-- Mostrar o que será removido
SELECT 
    p.id,
    p.nome_material,
    p.marca,
    p.data_criacao
FROM produtoslaboratorio p
JOIN produtos_to_deactivate d ON p.id = d.id_to_deactivate
ORDER BY p.nome_material, p.data_criacao;

-- Desativar produtos duplicados
UPDATE produtoslaboratorio
SET 
    ativo = false,
    deleted_at = NOW(),
    observacoes = COALESCE(observacoes || E'\n', '') || '⚠️ Removido automaticamente - duplicado em ' || NOW()::date
WHERE id IN (SELECT id_to_deactivate FROM produtos_to_deactivate);

-- Mostrar resumo
SELECT 
    COUNT(*) as total_produtos_desativados,
    STRING_AGG(DISTINCT nome_material, ', ') as produtos_afetados
FROM produtoslaboratorio
WHERE id IN (SELECT id_to_deactivate FROM produtos_to_deactivate);

-- ⚠️ IMPORTANTE: Revise os resultados acima
-- Se estiver tudo correto, execute: COMMIT;
-- Se houver algum problema, execute: ROLLBACK;

-- COMMIT; -- Descomente esta linha quando tiver certeza
