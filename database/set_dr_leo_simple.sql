-- Versão SIMPLES para executar no Supabase SQL Editor
-- Copie e cole este código no SQL Editor do Supabase

-- 1. Primeiro, vamos ver o ID do Dr. Leo
SELECT id, name, role, supervisor_id 
FROM rh_employees 
WHERE name ILIKE '%Leonardo%' OR name ILIKE '%Leo%';

-- 2. Depois de confirmar o ID acima, substitua 'ID_DO_DR_LEO' pelo UUID real
-- e execute este UPDATE:

-- IMPORTANTE: Substitua 'ID_DO_DR_LEO' pelo UUID que apareceu na consulta acima!
/*
UPDATE rh_employees
SET supervisor_id = 'ID_DO_DR_LEO'
WHERE name != 'Dr. Leonardo Saraiva';

UPDATE rh_employees
SET supervisor_id = NULL
WHERE name = 'Dr. Leonardo Saraiva';
*/

-- 3. Verificar o resultado:
SELECT 
    e.name AS funcionario,
    e.role AS cargo,
    s.name AS supervisor
FROM rh_employees e
LEFT JOIN rh_employees s ON e.supervisor_id = s.id
ORDER BY 
    CASE WHEN e.supervisor_id IS NULL THEN 0 ELSE 1 END,
    e.name;
