-- Script para definir Dr. Leonardo Saraiva como supervisor de todos os funcionários
-- Execução: psql -U postgres -d seu_banco -f set_dr_leo_as_supervisor.sql

-- Passo 1: Encontrar o ID do Dr. Leonardo Saraiva
DO $$
DECLARE
    dr_leo_id UUID;
BEGIN
    -- Buscar o ID do Dr. Leonardo Saraiva
    SELECT id INTO dr_leo_id
    FROM rh_employees
    WHERE name ILIKE '%Leonardo%Saraiva%' OR name ILIKE '%Dr.%Leo%'
    LIMIT 1;

    -- Verificar se encontrou
    IF dr_leo_id IS NULL THEN
        RAISE EXCEPTION 'Dr. Leonardo Saraiva não foi encontrado na tabela rh_employees';
    END IF;

    -- Exibir o ID encontrado
    RAISE NOTICE 'ID do Dr. Leonardo Saraiva: %', dr_leo_id;

    -- Passo 2: Atualizar todos os outros funcionários para terem Dr. Leo como supervisor
    UPDATE rh_employees
    SET supervisor_id = dr_leo_id
    WHERE id != dr_leo_id  -- Não atualizar o próprio Dr. Leo
      AND (supervisor_id IS NULL OR supervisor_id != dr_leo_id); -- Apenas quem não tem ele como supervisor

    -- Passo 3: Garantir que Dr. Leo não tem supervisor (ele é o topo da hierarquia)
    UPDATE rh_employees
    SET supervisor_id = NULL
    WHERE id = dr_leo_id;

    -- Exibir resultado
    RAISE NOTICE 'Hierarquia atualizada com sucesso! Dr. Leonardo Saraiva é agora o supervisor principal.';
END $$;

-- Verificar a estrutura hierárquica
SELECT 
    e.name AS funcionario,
    e.role AS cargo,
    e.department AS departamento,
    s.name AS supervisor
FROM rh_employees e
LEFT JOIN rh_employees s ON e.supervisor_id = s.id
ORDER BY 
    CASE WHEN e.supervisor_id IS NULL THEN 0 ELSE 1 END,
    e.name;
