-- =====================================================
-- SISTEMA ERP - ESTRUTURA DE MÓDULOS
-- Grupo AreLuna
-- =====================================================

-- Tabela de Módulos do Sistema
CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    emoji VARCHAR(10),
    color VARCHAR(20),
    route VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Acesso de Usuários aos Módulos
CREATE TABLE IF NOT EXISTS user_module_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, module_id)
);

-- Tabela de Acesso de Roles aos Módulos
CREATE TABLE IF NOT EXISTS role_module_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_id, module_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_module_access_user_id ON user_module_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_access_module_id ON user_module_access(module_id);
CREATE INDEX IF NOT EXISTS idx_role_module_access_role_id ON role_module_access(role_id);
CREATE INDEX IF NOT EXISTS idx_role_module_access_module_id ON role_module_access(module_id);
CREATE INDEX IF NOT EXISTS idx_modules_code ON modules(code);
CREATE INDEX IF NOT EXISTS idx_modules_is_active ON modules(is_active);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_module_access_updated_at BEFORE UPDATE ON user_module_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_module_access_updated_at BEFORE UPDATE ON role_module_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INSERIR MÓDULOS PADRÃO DO SISTEMA
-- =====================================================

INSERT INTO modules (code, name, description, icon, emoji, color, route, display_order) VALUES
('inventory', 'Inventário', 'Gestão de inventário e patrimônio', 'fas fa-warehouse', '📦', 'blue', '/inventory.html', 1),
('financial', 'Financeiro', 'Gestão financeira e contabilidade', 'fas fa-dollar-sign', '💰', 'green', '/financial.html', 2),
('hr', 'Recursos Humanos', 'Gestão de colaboradores e RH', 'fas fa-users', '👥', 'purple', '/hr.html', 3),
('crm', 'CRM', 'Gestão de clientes e relacionamento', 'fas fa-handshake', '🤝', 'orange', '/crm.html', 4),
('sales', 'Vendas', 'Gestão de vendas e pedidos', 'fas fa-shopping-cart', '🛒', 'red', '/sales.html', 5),
('purchases', 'Compras', 'Gestão de compras e fornecedores', 'fas fa-shopping-bag', '🛍️', 'indigo', '/purchases.html', 6),
('production', 'Produção', 'Gestão de produção e manufatura', 'fas fa-industry', '🏭', 'gray', '/production.html', 7),
('quality', 'Qualidade', 'Controle de qualidade', 'fas fa-check-circle', '✅', 'teal', '/quality.html', 8),
('laboratory', 'Laboratório', 'Gestão de laboratório e análises', 'fas fa-flask', '🧪', 'cyan', '/laboratory.html', 9),
('maintenance', 'Manutenção', 'Gestão de manutenção de equipamentos', 'fas fa-tools', '🔧', 'yellow', '/maintenance.html', 10),
('reports', 'Relatórios', 'Relatórios e análises', 'fas fa-chart-bar', '📊', 'pink', '/reports.html', 11),
('settings', 'Configurações', 'Configurações do sistema', 'fas fa-cog', '⚙️', 'slate', '/settings.html', 99)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- POLÍTICAS DE SEGURANÇA (RLS - Row Level Security)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_module_access ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ver módulos ativos
CREATE POLICY "Módulos ativos são visíveis para todos autenticados"
    ON modules FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Política: Apenas admins podem gerenciar módulos
CREATE POLICY "Apenas admins podem gerenciar módulos"
    ON modules FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'Admin'
            AND ur.is_active = true
        )
    );

-- Política: Usuários podem ver seus próprios acessos
CREATE POLICY "Usuários podem ver seus próprios acessos"
    ON user_module_access FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Política: Apenas admins podem gerenciar acessos
CREATE POLICY "Apenas admins podem gerenciar acessos de usuários"
    ON user_module_access FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'Admin'
            AND ur.is_active = true
        )
    );

-- Política: Todos podem ver acessos de roles
CREATE POLICY "Todos podem ver acessos de roles"
    ON role_module_access FOR SELECT
    TO authenticated
    USING (true);

-- Política: Apenas admins podem gerenciar acessos de roles
CREATE POLICY "Apenas admins podem gerenciar acessos de roles"
    ON role_module_access FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'Admin'
            AND ur.is_active = true
        )
    );

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para verificar se usuário tem acesso a um módulo
CREATE OR REPLACE FUNCTION user_has_module_access(
    p_user_id UUID,
    p_module_code VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    has_access BOOLEAN;
BEGIN
    -- Verifica acesso direto do usuário
    SELECT EXISTS (
        SELECT 1
        FROM user_module_access uma
        JOIN modules m ON uma.module_id = m.id
        WHERE uma.user_id = p_user_id
        AND m.code = p_module_code
        AND uma.is_active = true
        AND m.is_active = true
        AND (uma.expires_at IS NULL OR uma.expires_at > NOW())
    ) INTO has_access;
    
    IF has_access THEN
        RETURN true;
    END IF;
    
    -- Verifica acesso via role
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_module_access rma ON ur.role_id = rma.role_id
        JOIN modules m ON rma.module_id = m.id
        WHERE ur.user_id = p_user_id
        AND m.code = p_module_code
        AND ur.is_active = true
        AND rma.is_active = true
        AND m.is_active = true
    ) INTO has_access;
    
    RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter módulos acessíveis por um usuário
CREATE OR REPLACE FUNCTION get_user_accessible_modules(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    code VARCHAR,
    name VARCHAR,
    description TEXT,
    icon VARCHAR,
    emoji VARCHAR,
    color VARCHAR,
    route VARCHAR,
    display_order INTEGER,
    access_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    WITH accessible_modules AS (
        SELECT DISTINCT ON (m.id)
            m.id,
            m.code,
            m.name,
            m.description,
            m.icon,
            m.emoji,
            m.color,
            m.route,
            m.display_order,
            CASE 
                WHEN uma.user_id IS NOT NULL THEN 'direct'::VARCHAR
                ELSE 'role'::VARCHAR
            END as access_type
        FROM modules m
        LEFT JOIN user_module_access uma ON m.id = uma.module_id 
            AND uma.user_id = p_user_id
            AND uma.is_active = true
            AND (uma.expires_at IS NULL OR uma.expires_at > NOW())
        LEFT JOIN role_module_access rma ON m.id = rma.module_id
            AND rma.is_active = true
        LEFT JOIN user_roles ur ON rma.role_id = ur.role_id
            AND ur.user_id = p_user_id
            AND ur.is_active = true
        WHERE m.is_active = true
            AND (
                (uma.user_id IS NOT NULL) -- Tem acesso direto
                OR (ur.user_id IS NOT NULL) -- Tem acesso via role
            )
        ORDER BY m.id
    )
    SELECT 
        id,
        code,
        name,
        description,
        icon,
        emoji,
        color,
        route,
        display_order,
        access_type
    FROM accessible_modules
    ORDER BY display_order, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTÁRIOS NAS TABELAS
-- =====================================================

COMMENT ON TABLE modules IS 'Módulos disponíveis no sistema ERP';
COMMENT ON TABLE user_module_access IS 'Controle de acesso direto de usuários aos módulos';
COMMENT ON TABLE role_module_access IS 'Controle de acesso de roles aos módulos';

COMMENT ON COLUMN modules.code IS 'Código único do módulo (usado no sistema)';
COMMENT ON COLUMN modules.route IS 'Rota/URL do módulo';
COMMENT ON COLUMN modules.display_order IS 'Ordem de exibição no dashboard';
COMMENT ON COLUMN user_module_access.expires_at IS 'Data de expiração do acesso (NULL = sem expiração)';
COMMENT ON COLUMN user_module_access.granted_by IS 'Usuário que concedeu o acesso';
