-- Garantir que a permissão HR:read_all exista e esteja atribuída ao Admin

DO $$
DECLARE
    v_permission_id UUID;
    v_admin_role_id UUID;
    v_module_id UUID;
BEGIN
    -- 1. Obter ID do módulo HR
    SELECT id INTO v_module_id FROM modules WHERE code = 'HR';
    
    -- Se não encontrar por HR, tenta por hr (caso o script anterior não tenha rodado)
    IF v_module_id IS NULL THEN
        SELECT id INTO v_module_id FROM modules WHERE code = 'hr';
    END IF;

    -- 2. Obter ID da role Admin
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'Admin';

    -- 3. Verificar/Criar permissão HR:read_all
    SELECT id INTO v_permission_id FROM permissions WHERE name = 'HR:read_all';
    
    IF v_permission_id IS NULL THEN
        -- Tentar achar a versão minúscula
        SELECT id INTO v_permission_id FROM permissions WHERE name = 'hr:read_all';
        
        IF v_permission_id IS NOT NULL THEN
            -- Renomear para maiúsculo
            UPDATE permissions SET name = 'HR:read_all', module_name = 'HR' WHERE id = v_permission_id;
        ELSE
            -- Criar nova
            INSERT INTO permissions (name, action, module_name, resource, description)
            VALUES ('HR:read_all', 'read', 'HR', 'employees', 'Ver todos os funcionários')
            RETURNING id INTO v_permission_id;
        END IF;
    END IF;

    -- 4. Atribuir ao Admin
    IF v_admin_role_id IS NOT NULL AND v_permission_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_admin_role_id, v_permission_id
        WHERE NOT EXISTS (
            SELECT 1 FROM role_permissions 
            WHERE role_id = v_admin_role_id AND permission_id = v_permission_id
        );
        
        RAISE NOTICE 'Permissão HR:read_all atribuída ao Admin com sucesso.';
    ELSE
        RAISE WARNING 'Não foi possível atribuir permissão (Admin ID: %, Permission ID: %)', v_admin_role_id, v_permission_id;
    END IF;

END $$;

-- 5. Verificar resultado
SELECT 
    r.name as role,
    p.name as permission
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'Admin' AND p.name = 'HR:read_all';
