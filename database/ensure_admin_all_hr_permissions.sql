-- Garantir que o Admin tenha TODAS as permissões do módulo HR

DO $$
DECLARE
    v_admin_role_id UUID;
BEGIN
    -- 1. Obter ID da role Admin
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'Admin';

    -- 2. Atribuir todas as permissões do módulo HR ao Admin
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 
        v_admin_role_id,
        id
    FROM permissions
    WHERE module_name = 'HR'
    AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = v_admin_role_id
        AND rp.permission_id = permissions.id
    );
    
    RAISE NOTICE 'Todas as permissões do módulo HR foram atribuídas ao Admin.';

END $$;

-- 3. Verificar permissões resultantes para Admin no módulo HR
SELECT 
    p.name as permission,
    p.description
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'Admin' AND p.module_name = 'HR';
