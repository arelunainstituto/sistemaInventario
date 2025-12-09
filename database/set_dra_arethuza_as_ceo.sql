-- =====================================================
-- Promover Dra. Arethuza a Co-CEO
-- =====================================================
-- Este script define a Dra. Arethuza como Co-CEO junto com o Dr. Leonardo
-- Ambos terão supervisor_id NULL (topo da hierarquia)

-- 1. Atualizar cargo da Dra. Arethuza para Co-CEO
UPDATE rh_employees
SET 
    role = 'Co-CEO',
    supervisor_id = NULL,  -- Remove supervisor (topo da hierarquia)
    updated_at = NOW()
WHERE email = 'draarethuza@institutoareluna.pt';

-- 2. Atualizar cargo do Dr. Leonardo para Co-CEO (se ainda não for)
UPDATE rh_employees
SET 
    role = 'Co-CEO',
    supervisor_id = NULL,  -- Garante que não tem supervisor
    updated_at = NOW()
WHERE email = 'drsaraiva@institutoareluna.pt';

-- 3. Verificar os CEOs
SELECT 
    id,
    name,
    email,
    department,
    role,
    supervisor_id,
    status
FROM rh_employees
WHERE email IN ('draarethuza@institutoareluna.pt', 'drsaraiva@institutoareluna.pt')
ORDER BY name;

-- 4. Verificar quantos funcionários reportam diretamente aos Co-CEOs
SELECT 
    CASE 
        WHEN supervisor_id = (SELECT id FROM rh_employees WHERE email = 'drsaraiva@institutoareluna.pt') 
        THEN 'Dr. Leonardo Saraiva'
        WHEN supervisor_id = (SELECT id FROM rh_employees WHERE email = 'draarethuza@institutoareluna.pt') 
        THEN 'Dra. Arethuza'
        ELSE 'Outro/Nenhum'
    END as supervisor_name,
    COUNT(*) as direct_reports
FROM rh_employees
WHERE supervisor_id IS NOT NULL
GROUP BY supervisor_id
ORDER BY direct_reports DESC;
