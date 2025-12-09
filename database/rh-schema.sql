-- =====================================================
-- MÓDULO RH - SCHEMA COMPLETO (CORRIGIDO E ROBUSTO)
-- =====================================================

-- 0. Tabelas de Sistema (Roles e Permissões)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    level INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- 1. Tabela de Funcionários (Core)
CREATE TABLE IF NOT EXISTS rh_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    nif TEXT UNIQUE,
    mobile TEXT,
    address TEXT,
    department TEXT NOT NULL,
    role TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'VACATION', 'LEAVE', 'INACTIVE')),
    hire_date DATE NOT NULL,
    salary_base NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- CORREÇÃO: Adicionar coluna user_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rh_employees' AND column_name = 'user_id') THEN
        ALTER TABLE rh_employees ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Tabela de Folha de Pagamento
CREATE TABLE IF NOT EXISTS rh_payrolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES rh_employees(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    base_salary NUMERIC NOT NULL,
    overtime_value NUMERIC DEFAULT 0,
    bonus NUMERIC DEFAULT 0,
    other_discounts NUMERIC DEFAULT 0,
    net_salary NUMERIC NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINALIZED')),
    finalized_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Documentos
CREATE TABLE IF NOT EXISTS rh_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES rh_employees(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    url TEXT NOT NULL,
    size INTEGER,
    category VARCHAR(50),
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Ausências e Férias
CREATE TABLE IF NOT EXISTS rh_absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES rh_employees(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('FERIAS', 'ATESTADO', 'LICENCA_MATERNIDADE', 'LICENCA_PATERNIDADE', 'FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA', 'FOLGA')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count NUMERIC NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reason TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 5. Tabela de Saldo de Férias
CREATE TABLE IF NOT EXISTS rh_vacation_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES rh_employees(id) ON DELETE CASCADE,
    total_days NUMERIC DEFAULT 30,
    used_days NUMERIC DEFAULT 0,
    available_days NUMERIC DEFAULT 30,
    year INTEGER NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, year)
);

-- 6. Tabela de Avaliações de Desempenho
CREATE TABLE IF NOT EXISTS rh_performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES rh_employees(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES auth.users(id),
    review_type VARCHAR(50) NOT NULL CHECK (review_type IN ('ANNUAL', 'PROBATION', 'PROJECT', '360')),
    review_period_start DATE NOT NULL,
    review_period_end DATE NOT NULL,
    productivity_score INTEGER,
    quality_score INTEGER,
    teamwork_score INTEGER,
    punctuality_score INTEGER,
    initiative_score INTEGER,
    communication_score INTEGER,
    overall_score NUMERIC,
    strengths TEXT,
    areas_for_improvement TEXT,
    goals TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabela de Histórico Salarial
CREATE TABLE IF NOT EXISTS rh_salary_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES rh_employees(id) ON DELETE CASCADE,
    old_salary NUMERIC,
    new_salary NUMERIC NOT NULL,
    change_reason TEXT,
    effective_date DATE NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_vacation_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_salary_history ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura para Roles
DROP POLICY IF EXISTS "read_roles" ON roles;
CREATE POLICY "read_roles" ON roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read_user_roles" ON user_roles;
CREATE POLICY "read_user_roles" ON user_roles FOR SELECT TO authenticated USING (true);

-- --- POLÍTICAS PARA rh_employees ---

DROP POLICY IF EXISTS "rh_managers_view_all_employees" ON rh_employees;
CREATE POLICY "rh_managers_view_all_employees" ON rh_employees
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('Admin', 'rh_manager')
            AND ur.is_active = true
        )
    );

DROP POLICY IF EXISTS "employees_view_own_data" ON rh_employees;
CREATE POLICY "employees_view_own_data" ON rh_employees
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- --- POLÍTICAS PARA rh_payrolls ---

DROP POLICY IF EXISTS "rh_managers_manage_payrolls" ON rh_payrolls;
CREATE POLICY "rh_managers_manage_payrolls" ON rh_payrolls
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('Admin', 'rh_manager')
        )
    );

DROP POLICY IF EXISTS "employees_view_own_payrolls" ON rh_payrolls;
CREATE POLICY "employees_view_own_payrolls" ON rh_payrolls
    FOR SELECT TO authenticated
    USING (
        employee_id IN (SELECT id FROM rh_employees WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    );

-- --- POLÍTICAS PARA rh_documents ---

DROP POLICY IF EXISTS "rh_managers_manage_documents" ON rh_documents;
CREATE POLICY "rh_managers_manage_documents" ON rh_documents
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('Admin', 'rh_manager')
        )
    );

DROP POLICY IF EXISTS "employees_view_own_documents" ON rh_documents;
CREATE POLICY "employees_view_own_documents" ON rh_documents
    FOR SELECT TO authenticated
    USING (
        employee_id IN (SELECT id FROM rh_employees WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    );

-- --- POLÍTICAS PARA rh_absences ---

DROP POLICY IF EXISTS "rh_managers_manage_absences" ON rh_absences;
CREATE POLICY "rh_managers_manage_absences" ON rh_absences
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('Admin', 'rh_manager')
        )
    );

DROP POLICY IF EXISTS "employees_manage_own_absences" ON rh_absences;
CREATE POLICY "employees_manage_own_absences" ON rh_absences
    FOR ALL TO authenticated
    USING (
        employee_id IN (SELECT id FROM rh_employees WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    );

-- --- POLÍTICAS PARA rh_performance_reviews ---

DROP POLICY IF EXISTS "rh_managers_manage_reviews" ON rh_performance_reviews;
CREATE POLICY "rh_managers_manage_reviews" ON rh_performance_reviews
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('Admin', 'rh_manager')
        )
    );

DROP POLICY IF EXISTS "employees_view_own_reviews" ON rh_performance_reviews;
CREATE POLICY "employees_view_own_reviews" ON rh_performance_reviews
    FOR SELECT TO authenticated
    USING (
        employee_id IN (SELECT id FROM rh_employees WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    );
