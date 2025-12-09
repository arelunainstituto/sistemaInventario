-- =====================================================
-- SISTEMA DE ORDENS DE SERVIÇO - POLÍTICAS RLS
-- ProStoral - Laboratório Protético
-- =====================================================

-- =====================================================
-- 1. POLÍTICAS PARA prostoral_work_orders
-- =====================================================

-- Habilitar RLS (se ainda não estiver)
ALTER TABLE prostoral_work_orders ENABLE ROW LEVEL SECURITY;

-- Admin tem acesso total
DROP POLICY IF EXISTS "Admin total access to work orders" ON prostoral_work_orders;
CREATE POLICY "Admin total access to work orders"
ON prostoral_work_orders FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('admin', 'superadmin')
        AND ur.is_active = true
    )
);

-- Técnicos veem e editam OS atribuídas a eles
DROP POLICY IF EXISTS "Technicians see assigned work orders" ON prostoral_work_orders;
CREATE POLICY "Technicians see assigned work orders"
ON prostoral_work_orders FOR SELECT TO authenticated
USING (technician_id = auth.uid() OR account_manager_id = auth.uid());

DROP POLICY IF EXISTS "Technicians update assigned work orders" ON prostoral_work_orders;
CREATE POLICY "Technicians update assigned work orders"
ON prostoral_work_orders FOR UPDATE TO authenticated
USING (technician_id = auth.uid())
WITH CHECK (technician_id = auth.uid());

-- Clientes veem suas próprias OS
DROP POLICY IF EXISTS "Clients see their work orders" ON prostoral_work_orders;
CREATE POLICY "Clients see their work orders"
ON prostoral_work_orders FOR SELECT TO authenticated
USING (
    client_id IN (
        SELECT id FROM prostoral_clients 
        WHERE created_by = auth.uid()
    )
);

-- Clientes podem confirmar recebimento (UPDATE limitado)
DROP POLICY IF EXISTS "Clients confirm work order delivery" ON prostoral_work_orders;
CREATE POLICY "Clients confirm work order delivery"
ON prostoral_work_orders FOR UPDATE TO authenticated
USING (
    client_id IN (
        SELECT id FROM prostoral_clients WHERE created_by = auth.uid()
    )
)
WITH CHECK (
    client_id IN (
        SELECT id FROM prostoral_clients WHERE created_by = auth.uid()
    )
);

-- =====================================================
-- 2. POLÍTICAS PARA prostoral_work_order_materials
-- =====================================================

ALTER TABLE prostoral_work_order_materials ENABLE ROW LEVEL SECURITY;

-- Admin vê tudo
DROP POLICY IF EXISTS "Admin see all materials" ON prostoral_work_order_materials;
CREATE POLICY "Admin see all materials"
ON prostoral_work_order_materials FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'superadmin')
        AND ur.is_active = true
    )
);

-- Técnicos veem e adicionam materiais das suas OS
DROP POLICY IF EXISTS "Technicians manage materials" ON prostoral_work_order_materials;
CREATE POLICY "Technicians manage materials"
ON prostoral_work_order_materials FOR ALL TO authenticated
USING (
    work_order_id IN (
        SELECT id FROM prostoral_work_orders 
        WHERE technician_id = auth.uid()
    )
);

-- Clientes veem materiais das suas OS (read-only)
DROP POLICY IF EXISTS "Clients see materials" ON prostoral_work_order_materials;
CREATE POLICY "Clients see materials"
ON prostoral_work_order_materials FOR SELECT TO authenticated
USING (
    work_order_id IN (
        SELECT wo.id FROM prostoral_work_orders wo
        JOIN prostoral_clients c ON c.id = wo.client_id
        WHERE c.created_by = auth.uid()
    )
);

-- =====================================================
-- 3. POLÍTICAS PARA prostoral_work_order_time_tracking
-- =====================================================

ALTER TABLE prostoral_work_order_time_tracking ENABLE ROW LEVEL SECURITY;

-- Admin vê tudo
DROP POLICY IF EXISTS "Admin see all time tracking" ON prostoral_work_order_time_tracking;
CREATE POLICY "Admin see all time tracking"
ON prostoral_work_order_time_tracking FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'superadmin')
        AND ur.is_active = true
    )
);

-- Técnicos gerenciam seu próprio time tracking
DROP POLICY IF EXISTS "Technicians manage own time tracking" ON prostoral_work_order_time_tracking;
CREATE POLICY "Technicians manage own time tracking"
ON prostoral_work_order_time_tracking FOR ALL TO authenticated
USING (technician_id = auth.uid());

-- Técnicos veem time tracking das OS atribuídas
DROP POLICY IF EXISTS "Technicians see time tracking of assigned WO" ON prostoral_work_order_time_tracking;
CREATE POLICY "Technicians see time tracking of assigned WO"
ON prostoral_work_order_time_tracking FOR SELECT TO authenticated
USING (
    work_order_id IN (
        SELECT id FROM prostoral_work_orders WHERE technician_id = auth.uid()
    )
);

-- =====================================================
-- 4. POLÍTICAS PARA prostoral_work_order_issues
-- =====================================================

ALTER TABLE prostoral_work_order_issues ENABLE ROW LEVEL SECURITY;

-- Admin vê tudo
DROP POLICY IF EXISTS "Admin see all issues" ON prostoral_work_order_issues;
CREATE POLICY "Admin see all issues"
ON prostoral_work_order_issues FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'superadmin')
        AND ur.is_active = true
    )
);

-- Remover políticas antigas
DROP POLICY IF EXISTS "Technicians manage issues from their WO" ON prostoral_work_order_issues;
DROP POLICY IF EXISTS "Clients see visible issues" ON prostoral_work_order_issues;
DROP POLICY IF EXISTS "Clients respond to visible issues" ON prostoral_work_order_issues;

-- Usuários veem apenas suas próprias intercorrências
DROP POLICY IF EXISTS "Users see only their own issues" ON prostoral_work_order_issues;
CREATE POLICY "Users see only their own issues"
ON prostoral_work_order_issues FOR SELECT TO authenticated
USING (reported_by = auth.uid());

-- Usuários criam intercorrências
DROP POLICY IF EXISTS "Users create their own issues" ON prostoral_work_order_issues;
CREATE POLICY "Users create their own issues"
ON prostoral_work_order_issues FOR INSERT TO authenticated
WITH CHECK (reported_by = auth.uid());

-- Usuários atualizam apenas suas próprias
DROP POLICY IF EXISTS "Users update their own issues" ON prostoral_work_order_issues;
CREATE POLICY "Users update their own issues"
ON prostoral_work_order_issues FOR UPDATE TO authenticated
USING (reported_by = auth.uid())
WITH CHECK (reported_by = auth.uid());

-- =====================================================
-- 5. POLÍTICAS PARA prostoral_work_order_status_history
-- =====================================================

ALTER TABLE prostoral_work_order_status_history ENABLE ROW LEVEL SECURITY;

-- Admin vê tudo
DROP POLICY IF EXISTS "Admin see all status history" ON prostoral_work_order_status_history;
CREATE POLICY "Admin see all status history"
ON prostoral_work_order_status_history FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'superadmin')
        AND ur.is_active = true
    )
);

-- Técnicos veem histórico das suas OS
DROP POLICY IF EXISTS "Technicians see status history" ON prostoral_work_order_status_history;
CREATE POLICY "Technicians see status history"
ON prostoral_work_order_status_history FOR SELECT TO authenticated
USING (
    work_order_id IN (
        SELECT id FROM prostoral_work_orders WHERE technician_id = auth.uid()
    )
);

-- Clientes veem histórico das suas OS
DROP POLICY IF EXISTS "Clients see status history" ON prostoral_work_order_status_history;
CREATE POLICY "Clients see status history"
ON prostoral_work_order_status_history FOR SELECT TO authenticated
USING (
    work_order_id IN (
        SELECT wo.id FROM prostoral_work_orders wo
        JOIN prostoral_clients c ON c.id = wo.client_id
        WHERE c.created_by = auth.uid()
    )
);

-- =====================================================
-- FIM DAS POLÍTICAS RLS
-- =====================================================

