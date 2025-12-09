-- =====================================================
-- SISTEMA DE ORDENS DE SERVIÇO - FUNCTIONS E TRIGGERS
-- ProStoral - Laboratório Protético
-- =====================================================

-- =====================================================
-- 1. FUNCTION: Gerar QR Code para OS
-- =====================================================

CREATE OR REPLACE FUNCTION generate_work_order_qr()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qr_code IS NULL THEN
        NEW.qr_code := 'WO-' || NEW.order_number;
        NEW.qr_code_url := 'https://prostoral.app/os/' || NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar QR ao criar OS
DROP TRIGGER IF EXISTS trg_generate_work_order_qr ON prostoral_work_orders;
CREATE TRIGGER trg_generate_work_order_qr
BEFORE INSERT ON prostoral_work_orders
FOR EACH ROW EXECUTE FUNCTION generate_work_order_qr();

-- =====================================================
-- 2. FUNCTION: Calcular custos totais da OS
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_work_order_costs(wo_id UUID)
RETURNS TABLE (
    material_cost NUMERIC,
    labor_cost NUMERIC,
    total_cost NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(m.total_cost), 0) as material_cost,
        COALESCE(SUM(t.labor_cost), 0) as labor_cost,
        COALESCE(SUM(m.total_cost), 0) + COALESCE(SUM(t.labor_cost), 0) as total_cost
    FROM prostoral_work_orders wo
    LEFT JOIN prostoral_work_order_materials m ON m.work_order_id = wo.id
    LEFT JOIN prostoral_work_order_time_tracking t ON t.work_order_id = wo.id
    WHERE wo.id = wo_id
    GROUP BY wo.id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. FUNCTION: Atualizar custos totais na OS automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION update_work_order_total_costs()
RETURNS TRIGGER AS $$
DECLARE
    wo_id UUID;
    costs RECORD;
BEGIN
    -- Determinar qual work_order_id usar
    IF TG_TABLE_NAME = 'prostoral_work_order_materials' THEN
        wo_id := COALESCE(NEW.work_order_id, OLD.work_order_id);
    ELSIF TG_TABLE_NAME = 'prostoral_work_order_time_tracking' THEN
        wo_id := COALESCE(NEW.work_order_id, OLD.work_order_id);
    END IF;
    
    -- Calcular custos
    SELECT * INTO costs FROM calculate_work_order_costs(wo_id);
    
    -- Atualizar OS
    UPDATE prostoral_work_orders
    SET 
        total_material_cost = costs.material_cost,
        total_labor_cost = costs.labor_cost,
        total_cost = costs.total_cost,
        updated_at = NOW()
    WHERE id = wo_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar custos quando materiais ou tempo mudam
DROP TRIGGER IF EXISTS trg_update_costs_on_material_change ON prostoral_work_order_materials;
CREATE TRIGGER trg_update_costs_on_material_change
AFTER INSERT OR UPDATE OR DELETE ON prostoral_work_order_materials
FOR EACH ROW EXECUTE FUNCTION update_work_order_total_costs();

DROP TRIGGER IF EXISTS trg_update_costs_on_time_change ON prostoral_work_order_time_tracking;
CREATE TRIGGER trg_update_costs_on_time_change
AFTER INSERT OR UPDATE OR DELETE ON prostoral_work_order_time_tracking
FOR EACH ROW EXECUTE FUNCTION update_work_order_total_costs();

-- =====================================================
-- 4. FUNCTION: Dar baixa no estoque ao usar material
-- =====================================================

CREATE OR REPLACE FUNCTION update_inventory_on_material_use()
RETURNS TRIGGER AS $$
DECLARE
    wo_number VARCHAR(50);
BEGIN
    -- Buscar número da OS
    SELECT order_number INTO wo_number 
    FROM prostoral_work_orders 
    WHERE id = NEW.work_order_id;
    
    -- Dar baixa no estoque
    UPDATE prostoral_inventory
    SET quantity = quantity - NEW.used_quantity,
        updated_at = NOW()
    WHERE id = NEW.inventory_item_id;
    
    -- Registrar movimentação
    INSERT INTO prostoral_inventory_movements (
        inventory_item_id,
        movement_type,
        quantity,
        previous_quantity,
        new_quantity,
        work_order_id,
        performed_by,
        reason,
        tenant_id,
        created_at
    )
    SELECT 
        NEW.inventory_item_id,
        'usage',
        NEW.used_quantity,
        pi.quantity + NEW.used_quantity, -- quantidade antes
        pi.quantity, -- quantidade depois
        NEW.work_order_id,
        NEW.added_by,
        'Usado em OS: ' || wo_number,
        pi.tenant_id,
        NOW()
    FROM prostoral_inventory pi
    WHERE pi.id = NEW.inventory_item_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para baixa automática no estoque
DROP TRIGGER IF EXISTS trg_update_inventory_on_material_use ON prostoral_work_order_materials;
CREATE TRIGGER trg_update_inventory_on_material_use
AFTER INSERT ON prostoral_work_order_materials
FOR EACH ROW EXECUTE FUNCTION update_inventory_on_material_use();

-- =====================================================
-- 5. FUNCTION: Calcular duração de time tracking
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_time_tracking_duration()
RETURNS TRIGGER AS $$
DECLARE
    total_pause_minutes INTEGER := 0;
    pause_period JSONB;
    pause_start TIMESTAMP WITH TIME ZONE;
    pause_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calcular duração quando finalizado
    IF NEW.finished_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        
        -- Calcular tempo total trabalhado
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at)) / 60;
        
        -- Subtrair pausas
        IF NEW.pause_periods IS NOT NULL AND jsonb_array_length(NEW.pause_periods) > 0 THEN
            FOR pause_period IN SELECT * FROM jsonb_array_elements(NEW.pause_periods)
            LOOP
                pause_start := (pause_period->>'paused_at')::TIMESTAMP WITH TIME ZONE;
                pause_end := (pause_period->>'resumed_at')::TIMESTAMP WITH TIME ZONE;
                
                IF pause_end IS NOT NULL THEN
                    total_pause_minutes := total_pause_minutes + 
                        EXTRACT(EPOCH FROM (pause_end - pause_start)) / 60;
                END IF;
            END LOOP;
            
            NEW.duration_minutes := NEW.duration_minutes - total_pause_minutes;
        END IF;
        
        -- Calcular custo se houver hourly_rate
        IF NEW.hourly_rate IS NOT NULL THEN
            NEW.labor_cost := (NEW.duration_minutes / 60.0) * NEW.hourly_rate;
        END IF;
        
        NEW.status := 'completed';
        NEW.updated_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular duração
DROP TRIGGER IF EXISTS trg_calculate_time_tracking ON prostoral_work_order_time_tracking;
CREATE TRIGGER trg_calculate_time_tracking
BEFORE UPDATE ON prostoral_work_order_time_tracking
FOR EACH ROW EXECUTE FUNCTION calculate_time_tracking_duration();

-- =====================================================
-- 6. FUNCTION: Registrar mudança de status
-- =====================================================

CREATE OR REPLACE FUNCTION log_work_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO prostoral_work_order_status_history (
            work_order_id,
            old_status,
            new_status,
            changed_by,
            changed_at,
            notes
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NEW.updated_by,
            NOW(),
            CASE 
                WHEN NEW.confirmed_by_client_at IS NOT NULL 
                    AND OLD.confirmed_by_client_at IS NULL 
                THEN 'Confirmado recebimento pelo cliente via QR Code'
                ELSE NULL
            END
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para log de status
DROP TRIGGER IF EXISTS trg_log_work_order_status_change ON prostoral_work_orders;
CREATE TRIGGER trg_log_work_order_status_change
AFTER UPDATE ON prostoral_work_orders
FOR EACH ROW EXECUTE FUNCTION log_work_order_status_change();

-- =====================================================
-- 7. FUNCTION: Atualizar updated_at automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS trg_update_wo_time_tracking_updated_at ON prostoral_work_order_time_tracking;
CREATE TRIGGER trg_update_wo_time_tracking_updated_at
BEFORE UPDATE ON prostoral_work_order_time_tracking
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_wo_issues_updated_at ON prostoral_work_order_issues;
CREATE TRIGGER trg_update_wo_issues_updated_at
BEFORE UPDATE ON prostoral_work_order_issues
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. FUNCTION: Adicionar produtos de um kit à OS
-- =====================================================

CREATE OR REPLACE FUNCTION add_kit_materials_to_work_order(
    p_work_order_id UUID,
    p_kit_id UUID,
    p_added_by UUID
)
RETURNS VOID AS $$
BEGIN
    -- Inserir todos os produtos do kit na OS
    INSERT INTO prostoral_work_order_materials (
        work_order_id,
        inventory_item_id,
        from_kit_id,
        planned_quantity,
        used_quantity,
        unit,
        unit_cost,
        added_by
    )
    SELECT 
        p_work_order_id,
        kp.produto_id,
        p_kit_id,
        kp.quantidade,
        kp.quantidade, -- usado = planejado por padrão
        pi.unit,
        pi.unit_cost,
        p_added_by
    FROM kit_produtos kp
    JOIN prostoral_inventory pi ON pi.id = kp.produto_id
    WHERE kp.kit_id = p_kit_id;
    
    RAISE NOTICE 'Kit % adicionado à OS %', p_kit_id, p_work_order_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIM DAS FUNCTIONS E TRIGGERS
-- =====================================================

