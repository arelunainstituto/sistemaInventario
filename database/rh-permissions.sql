-- =====================================================
-- MÓDULO RH - PERMISSÕES E ROLES (VERSÃO FINAL SEM CONFLITOS)
-- =====================================================

-- 0. Garantir tabelas de suporte
CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    emoji VARCHAR(10),
    color VARCHAR(20),
    route VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    action VARCHAR(50),
    module_name VARCHAR(50),
    resource VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_module_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. Criar Roles (Verificação manual)
INSERT INTO roles (name, description, level, is_system)
SELECT 'Admin', 'Administrador do Sistema', 100, true
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Admin');

INSERT INTO roles (name, description, level, is_system)
SELECT 'rh_manager', 'Gerente de RH', 50, false
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'rh_manager');

INSERT INTO roles (name, description, level, is_system)
SELECT 'employee', 'Funcionário', 10, false
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'employee');

-- 2. Registrar Módulo RH (Upsert manual)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM modules WHERE code = 'HR') THEN
        UPDATE modules SET
            name = 'Recursos Humanos',
            description = 'Gestão de colaboradores, folha de pagamento e benefícios',
            icon = 'fas fa-users',
            emoji = '👥',
            color = 'purple',
            route = '/hr.html',
            display_order = 3,
            is_active = true
        WHERE code = 'HR';
    ELSE
        INSERT INTO modules (code, name, description, icon, emoji, color, route, display_order, is_active)
        VALUES ('HR', 'Recursos Humanos', 'Gestão de colaboradores, folha de pagamento e benefícios', 'fas fa-users', '👥', 'purple', '/hr.html', 3, true);
    END IF;
END $$;

-- 3. Criar Permissões (Inserção segura)
DO $$
DECLARE
    p_name VARCHAR;
    p_action VARCHAR;
    p_module VARCHAR;
    p_resource VARCHAR;
    p_desc VARCHAR;
    perm_record RECORD;
BEGIN
    FOR perm_record IN 
        SELECT * FROM (VALUES 
            ('hr:read_all', 'read', 'HR', 'employees', 'Ver todos os funcionários'),
            ('hr:create', 'create', 'HR', 'employees', 'Criar funcionários'),
            ('hr:update', 'update', 'HR', 'employees', 'Editar funcionários'),
            ('hr:delete', 'delete', 'HR', 'employees', 'Desativar funcionários'),
            ('hr:payroll_process', 'manage', 'HR', 'payroll', 'Processar folha de pagamento'),
            ('hr:approve_absences', 'approve', 'HR', 'absences', 'Aprovar férias/ausências'),
            ('hr:view_reports', 'read', 'HR', 'reports', 'Ver relatórios de RH'),
            ('hr:manage_reviews', 'manage', 'HR', 'reviews', 'Gerenciar avaliações de desempenho'),
            ('hr:read_own', 'read', 'HR', 'own_data', 'Ver próprios dados'),
            ('hr:request_absence', 'create', 'HR', 'absences', 'Solicitar férias/ausências'),
            ('hr:upload_document', 'create', 'HR', 'documents', 'Enviar documentos')
        ) AS t(name, action, module_name, resource, description)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = perm_record.name) THEN
            INSERT INTO permissions (name, action, module_name, resource, description)
            VALUES (perm_record.name, perm_record.action, perm_record.module_name, perm_record.resource, perm_record.description);
        END IF;
    END LOOP;
END $$;

-- 4. Atribuir Permissões e Acesso (Vínculos seguros)
DO $$
DECLARE
    v_rh_manager_role_id UUID;
    v_employee_role_id UUID;
    v_admin_role_id UUID;
    v_perm_id UUID;
    v_module_id UUID;
BEGIN
    -- Obter IDs
    SELECT id INTO v_rh_manager_role_id FROM roles WHERE name = 'rh_manager';
    SELECT id INTO v_employee_role_id FROM roles WHERE name = 'employee';
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'Admin';
    SELECT id INTO v_module_id FROM modules WHERE code = 'HR';

    -- A. Atribuir permissões ao Gerente de RH
    FOR v_perm_id IN SELECT id FROM permissions WHERE module_name = 'HR' AND name LIKE 'hr:%' LOOP
        IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_rh_manager_role_id AND permission_id = v_perm_id) THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_rh_manager_role_id, v_perm_id);
        END IF;
    END LOOP;

    -- B. Atribuir permissões ao Funcionário
    FOR v_perm_id IN SELECT id FROM permissions WHERE name IN ('hr:read_own', 'hr:request_absence', 'hr:upload_document') LOOP
        IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_employee_role_id AND permission_id = v_perm_id) THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (v_employee_role_id, v_perm_id);
        END IF;
    END LOOP;
    
    -- C. Atribuir acesso ao módulo (Gerente)
    IF NOT EXISTS (SELECT 1 FROM role_module_access WHERE role_id = v_rh_manager_role_id AND module_id = v_module_id) THEN
        INSERT INTO role_module_access (role_id, module_id, is_active)
        VALUES (v_rh_manager_role_id, v_module_id, true);
    END IF;

    -- D. Atribuir acesso ao módulo (Funcionário)
    IF NOT EXISTS (SELECT 1 FROM role_module_access WHERE role_id = v_employee_role_id AND module_id = v_module_id) THEN
        INSERT INTO role_module_access (role_id, module_id, is_active)
        VALUES (v_employee_role_id, v_module_id, true);
    END IF;

    -- E. Atribuir acesso ao módulo (Admin)
    IF NOT EXISTS (SELECT 1 FROM role_module_access WHERE role_id = v_admin_role_id AND module_id = v_module_id) THEN
        INSERT INTO role_module_access (role_id, module_id, is_active)
        VALUES (v_admin_role_id, v_module_id, true);
    END IF;

END $$;
