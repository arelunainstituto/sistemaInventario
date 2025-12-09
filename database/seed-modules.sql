-- =====================================================
-- SCRIPT PARA POPULAR MÓDULOS INICIAIS DO ERP
-- =====================================================
-- Este script insere os módulos iniciais do sistema
-- Execute após rodar o setup-modules.sql

-- Limpar módulos existentes (opcional - use com cuidado)
-- DELETE FROM modules;

-- Inserir módulos iniciais
INSERT INTO modules (code, name, description, icon, emoji, color, route, display_order, is_active)
VALUES
    -- Módulo de Inventário (já existente)
    (
        'INVENTORY',
        'Inventário',
        'Gestão completa de estoque, produtos e movimentações',
        'fas fa-boxes',
        '📦',
        'blue',
        '/inventory.html',
        1,
        true
    ),
    
    -- Módulo de Vendas
    (
        'SALES',
        'Vendas',
        'Controle de vendas, pedidos e faturamento',
        'fas fa-shopping-cart',
        '🛒',
        'green',
        '/sales.html',
        2,
        true
    ),
    
    -- Módulo de Compras
    (
        'PURCHASES',
        'Compras',
        'Gestão de fornecedores, pedidos de compra e recebimentos',
        'fas fa-shopping-bag',
        '🛍️',
        'orange',
        '/purchases.html',
        3,
        true
    ),
    
    -- Módulo Financeiro
    (
        'FINANCIAL',
        'Financeiro',
        'Controle de contas a pagar, receber e fluxo de caixa',
        'fas fa-dollar-sign',
        '💰',
        'yellow',
        '/financial.html',
        4,
        true
    ),
    
    -- Módulo de Clientes (CRM)
    (
        'CRM',
        'Clientes (CRM)',
        'Gestão de relacionamento com clientes e oportunidades',
        'fas fa-users',
        '👥',
        'purple',
        '/crm.html',
        5,
        true
    ),
    
    -- Módulo de Recursos Humanos
    (
        'HR',
        'Recursos Humanos',
        'Gestão de funcionários, folha de pagamento e benefícios',
        'fas fa-user-tie',
        '👔',
        'indigo',
        '/hr.html',
        6,
        true
    ),
    
    -- Módulo de Relatórios
    (
        'REPORTS',
        'Relatórios',
        'Dashboards e relatórios gerenciais',
        'fas fa-chart-line',
        '📊',
        'teal',
        '/reports.html',
        7,
        true
    ),
    
    -- Módulo de Configurações
    (
        'SETTINGS',
        'Configurações',
        'Configurações gerais do sistema',
        'fas fa-cog',
        '⚙️',
        'gray',
        '/settings.html',
        8,
        true
    )
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    emoji = EXCLUDED.emoji,
    color = EXCLUDED.color,
    route = EXCLUDED.route,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- =====================================================
-- CONCEDER ACESSO AO MÓDULO DE INVENTÁRIO PARA ADMINS
-- =====================================================
-- Este script concede acesso ao módulo de inventário para todos os usuários com role Admin

DO $$
DECLARE
    v_inventory_module_id UUID;
    v_admin_role_id UUID;
BEGIN
    -- Obter ID do módulo de inventário
    SELECT id INTO v_inventory_module_id
    FROM modules
    WHERE code = 'INVENTORY';
    
    -- Obter ID da role Admin
    SELECT id INTO v_admin_role_id
    FROM roles
    WHERE name = 'Admin';
    
    -- Conceder acesso ao módulo de inventário para a role Admin
    IF v_inventory_module_id IS NOT NULL AND v_admin_role_id IS NOT NULL THEN
        INSERT INTO role_module_access (role_id, module_id)
        VALUES (v_admin_role_id, v_inventory_module_id)
        ON CONFLICT (role_id, module_id) DO NOTHING;
        
        RAISE NOTICE 'Acesso ao módulo de inventário concedido para role Admin';
    ELSE
        RAISE NOTICE 'Módulo de inventário ou role Admin não encontrados';
    END IF;
END $$;

-- =====================================================
-- VERIFICAR MÓDULOS CRIADOS
-- =====================================================
SELECT 
    code,
    name,
    emoji,
    color,
    route,
    display_order,
    is_active,
    created_at
FROM modules
ORDER BY display_order;

-- =====================================================
-- VERIFICAR ACESSOS POR ROLE
-- =====================================================
SELECT 
    r.name as role_name,
    m.code as module_code,
    m.name as module_name,
    rma.created_at
FROM role_module_access rma
JOIN roles r ON r.id = rma.role_id
JOIN modules m ON m.id = rma.module_id
WHERE rma.is_active = true
ORDER BY r.name, m.display_order;
