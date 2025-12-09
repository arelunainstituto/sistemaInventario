-- Corrigir permissões do RH para usar maiúsculo (HR) conforme esperado pelo código

-- 1. Atualizar nomes das permissões existentes (de 'hr:...' para 'HR:...')
UPDATE permissions
SET name = REPLACE(name, 'hr:', 'HR:')
WHERE name LIKE 'hr:%';

-- 2. Atualizar module_name nas permissões
UPDATE permissions
SET module_name = 'HR'
WHERE module_name = 'hr';

-- 3. Garantir que o módulo tenha código 'HR' (maiúsculo)
UPDATE modules
SET code = 'HR'
WHERE code = 'hr';

-- 4. Garantir que Admin tenha todas as permissões do módulo HR
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Admin'),
    id
FROM permissions
WHERE module_name = 'HR'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'Admin')
    AND rp.permission_id = permissions.id
);

-- 5. Verificar permissões resultantes para Admin
SELECT 
    r.name as role,
    p.name as permission,
    p.module_name
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'Admin' AND p.module_name = 'HR';
