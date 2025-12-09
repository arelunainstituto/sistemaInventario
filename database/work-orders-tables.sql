-- =====================================================
-- SISTEMA DE ORDENS DE SERVIÇO - TABELAS
-- ProStoral - Laboratório Protético
-- =====================================================

-- =====================================================
-- 1. EXPANSÃO DA TABELA prostoral_work_orders
-- =====================================================

-- Adicionar novos campos à tabela existente
ALTER TABLE prostoral_work_orders
ADD COLUMN IF NOT EXISTS confirmed_by_client_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmed_by_client_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS total_material_cost NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_labor_cost NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10,2) DEFAULT 0;

-- Comentários
COMMENT ON COLUMN prostoral_work_orders.confirmed_by_client_at IS 'Data/hora em que o cliente confirmou recebimento via QR Code';
COMMENT ON COLUMN prostoral_work_orders.confirmed_by_client_id IS 'ID do usuário cliente que confirmou recebimento';
COMMENT ON COLUMN prostoral_work_orders.total_material_cost IS 'Custo total de materiais usados na OS';
COMMENT ON COLUMN prostoral_work_orders.total_labor_cost IS 'Custo total de mão de obra da OS';
COMMENT ON COLUMN prostoral_work_orders.total_cost IS 'Custo total da OS (materiais + mão de obra)';

-- =====================================================
-- 2. TABELA prostoral_work_order_materials
-- Tracking de materiais usados (produtos + kits)
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_work_order_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES prostoral_work_orders(id) ON DELETE CASCADE,
    
    -- Produto individual ou do kit
    inventory_item_id UUID NOT NULL REFERENCES prostoral_inventory(id) ON DELETE RESTRICT,
    from_kit_id UUID REFERENCES kits(id), -- se veio de um kit
    
    -- Quantidades
    planned_quantity NUMERIC(10,3),
    used_quantity NUMERIC(10,3) NOT NULL CHECK (used_quantity > 0),
    unit VARCHAR(50),
    
    -- Custos
    unit_cost NUMERIC(10,2),
    total_cost NUMERIC(10,2) GENERATED ALWAYS AS (used_quantity * unit_cost) STORED,
    
    -- Tracking
    added_by UUID REFERENCES auth.users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Observações
    notes TEXT,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_wo_materials_work_order ON prostoral_work_order_materials(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_materials_inventory ON prostoral_work_order_materials(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_wo_materials_kit ON prostoral_work_order_materials(from_kit_id);

-- Comentários
COMMENT ON TABLE prostoral_work_order_materials IS 'Materiais utilizados em cada ordem de serviço';
COMMENT ON COLUMN prostoral_work_order_materials.from_kit_id IS 'Se o material veio de um kit pré-configurado';
COMMENT ON COLUMN prostoral_work_order_materials.planned_quantity IS 'Quantidade planejada (do kit)';
COMMENT ON COLUMN prostoral_work_order_materials.used_quantity IS 'Quantidade realmente utilizada';

-- =====================================================
-- 3. TABELA prostoral_work_order_time_tracking
-- Tracking de tempo dos profissionais
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_work_order_time_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES prostoral_work_orders(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Etapa do trabalho
    stage VARCHAR(100) NOT NULL CHECK (stage IN ('design', 'production', 'finishing', 'quality_control', 'other')),
    
    -- Tempos
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    paused_at TIMESTAMP WITH TIME ZONE,
    resumed_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    
    -- Duração em minutos (calculada automaticamente)
    duration_minutes INTEGER,
    
    -- Pausas (array de períodos pausados)
    pause_periods JSONB DEFAULT '[]', -- [{paused_at, resumed_at, duration_minutes}]
    
    -- Custos
    hourly_rate NUMERIC(10,2),
    labor_cost NUMERIC(10,2),
    
    -- Status
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'paused', 'completed', 'transferred')),
    transferred_to UUID REFERENCES auth.users(id),
    transferred_at TIMESTAMP WITH TIME ZONE,
    
    -- Observações
    notes TEXT,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_wo_time_work_order ON prostoral_work_order_time_tracking(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_time_technician ON prostoral_work_order_time_tracking(technician_id);
CREATE INDEX IF NOT EXISTS idx_wo_time_status ON prostoral_work_order_time_tracking(status);

-- Comentários
COMMENT ON TABLE prostoral_work_order_time_tracking IS 'Registro de tempo trabalhado em cada OS por técnico';
COMMENT ON COLUMN prostoral_work_order_time_tracking.stage IS 'Etapa: design, production, finishing, quality_control, other';
COMMENT ON COLUMN prostoral_work_order_time_tracking.pause_periods IS 'Histórico de pausas durante o trabalho';
COMMENT ON COLUMN prostoral_work_order_time_tracking.transferred_to IS 'Técnico para quem o trabalho foi transferido';

-- =====================================================
-- 4. TABELA prostoral_work_order_issues
-- Sistema de intercorrências/problemas
-- =====================================================

CREATE TABLE IF NOT EXISTS prostoral_work_order_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES prostoral_work_orders(id) ON DELETE CASCADE,
    
    -- Tipo e gravidade
    type VARCHAR(100) NOT NULL CHECK (type IN ('technical', 'material', 'delay', 'quality', 'client_request', 'other')),
    severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Descrição
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Quem reportou
    reported_by UUID NOT NULL REFERENCES auth.users(id),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Resposta/Justificativa
    response TEXT,
    responded_by UUID REFERENCES auth.users(id),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'closed')),
    
    -- Anexos (fotos de problemas, documentos)
    attachments JSONB DEFAULT '[]', -- [{name, url, type, size, uploaded_at}]
    
    -- Visibilidade
    visible_to_client BOOLEAN DEFAULT false,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_wo_issues_work_order ON prostoral_work_order_issues(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_issues_reported_by ON prostoral_work_order_issues(reported_by);
CREATE INDEX IF NOT EXISTS idx_wo_issues_status ON prostoral_work_order_issues(status);
CREATE INDEX IF NOT EXISTS idx_wo_issues_visible_client ON prostoral_work_order_issues(visible_to_client);

-- Comentários
COMMENT ON TABLE prostoral_work_order_issues IS 'Intercorrências e problemas reportados durante a execução da OS';
COMMENT ON COLUMN prostoral_work_order_issues.type IS 'Tipo: technical, material, delay, quality, client_request, other';
COMMENT ON COLUMN prostoral_work_order_issues.severity IS 'Gravidade: low, medium, high, critical';
COMMENT ON COLUMN prostoral_work_order_issues.visible_to_client IS 'Se true, o cliente pode ver esta intercorrência';
COMMENT ON COLUMN prostoral_work_order_issues.attachments IS 'Fotos e documentos relacionados ao problema';

-- =====================================================
-- 5. VERIFICAR/AJUSTAR prostoral_work_order_status_history
-- =====================================================

-- Verificar se a tabela já existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prostoral_work_order_status_history') THEN
        CREATE TABLE prostoral_work_order_status_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            work_order_id UUID NOT NULL REFERENCES prostoral_work_orders(id) ON DELETE CASCADE,
            
            old_status VARCHAR(50),
            new_status VARCHAR(50) NOT NULL,
            
            changed_by UUID REFERENCES auth.users(id),
            changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            notes TEXT,
            
            -- Metadata adicional (opcional)
            metadata JSONB DEFAULT '{}'
        );
        
        CREATE INDEX idx_wo_status_history_work_order ON prostoral_work_order_status_history(work_order_id);
        CREATE INDEX idx_wo_status_history_changed_at ON prostoral_work_order_status_history(changed_at);
        
        COMMENT ON TABLE prostoral_work_order_status_history IS 'Histórico de mudanças de status das ordens de serviço';
    END IF;
END $$;

-- =====================================================
-- FIM DA CRIAÇÃO DE TABELAS
-- =====================================================

