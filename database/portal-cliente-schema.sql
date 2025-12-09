-- =====================================================
-- PORTAL DO CLIENTE - SCHEMA
-- Data: 23/10/2025
-- =====================================================

-- 1. Adicionar coluna user_id na tabela prostoral_clients
-- Isso vincula um usuário específico a um cliente
ALTER TABLE prostoral_clients
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Comentário
COMMENT ON COLUMN prostoral_clients.user_id IS 'ID do usuário vinculado a este cliente (para acesso ao portal do cliente)';

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_prostoral_clients_user_id ON prostoral_clients(user_id);

-- 2. Adicionar coluna created_by_client na tabela prostoral_work_order_issues
-- Isso identifica se uma intercorrência foi criada pelo cliente ou técnico/admin
ALTER TABLE prostoral_work_order_issues
ADD COLUMN IF NOT EXISTS created_by_client BOOLEAN DEFAULT FALSE;

-- Comentário
COMMENT ON COLUMN prostoral_work_order_issues.created_by_client IS 'Indica se a intercorrência foi criada pelo cliente (TRUE) ou por técnico/admin (FALSE)';

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_work_order_issues_created_by_client ON prostoral_work_order_issues(created_by_client);

-- 3. Criar role 'cliente' no sistema (se ainda não existir)
-- Nota: A tabela 'roles' pode ter nomes diferentes dependendo do sistema
-- Verificar se a role já existe antes de inserir
DO $$
BEGIN
    -- Tentar inserir a role 'cliente'
    INSERT INTO roles (name, description, created_at, updated_at)
    VALUES (
        'cliente',
        'Cliente - Pode criar e acompanhar suas próprias ordens de serviço',
        NOW(),
        NOW()
    )
    ON CONFLICT (name) DO NOTHING;
    
    RAISE NOTICE 'Role "cliente" criada ou já existe';
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Tabela "roles" não existe. Ignorando criação de role.';
END $$;

-- 4. Criar função helper para verificar se um usuário é cliente
CREATE OR REPLACE FUNCTION is_user_client(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar se o usuário está vinculado a algum cliente
    RETURN EXISTS (
        SELECT 1
        FROM prostoral_clients
        WHERE user_id = p_user_id
    );
END;
$$;

COMMENT ON FUNCTION is_user_client(UUID) IS 'Verifica se um usuário está vinculado a um cliente';

-- 5. Criar view para facilitar consultas de OSs por cliente com seus usuários
CREATE OR REPLACE VIEW prostoral_client_orders_view AS
SELECT
    wo.id AS order_id,
    wo.order_number,
    wo.patient_name,
    wo.work_description,
    wo.status,
    wo.received_date,
    wo.due_date,
    wo.delivered_date,
    c.id AS client_id,
    c.name AS client_name,
    c.email AS client_email,
    c.user_id AS client_user_id,
    -- Contar intercorrências criadas pelo cliente
    (SELECT COUNT(*)
     FROM prostoral_work_order_issues
     WHERE work_order_id = wo.id
     AND created_by_client = TRUE
     AND status = 'open') AS open_client_issues_count
FROM
    prostoral_work_orders wo
    INNER JOIN prostoral_clients c ON wo.client_id = c.id;

COMMENT ON VIEW prostoral_client_orders_view IS 'View com ordens de serviço e informações do cliente, incluindo user_id';

-- 6. Criar política RLS para clientes acessarem apenas suas próprias OSs
-- IMPORTANTE: Ajustar de acordo com a estrutura RLS existente

-- Habilitar RLS na tabela prostoral_work_orders (se ainda não estiver)
ALTER TABLE prostoral_work_orders ENABLE ROW LEVEL SECURITY;

-- Política para clientes verem apenas suas OSs
CREATE POLICY "Clientes veem apenas suas próprias OSs"
ON prostoral_work_orders
FOR SELECT
TO authenticated
USING (
    -- Permite se o usuário é admin/técnico OU se é o cliente dono da OS
    EXISTS (
        SELECT 1
        FROM prostoral_clients c
        WHERE c.id = prostoral_work_orders.client_id
        AND c.user_id = auth.uid()
    )
    OR
    -- OU se o usuário tem role admin/técnico
    EXISTS (
        SELECT 1
        FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'tecnico', 'technician')
    )
);

-- Política para clientes criarem OSs
CREATE POLICY "Clientes podem criar OSs para si mesmos"
ON prostoral_work_orders
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM prostoral_clients c
        WHERE c.id = prostoral_work_orders.client_id
        AND c.user_id = auth.uid()
    )
);

-- 7. Política RLS para intercorrências criadas por clientes
ALTER TABLE prostoral_work_order_issues ENABLE ROW LEVEL SECURITY;

-- Clientes veem apenas suas próprias intercorrências
CREATE POLICY "Clientes veem suas intercorrências"
ON prostoral_work_order_issues
FOR SELECT
TO authenticated
USING (
    -- Cliente vê suas intercorrências
    (created_by_client = TRUE AND created_by = auth.uid())
    OR
    -- Admin/técnico vê todas
    EXISTS (
        SELECT 1
        FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'tecnico', 'technician')
    )
);

-- Clientes podem criar intercorrências em suas OSs
CREATE POLICY "Clientes criam intercorrências em suas OSs"
ON prostoral_work_order_issues
FOR INSERT
TO authenticated
WITH CHECK (
    -- Verifica se a OS pertence ao cliente
    EXISTS (
        SELECT 1
        FROM prostoral_work_orders wo
        INNER JOIN prostoral_clients c ON wo.client_id = c.id
        WHERE wo.id = prostoral_work_order_issues.work_order_id
        AND c.user_id = auth.uid()
    )
);

-- 8. Criar função para obter client_id de um usuário
CREATE OR REPLACE FUNCTION get_client_id_from_user(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_client_id UUID;
BEGIN
    SELECT id INTO v_client_id
    FROM prostoral_clients
    WHERE user_id = p_user_id;
    
    RETURN v_client_id;
END;
$$;

COMMENT ON FUNCTION get_client_id_from_user(UUID) IS 'Retorna o client_id vinculado a um user_id';

-- 9. Criar permissões específicas para o portal do cliente
DO $$
BEGIN
    -- Tentar inserir permissões para a role cliente
    -- Nota: Ajustar conforme estrutura real de permissões
    
    -- Permissão para ver suas OSs
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 
        r.id AS role_id,
        p.id AS permission_id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'cliente'
    AND p.name IN (
        'orders:read_own',
        'orders:create_own',
        'issues:create_own',
        'issues:read_own'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Permissões atribuídas à role "cliente"';
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Tabelas de permissões não existem. Ignorando.';
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao atribuir permissões: %', SQLERRM;
END $$;

-- =====================================================
-- FIM DO SCHEMA DO PORTAL DO CLIENTE
-- =====================================================

-- Resumo das mudanças:
-- ✅ Coluna user_id adicionada em prostoral_clients
-- ✅ Coluna created_by_client adicionada em prostoral_work_order_issues
-- ✅ Role 'cliente' criada
-- ✅ Funções helper criadas (is_user_client, get_client_id_from_user)
-- ✅ View prostoral_client_orders_view criada
-- ✅ Políticas RLS configuradas para segurança
-- ✅ Permissões atribuídas

RAISE NOTICE 'Schema do Portal do Cliente aplicado com sucesso!';

