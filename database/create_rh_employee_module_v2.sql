-- Script simplificado para criar módulo RH - Colaborador
-- Versão sem ON CONFLICT, usando apenas verificações IF NOT EXISTS

-- 1. Criar módulo
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
            true,
            4
        );
    END IF;
END $$;

-- 2. Criar permissões
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'rh_employee:read_own') THEN
        INSERT INTO permissions (name, action, module_name, resource, description)
        VALUES ('rh_employee:read_own', 'read', 'rh_employee', 'own_data', 'Ver próprios dados');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'rh_employee:read_payroll') THEN
        INSERT INTO permissions (name, action, module_name, resource, description)
        VALUES ('rh_employee:read_payroll', 'read', 'rh_employee', 'payroll', 'Ver própria folha de pagamento');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'rh_employee:read_documents') THEN
        INSERT INTO permissions (name, action, module_name, resource, description)
        VALUES ('rh_employee:read_documents', 'read', 'rh_employee', 'documents', 'Ver próprios documentos');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'rh_employee:request_absence') THEN
        INSERT INTO permissions (name, action, module_name, resource, description)
        VALUES ('rh_employee:request_absence', 'create', 'rh_employee', 'absences', 'Solicitar férias/ausências');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'rh_employee:update_profile') THEN
        INSERT INTO permissions (name, action, module_name, resource, description)
        VALUES ('rh_employee:update_profile', 'update', 'rh_employee', 'profile', 'Atualizar dados pessoais');
    END IF;
END $$;

-- 3. Criar role employee
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'employee') THEN
        INSERT INTO roles (name, description, level, is_system)
        VALUES ('employee', 'Funcionário/Colaborador', 10, false);
    END IF;
END $$;

-- 4. Atribuir permissões à role employee
DO $$
DECLARE
    v_employee_role_id UUID;
    v_permission_id UUID;
BEGIN
    SELECT id INTO v_employee_role_id FROM roles WHERE name = 'employee';
    
    FOR v_permission_id IN 
        SELECT id FROM permissions WHERE module_name = 'rh_employee'
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM role_permissions 
            WHERE role_id = v_employee_role_id AND permission_id = v_permission_id
        ) THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_employee_role_id, v_permission_id);
        END IF;
    END LOOP;
END $$;

-- 5. Atribuir permissões ao Admin também
DO $$
DECLARE
    v_admin_role_id UUID;
    v_permission_id UUID;
BEGIN
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'Admin';
    
    FOR v_permission_id IN 
        SELECT id FROM permissions WHERE module_name = 'rh_employee'
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM role_permissions 
            WHERE role_id = v_admin_role_id AND permission_id = v_permission_id
        ) THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_admin_role_id, v_permission_id);
        END IF;
    END LOOP;
END $$;

-- Verificar resultado
SELECT code, name, is_active, in_development FROM modules WHERE code = 'rh_employee';
x