-- Criar módulo "RH - Colaborador" para acesso de funcionários

-- 1. Inserir o módulo na tabela modules
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM modules WHERE code = 'rh_employee') THEN
        INSERT INTO modules (code, name, description, icon, emoji, color, route, is_active, in_development, display_order)
        VALUES (
            'rh_employee',
            'RH - Colaborador',
            'Portal do colaborador para visualizar dados pessoais, folha de pagamento e documentos',
            'fas fa-user-tie',
            '👤',
            'blue',
            '/rh-employee.html',
            true,
            true, -- Marcar como em desenvolvimento até a tela ser criada
            4
        );
    ELSE
        UPDATE modules SET
            name = 'RH - Colaborador',
            description = 'Portal do colaborador para visualizar dados pessoais, folha de pagamento e documentos',
            icon = 'fas fa-user-tie',
            emoji = '👤',
            color = 'blue',
            route = '/rh-employee.html',
            is_active = true,
            in_development = true,
            display_order = 4
        WHERE code = 'rh_employee';
    END IF;
END $$;

-- 2. Criar permissões específicas para o módulo de colaborador
DO $$
DECLARE
    perm RECORD;
BEGIN
    FOR perm IN 
        SELECT * FROM (VALUES 
            ('rh_employee:read_own', 'read', 'rh_employee', 'own_data', 'Ver próprios dados'),
            ('rh_employee:read_payroll', 'read', 'rh_employee', 'payroll', 'Ver própria folha de pagamento'),
            ('rh_employee:read_documents', 'read', 'rh_employee', 'documents', 'Ver próprios documentos'),
            ('rh_employee:request_absence', 'create', 'rh_employee', 'absences', 'Solicitar férias/ausências'),
            ('rh_employee:update_profile', 'update', 'rh_employee', 'profile', 'Atualizar dados pessoais')
        ) AS t(name, action, module_name, resource, description)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = perm.name) THEN
            INSERT INTO permissions (name, action, module_name, resource, description)
            VALUES (perm.name, perm.action, perm.module_name, perm.resource, perm.description);
        END IF;
    END LOOP;
END $$;

-- 3. Criar role "employee" se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'employee') THEN
        INSERT INTO roles (name, description, level, is_system)
        VALUES ('employee', 'Funcionário/Colaborador', 10, false);
    END IF;
END $$;

-- 4. Atribuir permissões à role "employee"
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'employee'),
    id
FROM permissions
WHERE module_name = 'rh_employee'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'employee')
    AND rp.permission_id = permissions.id
);

-- 5. Garantir que Admin também tenha acesso ao módulo de colaborador
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Admin'),
    id
FROM permissions
WHERE module_name = 'rh_employee'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'Admin')
    AND rp.permission_id = permissions.id
);

-- 6. Verificar resultado
SELECT 
    m.code,
    m.name,
    m.is_active,
    m.in_development
FROM modules m
WHERE m.code IN ('HR', 'rh_employee');

SELECT 
    r.name as role,
    p.name as permission,
    p.module_name
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.module_name = 'rh_employee'
ORDER BY r.name, p.name;
