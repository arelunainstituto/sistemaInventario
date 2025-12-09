-- =====================================================
-- LABORATÓRIO PROSTORAL - ESTRUTURA DE BASE DE DADOS
-- Grupo AreLuna - Sistema ERP
-- Fase 1: Criação de Tabelas
-- =====================================================

-- =====================================================
-- 1. TABELA DE CLIENTES/CLÍNICAS/DENTISTAS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Informações Básicas
    name VARCHAR(255) NOT NULL,
    clinic_name VARCHAR(255),
    dentist_name VARCHAR(255),
    nif VARCHAR(50),
    
    -- Contato
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    
    -- Endereço
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Portugal',
    
    -- Informações Comerciais
    payment_terms INTEGER DEFAULT 30, -- dias
    discount_percentage DECIMAL(5,2) DEFAULT 0.00,
    credit_limit DECIMAL(10,2),
    
    -- Observações
    notes TEXT,
    preferences JSONB DEFAULT '{}', -- preferências de cor, material, etc.
    
    -- Documentos (referências para Supabase Storage)
    documents JSONB DEFAULT '[]', -- [{name, url, type, uploaded_at}]
    
    -- Comercial responsável
    account_manager_id UUID REFERENCES auth.users(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- 2. TABELA DE TIPOS DE TRABALHO
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_work_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Preços padrão
    default_price DECIMAL(10,2),
    estimated_hours DECIMAL(5,2),
    
    -- Categoria
    category VARCHAR(100), -- 'protese_fixa', 'protese_removivel', 'ortodontia', etc.
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. TABELA DE ORDENS DE SERVIÇO (OS)
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Número sequencial único
    order_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Cliente e Paciente
    client_id UUID NOT NULL REFERENCES prostoral_clients(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_age INTEGER,
    
    -- Tipo de Trabalho
    work_type_id UUID REFERENCES prostoral_work_types(id),
    work_description TEXT NOT NULL,
    shade VARCHAR(50), -- cor/tonalidade
    
    -- Datas
    received_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    delivered_date TIMESTAMP WITH TIME ZONE,
    
    -- Prioridade
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Status
    status VARCHAR(50) DEFAULT 'received',
    -- Possíveis valores: 'received', 'design', 'production', 'finishing', 'quality_control', 'delivered', 'cancelled'
    
    -- Técnico Responsável
    technician_id UUID REFERENCES auth.users(id),
    
    -- Comercial Responsável
    account_manager_id UUID REFERENCES auth.users(id),
    
    -- Valores
    price DECIMAL(10,2),
    discount DECIMAL(5,2) DEFAULT 0.00,
    final_price DECIMAL(10,2),
    
    -- QR Code
    qr_code TEXT,
    qr_code_url TEXT,
    
    -- Anexos (referências para Supabase Storage)
    attachments JSONB DEFAULT '[]', -- [{name, url, type, uploaded_at}]
    
    -- Observações
    client_notes TEXT, -- observações do cliente
    internal_notes TEXT, -- observações internas
    
    -- Kit de materiais
    kit_id UUID REFERENCES prostoral_procedure_kits(id),
    
    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT check_dates CHECK (due_date >= received_date),
    CONSTRAINT check_status CHECK (status IN ('received', 'design', 'production', 'finishing', 'quality_control', 'delivered', 'cancelled')),
    CONSTRAINT check_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- =====================================================
-- 4. TABELA DE HISTÓRICO DE STATUS DA OS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_work_order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    work_order_id UUID NOT NULL REFERENCES prostoral_work_orders(id) ON DELETE CASCADE,
    
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    notes TEXT
);

-- =====================================================
-- 5. TABELA DE KITS DE PROCEDIMENTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_procedure_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Vinculação com tipo de trabalho
    work_type_id UUID REFERENCES prostoral_work_types(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- 6. TABELA DE ITENS DO KIT
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_kit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    kit_id UUID NOT NULL REFERENCES prostoral_procedure_kits(id) ON DELETE CASCADE,
    
    -- Vinculação com inventário existente
    inventory_item_id UUID NOT NULL REFERENCES items(id),
    
    -- Quantidade padrão
    standard_quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
    unit VARCHAR(20),
    
    -- Ordem de exibição
    display_order INTEGER DEFAULT 0,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. TABELA DE MATERIAIS USADOS POR OS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_work_order_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    work_order_id UUID NOT NULL REFERENCES prostoral_work_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES items(id),
    
    -- Quantidades
    planned_quantity DECIMAL(10,3), -- quantidade prevista (do kit)
    used_quantity DECIMAL(10,3) NOT NULL, -- quantidade realmente usada
    unit VARCHAR(20),
    
    -- Custos
    unit_cost DECIMAL(10,2), -- custo unitário no momento do uso
    total_cost DECIMAL(10,2), -- custo total = used_quantity * unit_cost
    
    -- Rastreamento
    scanned_at TIMESTAMP WITH TIME ZONE, -- quando foi escaneado o QR Code
    scanned_by UUID REFERENCES auth.users(id),
    
    -- Devolução
    returned_quantity DECIMAL(10,3) DEFAULT 0,
    returned_at TIMESTAMP WITH TIME ZONE,
    
    -- Observações
    notes TEXT,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. TABELA DE REGISTRO DE HORAS (TIMESHEET)
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_time_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    work_order_id UUID NOT NULL REFERENCES prostoral_work_orders(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Etapa do trabalho
    stage VARCHAR(50) NOT NULL, -- 'design', 'production', 'finishing', 'quality_control'
    
    -- Horários
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE,
    
    -- Duração (calculada automaticamente)
    duration_minutes INTEGER,
    
    -- Custo
    hourly_rate DECIMAL(10,2), -- salário/hora do técnico no momento
    labor_cost DECIMAL(10,2), -- custo total da sessão
    
    -- Observações
    notes TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true, -- false se for corrigido/cancelado
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_checkout CHECK (check_out IS NULL OR check_out > check_in),
    CONSTRAINT check_stage CHECK (stage IN ('design', 'production', 'finishing', 'quality_control', 'other'))
);

-- =====================================================
-- 9. TABELA DE CONSERTOS/RETRABALHOS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_repairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Vinculação com OS original
    original_work_order_id UUID NOT NULL REFERENCES prostoral_work_orders(id),
    
    -- Tipo
    type VARCHAR(50) NOT NULL, -- 'warranty' (garantia) ou 'billable' (faturável)
    
    -- Motivo
    reason VARCHAR(100) NOT NULL, -- 'fit_issue', 'aesthetic', 'breakage', 'client_request', etc.
    reason_description TEXT NOT NULL,
    
    -- Responsável
    responsible_party VARCHAR(50), -- 'laboratory', 'client', 'shipping', 'material_defect'
    technician_id UUID REFERENCES auth.users(id),
    
    -- Datas
    reported_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    -- 'pending', 'in_progress', 'completed', 'cancelled'
    
    -- Custos adicionais
    additional_cost DECIMAL(10,2) DEFAULT 0,
    
    -- Faturável?
    is_billable BOOLEAN DEFAULT false,
    billed_amount DECIMAL(10,2),
    
    -- Observações
    notes TEXT,
    resolution_notes TEXT,
    
    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT check_repair_type CHECK (type IN ('warranty', 'billable')),
    CONSTRAINT check_repair_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- =====================================================
-- 10. TABELA DE INTERCORRÊNCIAS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Vinculação com OS
    work_order_id UUID NOT NULL REFERENCES prostoral_work_orders(id),
    
    -- Tipo
    type VARCHAR(50) NOT NULL, -- 'technical', 'aesthetic', 'delivery', 'communication', 'other'
    
    -- Detalhes
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Urgência
    urgency VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    
    -- Status
    status VARCHAR(50) DEFAULT 'open',
    -- 'open', 'analyzing', 'in_repair', 'waiting_client', 'resolved', 'closed'
    
    -- Responsáveis
    reported_by UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    
    -- Datas
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- Anexos
    attachments JSONB DEFAULT '[]', -- [{name, url, type, uploaded_at}]
    
    -- Conversão para conserto
    converted_to_repair_id UUID REFERENCES prostoral_repairs(id),
    
    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_issue_type CHECK (type IN ('technical', 'aesthetic', 'delivery', 'communication', 'other')),
    CONSTRAINT check_issue_urgency CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT check_issue_status CHECK (status IN ('open', 'analyzing', 'in_repair', 'waiting_client', 'resolved', 'closed'))
);

-- =====================================================
-- 11. TABELA DE COMENTÁRIOS/COMUNICAÇÕES DE INTERCORRÊNCIAS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_issue_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    issue_id UUID NOT NULL REFERENCES prostoral_issues(id) ON DELETE CASCADE,
    
    comment TEXT NOT NULL,
    
    -- Autor
    author_id UUID REFERENCES auth.users(id),
    
    -- Visibilidade
    is_internal BOOLEAN DEFAULT false, -- true = apenas laboratório, false = visível para cliente
    
    -- Anexos
    attachments JSONB DEFAULT '[]',
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 12. TABELA DE CMV (Custo da Mercadoria Vendida)
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_cmv (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    work_order_id UUID UNIQUE NOT NULL REFERENCES prostoral_work_orders(id) ON DELETE CASCADE,
    
    -- Materiais Diretos
    direct_materials_cost DECIMAL(10,2) DEFAULT 0,
    
    -- Mão de Obra Direta (MOD)
    direct_labor_cost DECIMAL(10,2) DEFAULT 0,
    direct_labor_hours DECIMAL(5,2) DEFAULT 0,
    
    -- Custos Indiretos
    indirect_costs DECIMAL(10,2) DEFAULT 0,
    
    -- Total CMV
    total_cmv DECIMAL(10,2) GENERATED ALWAYS AS (
        direct_materials_cost + direct_labor_cost + indirect_costs
    ) STORED,
    
    -- Margem
    selling_price DECIMAL(10,2),
    gross_margin DECIMAL(10,2) GENERATED ALWAYS AS (
        COALESCE(selling_price, 0) - (direct_materials_cost + direct_labor_cost + indirect_costs)
    ) STORED,
    margin_percentage DECIMAL(5,2), -- calculado: (gross_margin / selling_price) * 100
    
    -- Status
    is_calculated BOOLEAN DEFAULT false,
    calculated_at TIMESTAMP WITH TIME ZONE,
    
    -- Observações
    notes TEXT,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 13. TABELA DE CONFIGURAÇÃO DE CUSTOS INDIRETOS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_indirect_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Valor mensal do custo
    monthly_amount DECIMAL(10,2) NOT NULL,
    
    -- Método de rateio
    allocation_method VARCHAR(50) DEFAULT 'per_hour',
    -- 'per_hour', 'per_order', 'percentage'
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 14. TABELA DE FATURAS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Número da fatura
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Cliente
    client_id UUID NOT NULL REFERENCES prostoral_clients(id),
    
    -- Datas
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    paid_date DATE,
    
    -- Valores
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    -- 'pending', 'sent', 'paid', 'overdue', 'cancelled'
    
    -- Pagamento
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    
    -- Observações
    notes TEXT,
    
    -- Arquivo PDF
    pdf_url TEXT,
    
    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT check_invoice_status CHECK (status IN ('pending', 'sent', 'paid', 'overdue', 'cancelled'))
);

-- =====================================================
-- 15. TABELA DE ITENS DA FATURA
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    invoice_id UUID NOT NULL REFERENCES prostoral_invoices(id) ON DELETE CASCADE,
    work_order_id UUID REFERENCES prostoral_work_orders(id),
    
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    
    -- Ordem de exibição
    display_order INTEGER DEFAULT 0,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 16. TABELA DE SALÁRIOS DOS TÉCNICOS
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_technician_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    technician_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Taxa horária
    hourly_rate DECIMAL(10,2) NOT NULL,
    
    -- Período de validade
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT check_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT unique_active_rate UNIQUE (technician_id, is_active) WHERE is_active = true
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Clientes
CREATE INDEX IF NOT EXISTS idx_prostoral_clients_tenant ON prostoral_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_clients_active ON prostoral_clients(is_active);
CREATE INDEX IF NOT EXISTS idx_prostoral_clients_name ON prostoral_clients(name);

-- Ordens de Serviço
CREATE INDEX IF NOT EXISTS idx_prostoral_wo_tenant ON prostoral_work_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_wo_client ON prostoral_work_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_wo_status ON prostoral_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_prostoral_wo_technician ON prostoral_work_orders(technician_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_wo_dates ON prostoral_work_orders(received_date, due_date);
CREATE INDEX IF NOT EXISTS idx_prostoral_wo_number ON prostoral_work_orders(order_number);

-- Materiais
CREATE INDEX IF NOT EXISTS idx_prostoral_materials_wo ON prostoral_work_order_materials(work_order_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_materials_item ON prostoral_work_order_materials(inventory_item_id);

-- Time Tracking
CREATE INDEX IF NOT EXISTS idx_prostoral_time_wo ON prostoral_time_tracking(work_order_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_time_tech ON prostoral_time_tracking(technician_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_time_dates ON prostoral_time_tracking(check_in, check_out);

-- Consertos
CREATE INDEX IF NOT EXISTS idx_prostoral_repairs_original ON prostoral_repairs(original_work_order_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_repairs_status ON prostoral_repairs(status);
CREATE INDEX IF NOT EXISTS idx_prostoral_repairs_tenant ON prostoral_repairs(tenant_id);

-- Intercorrências
CREATE INDEX IF NOT EXISTS idx_prostoral_issues_wo ON prostoral_issues(work_order_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_issues_status ON prostoral_issues(status);
CREATE INDEX IF NOT EXISTS idx_prostoral_issues_tenant ON prostoral_issues(tenant_id);

-- Faturas
CREATE INDEX IF NOT EXISTS idx_prostoral_invoices_client ON prostoral_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_prostoral_invoices_status ON prostoral_invoices(status);
CREATE INDEX IF NOT EXISTS idx_prostoral_invoices_dates ON prostoral_invoices(issue_date, due_date);

-- =====================================================
-- COMENTÁRIOS NAS TABELAS
-- =====================================================

COMMENT ON TABLE prostoral_clients IS 'Clientes, clínicas e dentistas do laboratório';
COMMENT ON TABLE prostoral_work_orders IS 'Ordens de serviço (OS) do laboratório';
COMMENT ON TABLE prostoral_procedure_kits IS 'Kits de materiais por tipo de procedimento';
COMMENT ON TABLE prostoral_work_order_materials IS 'Materiais utilizados em cada OS';
COMMENT ON TABLE prostoral_time_tracking IS 'Registro de horas trabalhadas por técnico';
COMMENT ON TABLE prostoral_repairs IS 'Consertos e retrabalhos';
COMMENT ON TABLE prostoral_issues IS 'Intercorrências e comunicações com clientes';
COMMENT ON TABLE prostoral_cmv IS 'Cálculo de CMV (Custo da Mercadoria Vendida)';
COMMENT ON TABLE prostoral_invoices IS 'Faturas emitidas';
COMMENT ON TABLE prostoral_technician_rates IS 'Taxas horárias dos técnicos';

