-- =====================================================
-- INVENTORY REFACTOR — FASE 0.2
-- Roles, permissões e módulo do novo Inventory
-- =====================================================
-- Cria 4 roles novos específicos do inventário, 10 permissões
-- granulares, e vincula permissões a roles conforme matriz do plano.
--
-- Idempotente: pode ser rodado mais de uma vez sem duplicar.
-- Pressupõe que tabelas roles/permissions/role_permissions/
-- role_module_access/modules já existem (criadas por rh-permissions.sql).
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1) Garantir módulo INVENTORY na tabela modules
-- -----------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM modules WHERE code = 'INVENTORY') THEN
        UPDATE modules SET
            name = 'Inventário',
            description = 'Gestão de estoques: itens, lotes, entradas, saídas, transferências, inventário físico',
            icon = 'fas fa-warehouse',
            emoji = '📦',
            color = 'blue',
            route = '/inventory/index.html',
            display_order = 2,
            is_active = true
        WHERE code = 'INVENTORY';
    ELSE
        INSERT INTO modules (code, name, description, icon, emoji, color, route, display_order, is_active)
        VALUES ('INVENTORY', 'Inventário', 'Gestão de estoques: itens, lotes, entradas, saídas, transferências, inventário físico',
                'fas fa-warehouse', '📦', 'blue', '/inventory/index.html', 2, true);
    END IF;
END $$;

-- -----------------------------------------------------
-- 2) Criar os 4 roles novos
-- -----------------------------------------------------
INSERT INTO roles (name, description, level, is_system)
SELECT 'Inventory_Admin', 'Administrador do módulo Inventário (acesso total)', 80, false
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Inventory_Admin');

INSERT INTO roles (name, description, level, is_system)
SELECT 'Inventory_Operador', 'Operador do Inventário (lançamentos de entrada/saída/transferência/contagem)', 30, false
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Inventory_Operador');

INSERT INTO roles (name, description, level, is_system)
SELECT 'Inventory_Consulta', 'Consulta do Inventário (apenas leitura e relatórios)', 10, false
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Inventory_Consulta');

INSERT INTO roles (name, description, level, is_system)
SELECT 'Inventory_Contabilidade', 'Contabilidade (relatórios financeiros, valorização e custos)', 20, false
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Inventory_Contabilidade');

-- -----------------------------------------------------
-- 3) Criar permissões granulares do módulo
-- -----------------------------------------------------
DO $$
DECLARE
    perm_record RECORD;
BEGIN
    -- IMPORTANTE: module_name e action precisam ser tais que
    -- module_name || ':' || action == name. O middleware constrói a
    -- string de permissão como `${module_name}:${action}` e as rotas
    -- chamam requirePermission('inventory', '<action>'). Se você
    -- alterar essa convenção, atualize também a 90-normalize-permission-names.sql.
    FOR perm_record IN
        SELECT * FROM (VALUES
            ('inventory:read',              'read',              'inventory', 'all',         'Ler dados do inventário'),
            ('inventory:create_item',       'create_item',       'inventory', 'items',       'Cadastrar novos itens'),
            ('inventory:update_item',       'update_item',       'inventory', 'items',       'Editar itens existentes'),
            ('inventory:entry',             'entry',             'inventory', 'entries',     'Lançar entradas (recepção de materiais)'),
            ('inventory:exit',              'exit',              'inventory', 'exits',       'Lançar saídas (consumo/avaria/perda…)'),
            ('inventory:transfer',          'transfer',          'inventory', 'transfers',   'Transferir itens entre localizações'),
            ('inventory:adjust',            'adjust',            'inventory', 'adjustments', 'Ajustes manuais de estoque'),
            ('inventory:inventory_session', 'inventory_session', 'inventory', 'sessions',    'Abrir/contar/validar sessões de inventário físico'),
            ('inventory:reports',           'reports',           'inventory', 'reports',     'Consultar relatórios do inventário'),
            ('inventory:financial',         'financial',         'inventory', 'financial',   'Acesso a dados financeiros (CMP, valorização, custos)')
        ) AS t(name, action, module_name, resource, description)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = perm_record.name) THEN
            INSERT INTO permissions (name, action, module_name, resource, description)
            VALUES (perm_record.name, perm_record.action, perm_record.module_name, perm_record.resource, perm_record.description);
        END IF;
    END LOOP;
END $$;

-- -----------------------------------------------------
-- 4) Vincular permissões aos roles + acesso ao módulo
-- -----------------------------------------------------
DO $$
DECLARE
    v_admin_role_id           UUID;
    v_inv_admin_id            UUID;
    v_inv_operador_id         UUID;
    v_inv_consulta_id         UUID;
    v_inv_contabilidade_id    UUID;
    v_module_id               UUID;
    v_perm_id                 UUID;
BEGIN
    SELECT id INTO v_admin_role_id        FROM roles WHERE name = 'Admin';
    SELECT id INTO v_inv_admin_id         FROM roles WHERE name = 'Inventory_Admin';
    SELECT id INTO v_inv_operador_id      FROM roles WHERE name = 'Inventory_Operador';
    SELECT id INTO v_inv_consulta_id      FROM roles WHERE name = 'Inventory_Consulta';
    SELECT id INTO v_inv_contabilidade_id FROM roles WHERE name = 'Inventory_Contabilidade';
    SELECT id INTO v_module_id            FROM modules WHERE code = 'INVENTORY';

    -- A) Inventory_Admin = TODAS as permissões inventory:*
    FOR v_perm_id IN SELECT id FROM permissions WHERE module_name = 'inventory' LOOP
        IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_inv_admin_id AND permission_id = v_perm_id) THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (v_inv_admin_id, v_perm_id);
        END IF;
    END LOOP;

    -- B) Inventory_Operador = read, create_item, update_item, entry, exit, transfer, inventory_session
    FOR v_perm_id IN SELECT id FROM permissions WHERE name IN (
        'inventory:read','inventory:create_item','inventory:update_item',
        'inventory:entry','inventory:exit','inventory:transfer','inventory:inventory_session'
    ) LOOP
        IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_inv_operador_id AND permission_id = v_perm_id) THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (v_inv_operador_id, v_perm_id);
        END IF;
    END LOOP;

    -- C) Inventory_Consulta = read, reports
    FOR v_perm_id IN SELECT id FROM permissions WHERE name IN ('inventory:read','inventory:reports') LOOP
        IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_inv_consulta_id AND permission_id = v_perm_id) THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (v_inv_consulta_id, v_perm_id);
        END IF;
    END LOOP;

    -- D) Inventory_Contabilidade = read, reports, financial
    FOR v_perm_id IN SELECT id FROM permissions WHERE name IN ('inventory:read','inventory:reports','inventory:financial') LOOP
        IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_inv_contabilidade_id AND permission_id = v_perm_id) THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (v_inv_contabilidade_id, v_perm_id);
        END IF;
    END LOOP;

    -- E) Acesso ao módulo INVENTORY para os 4 roles novos + Admin
    FOR v_perm_id IN
        SELECT unnest(ARRAY[v_inv_admin_id, v_inv_operador_id, v_inv_consulta_id, v_inv_contabilidade_id, v_admin_role_id])
    LOOP
        IF v_perm_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM role_module_access WHERE role_id = v_perm_id AND module_id = v_module_id) THEN
            INSERT INTO role_module_access (role_id, module_id, is_active)
            VALUES (v_perm_id, v_module_id, true);
        END IF;
    END LOOP;
END $$;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO PÓS-EXECUÇÃO
-- =====================================================
-- Esperado: 10 permissões e 4 roles novos + vínculos.
SELECT r.name AS role, COUNT(rp.permission_id) AS qtd_permissoes
FROM roles r
LEFT JOIN role_permissions rp ON rp.role_id = r.id
LEFT JOIN permissions p ON p.id = rp.permission_id AND p.module_name = 'inventory'
WHERE r.name LIKE 'Inventory_%'
GROUP BY r.name
ORDER BY r.name;
