-- =====================================================
-- SISTEMA DE OS DE REPARO
-- Data: 23/10/2025
-- =====================================================

-- Adicionar campos para vincular OS de reparo à OS principal
ALTER TABLE prostoral_work_orders
ADD COLUMN IF NOT EXISTS is_repair BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES prostoral_work_orders(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS repair_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS repair_reason TEXT;

-- Comentários
COMMENT ON COLUMN prostoral_work_orders.is_repair IS 'Indica se esta OS é um reparo';
COMMENT ON COLUMN prostoral_work_orders.parent_order_id IS 'ID da OS original que está sendo reparada';
COMMENT ON COLUMN prostoral_work_orders.repair_type IS 'Tipo de reparo: warranty (garantia), billable (pago), goodwill (cortesia)';
COMMENT ON COLUMN prostoral_work_orders.repair_reason IS 'Motivo do reparo';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_work_orders_is_repair ON prostoral_work_orders(is_repair);
CREATE INDEX IF NOT EXISTS idx_work_orders_parent_order ON prostoral_work_orders(parent_order_id);

-- Constraint para garantir que repair_type seja válido
ALTER TABLE prostoral_work_orders
ADD CONSTRAINT check_repair_type 
CHECK (
    (is_repair = FALSE AND parent_order_id IS NULL AND repair_type IS NULL) OR
    (is_repair = TRUE AND parent_order_id IS NOT NULL AND repair_type IN ('warranty', 'billable', 'goodwill'))
);

-- =====================================================
-- VIEW: OS com informações de reparo
-- =====================================================

CREATE OR REPLACE VIEW prostoral_work_orders_with_repairs AS
SELECT 
    wo.*,
    -- Contar quantos reparos esta OS tem
    (SELECT COUNT(*) FROM prostoral_work_orders WHERE parent_order_id = wo.id) as repairs_count,
    -- Custo total dos reparos
    (SELECT COALESCE(SUM(total_cost), 0) FROM prostoral_work_orders WHERE parent_order_id = wo.id) as repairs_total_cost,
    -- Se é reparo, pegar info da OS pai
    CASE 
        WHEN wo.is_repair THEN (SELECT order_number FROM prostoral_work_orders WHERE id = wo.parent_order_id)
        ELSE NULL
    END as parent_order_number
FROM prostoral_work_orders wo;

COMMENT ON VIEW prostoral_work_orders_with_repairs IS 'View com informações agregadas de reparos';

-- =====================================================
-- FUNCTION: Calcular custo total incluindo reparos
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_order_total_with_repairs(order_id UUID)
RETURNS NUMERIC(10,2) AS $$
DECLARE
    v_total NUMERIC(10,2);
BEGIN
    SELECT 
        COALESCE(wo.total_cost, 0) + 
        COALESCE((SELECT SUM(total_cost) FROM prostoral_work_orders WHERE parent_order_id = order_id), 0)
    INTO v_total
    FROM prostoral_work_orders wo
    WHERE wo.id = order_id;
    
    RETURN COALESCE(v_total, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_order_total_with_repairs IS 'Calcula o custo total de uma OS incluindo todos os seus reparos';

-- =====================================================
-- FUNCTION: Obter todas as OSs relacionadas (principal + reparos)
-- =====================================================

CREATE OR REPLACE FUNCTION get_related_orders(order_id UUID)
RETURNS TABLE (
    id UUID,
    order_number VARCHAR(50),
    is_repair BOOLEAN,
    repair_type VARCHAR(50),
    status VARCHAR(50),
    total_cost NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Se a OS fornecida é um reparo, buscar a OS principal
    DECLARE
        v_parent_id UUID;
    BEGIN
        SELECT parent_order_id INTO v_parent_id
        FROM prostoral_work_orders
        WHERE prostoral_work_orders.id = order_id;
        
        -- Se tem parent, usar o parent como base
        IF v_parent_id IS NOT NULL THEN
            order_id := v_parent_id;
        END IF;
    END;
    
    -- Retornar a OS principal + todos os reparos
    RETURN QUERY
    SELECT 
        wo.id,
        wo.order_number,
        wo.is_repair,
        wo.repair_type,
        wo.status,
        wo.total_cost,
        wo.created_at
    FROM prostoral_work_orders wo
    WHERE wo.id = order_id OR wo.parent_order_id = order_id
    ORDER BY wo.is_repair, wo.created_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_related_orders IS 'Retorna a OS principal e todos os seus reparos vinculados';

-- =====================================================
-- TRIGGER: Atualizar custo total da OS pai quando reparo é modificado
-- =====================================================

CREATE OR REPLACE FUNCTION update_parent_order_cost()
RETURNS TRIGGER AS $$
BEGIN
    -- Se é um reparo e tem OS pai
    IF NEW.is_repair AND NEW.parent_order_id IS NOT NULL THEN
        -- Atualizar o updated_at da OS pai para indicar que houve mudança
        UPDATE prostoral_work_orders
        SET updated_at = NOW()
        WHERE id = NEW.parent_order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_update_parent_order_cost ON prostoral_work_orders;
CREATE TRIGGER trigger_update_parent_order_cost
AFTER INSERT OR UPDATE OF total_cost ON prostoral_work_orders
FOR EACH ROW
EXECUTE FUNCTION update_parent_order_cost();

COMMENT ON FUNCTION update_parent_order_cost IS 'Atualiza a data de modificação da OS pai quando um reparo é alterado';

