-- =====================================================
-- SISTEMA DE HISTÓRICO DE ALTERAÇÕES
-- Ordens de Serviço - ProStoral
-- =====================================================

-- =====================================================
-- 1. EXPANDIR TABELA DE HISTÓRICO
-- =====================================================

-- Adicionar novos campos para registrar mais tipos de alterações
ALTER TABLE prostoral_work_order_status_history
ADD COLUMN IF NOT EXISTS change_type VARCHAR(100) DEFAULT 'status_change' 
    CHECK (change_type IN (
        'status_change', 
        'material_added', 
        'material_removed', 
        'time_tracking_started',
        'time_tracking_paused',
        'time_tracking_resumed',
        'time_tracking_finished',
        'issue_created',
        'issue_updated',
        'order_updated',
        'client_confirmed'
    )),
ADD COLUMN IF NOT EXISTS field_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS old_value TEXT,
ADD COLUMN IF NOT EXISTS new_value TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Comentários
COMMENT ON COLUMN prostoral_work_order_status_history.change_type IS 'Tipo de alteração registrada';
COMMENT ON COLUMN prostoral_work_order_status_history.field_name IS 'Nome do campo alterado (para alterações gerais)';
COMMENT ON COLUMN prostoral_work_order_status_history.old_value IS 'Valor antigo';
COMMENT ON COLUMN prostoral_work_order_status_history.new_value IS 'Novo valor';
COMMENT ON COLUMN prostoral_work_order_status_history.description IS 'Descrição legível da alteração';

-- =====================================================
-- 2. FUNÇÃO PARA REGISTRAR HISTÓRICO DE STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION log_work_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Somente registrar se o status mudou
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO prostoral_work_order_status_history (
            work_order_id,
            old_status,
            new_status,
            change_type,
            description,
            changed_by,
            changed_at,
            metadata
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            'status_change',
            format('Status alterado de "%s" para "%s"', OLD.status, NEW.status),
            auth.uid(),
            NOW(),
            jsonb_build_object(
                'previous_status', OLD.status,
                'new_status', NEW.status,
                'updated_by', auth.uid()
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. FUNÇÃO PARA REGISTRAR ALTERAÇÕES GERAIS
-- =====================================================

CREATE OR REPLACE FUNCTION log_work_order_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_changes TEXT[];
    v_field VARCHAR(100);
    v_old_value TEXT;
    v_new_value TEXT;
BEGIN
    -- Verificar mudanças nos campos principais
    
    -- Cliente
    IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
        INSERT INTO prostoral_work_order_status_history (
            work_order_id,
            change_type,
            field_name,
            old_value,
            new_value,
            description,
            changed_by,
            changed_at
        ) VALUES (
            NEW.id,
            'order_updated',
            'client_id',
            OLD.client_id::TEXT,
            NEW.client_id::TEXT,
            'Cliente alterado',
            auth.uid(),
            NOW()
        );
    END IF;
    
    -- Nome do paciente
    IF OLD.patient_name IS DISTINCT FROM NEW.patient_name THEN
        INSERT INTO prostoral_work_order_status_history (
            work_order_id,
            change_type,
            field_name,
            old_value,
            new_value,
            description,
            changed_by,
            changed_at
        ) VALUES (
            NEW.id,
            'order_updated',
            'patient_name',
            OLD.patient_name,
            NEW.patient_name,
            format('Nome do paciente alterado de "%s" para "%s"', OLD.patient_name, NEW.patient_name),
            auth.uid(),
            NOW()
        );
    END IF;
    
    -- Descrição do trabalho
    IF OLD.work_description IS DISTINCT FROM NEW.work_description THEN
        INSERT INTO prostoral_work_order_status_history (
            work_order_id,
            change_type,
            field_name,
            old_value,
            new_value,
            description,
            changed_by,
            changed_at
        ) VALUES (
            NEW.id,
            'order_updated',
            'work_description',
            OLD.work_description,
            NEW.work_description,
            'Descrição do trabalho alterada',
            auth.uid(),
            NOW()
        );
    END IF;
    
    -- Data de entrega
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
        INSERT INTO prostoral_work_order_status_history (
            work_order_id,
            change_type,
            field_name,
            old_value,
            new_value,
            description,
            changed_by,
            changed_at
        ) VALUES (
            NEW.id,
            'order_updated',
            'due_date',
            OLD.due_date::TEXT,
            NEW.due_date::TEXT,
            format('Data de entrega alterada de %s para %s', 
                COALESCE(OLD.due_date::TEXT, 'não definida'), 
                COALESCE(NEW.due_date::TEXT, 'não definida')
            ),
            auth.uid(),
            NOW()
        );
    END IF;
    
    -- Preço final
    IF OLD.final_price IS DISTINCT FROM NEW.final_price THEN
        INSERT INTO prostoral_work_order_status_history (
            work_order_id,
            change_type,
            field_name,
            old_value,
            new_value,
            description,
            changed_by,
            changed_at
        ) VALUES (
            NEW.id,
            'order_updated',
            'final_price',
            OLD.final_price::TEXT,
            NEW.final_price::TEXT,
            format('Preço final alterado de %s€ para %s€', 
                COALESCE(OLD.final_price::TEXT, '0'), 
                COALESCE(NEW.final_price::TEXT, '0')
            ),
            auth.uid(),
            NOW()
        );
    END IF;
    
    -- Técnico atribuído
    IF OLD.technician_id IS DISTINCT FROM NEW.technician_id THEN
        INSERT INTO prostoral_work_order_status_history (
            work_order_id,
            change_type,
            field_name,
            old_value,
            new_value,
            description,
            changed_by,
            changed_at
        ) VALUES (
            NEW.id,
            'order_updated',
            'technician_id',
            OLD.technician_id::TEXT,
            NEW.technician_id::TEXT,
            'Técnico atribuído alterado',
            auth.uid(),
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. FUNÇÃO PARA REGISTRAR ADIÇÃO DE MATERIAL
-- =====================================================

CREATE OR REPLACE FUNCTION log_material_added()
RETURNS TRIGGER AS $$
DECLARE
    v_item_name TEXT;
    v_kit_name TEXT;
BEGIN
    -- Buscar nome do item
    SELECT name INTO v_item_name
    FROM prostoral_inventory
    WHERE id = NEW.inventory_item_id;
    
    -- Buscar nome do kit (se aplicável)
    IF NEW.from_kit_id IS NOT NULL THEN
        SELECT nome INTO v_kit_name
        FROM kits
        WHERE id = NEW.from_kit_id;
    END IF;
    
    INSERT INTO prostoral_work_order_status_history (
        work_order_id,
        change_type,
        description,
        changed_by,
        changed_at,
        metadata
    ) VALUES (
        NEW.work_order_id,
        'material_added',
        format('Material adicionado: %s (Qtd: %s %s) - Custo: %s€%s',
            v_item_name,
            NEW.used_quantity,
            COALESCE(NEW.unit, 'un'),
            COALESCE(NEW.unit_cost::TEXT, '0'),
            CASE WHEN v_kit_name IS NOT NULL THEN format(' [do kit: %s]', v_kit_name) ELSE '' END
        ),
        NEW.added_by,
        NOW(),
        jsonb_build_object(
            'material_id', NEW.id,
            'inventory_item_id', NEW.inventory_item_id,
            'item_name', v_item_name,
            'quantity', NEW.used_quantity,
            'unit', NEW.unit,
            'unit_cost', NEW.unit_cost,
            'total_cost', NEW.total_cost,
            'from_kit_id', NEW.from_kit_id,
            'kit_name', v_kit_name
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. FUNÇÃO PARA REGISTRAR REMOÇÃO DE MATERIAL
-- =====================================================

CREATE OR REPLACE FUNCTION log_material_removed()
RETURNS TRIGGER AS $$
DECLARE
    v_item_name TEXT;
BEGIN
    -- Buscar nome do item
    SELECT name INTO v_item_name
    FROM prostoral_inventory
    WHERE id = OLD.inventory_item_id;
    
    INSERT INTO prostoral_work_order_status_history (
        work_order_id,
        change_type,
        description,
        changed_by,
        changed_at,
        metadata
    ) VALUES (
        OLD.work_order_id,
        'material_removed',
        format('Material removido: %s (Qtd: %s %s) - Custo: %s€',
            v_item_name,
            OLD.used_quantity,
            COALESCE(OLD.unit, 'un'),
            COALESCE(OLD.unit_cost::TEXT, '0')
        ),
        auth.uid(),
        NOW(),
        jsonb_build_object(
            'material_id', OLD.id,
            'inventory_item_id', OLD.inventory_item_id,
            'item_name', v_item_name,
            'quantity', OLD.used_quantity,
            'unit', OLD.unit,
            'unit_cost', OLD.unit_cost,
            'total_cost', OLD.total_cost
        )
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. FUNÇÃO PARA REGISTRAR TIME TRACKING
-- =====================================================

CREATE OR REPLACE FUNCTION log_time_tracking_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_description TEXT;
    v_change_type VARCHAR(100);
BEGIN
    -- Determinar o tipo de mudança
    IF TG_OP = 'INSERT' THEN
        v_change_type := 'time_tracking_started';
        v_description := format('Trabalho iniciado - Etapa: %s', NEW.stage);
    ELSIF OLD.status = 'in_progress' AND NEW.status = 'paused' THEN
        v_change_type := 'time_tracking_paused';
        v_description := format('Trabalho pausado - Etapa: %s', NEW.stage);
    ELSIF OLD.status = 'paused' AND NEW.status = 'in_progress' THEN
        v_change_type := 'time_tracking_resumed';
        v_description := format('Trabalho retomado - Etapa: %s', NEW.stage);
    ELSIF NEW.status = 'completed' THEN
        v_change_type := 'time_tracking_finished';
        v_description := format('Trabalho finalizado - Etapa: %s (Duração: %s min, Custo: %s€)',
            NEW.stage,
            COALESCE(NEW.duration_minutes::TEXT, '0'),
            COALESCE(NEW.labor_cost::TEXT, '0')
        );
    ELSE
        RETURN NEW;
    END IF;
    
    INSERT INTO prostoral_work_order_status_history (
        work_order_id,
        change_type,
        description,
        changed_by,
        changed_at,
        metadata
    ) VALUES (
        NEW.work_order_id,
        v_change_type,
        v_description,
        NEW.technician_id,
        NOW(),
        jsonb_build_object(
            'tracking_id', NEW.id,
            'stage', NEW.stage,
            'status', NEW.status,
            'started_at', NEW.started_at,
            'finished_at', NEW.finished_at,
            'duration_minutes', NEW.duration_minutes,
            'hourly_rate', NEW.hourly_rate,
            'labor_cost', NEW.labor_cost
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. FUNÇÃO PARA REGISTRAR INTERCORRÊNCIAS
-- =====================================================

CREATE OR REPLACE FUNCTION log_issue_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_description TEXT;
    v_change_type VARCHAR(100);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_change_type := 'issue_created';
        v_description := format('Intercorrência reportada: %s [%s]', NEW.title, NEW.severity);
    ELSE
        v_change_type := 'issue_updated';
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_description := format('Status da intercorrência "%s" alterado de %s para %s',
                NEW.title, OLD.status, NEW.status);
        ELSIF OLD.response IS NULL AND NEW.response IS NOT NULL THEN
            v_description := format('Resposta adicionada à intercorrência: %s', NEW.title);
        ELSE
            v_description := format('Intercorrência atualizada: %s', NEW.title);
        END IF;
    END IF;
    
    INSERT INTO prostoral_work_order_status_history (
        work_order_id,
        change_type,
        description,
        changed_by,
        changed_at,
        metadata
    ) VALUES (
        NEW.work_order_id,
        v_change_type,
        v_description,
        COALESCE(NEW.responded_by, NEW.reported_by),
        NOW(),
        jsonb_build_object(
            'issue_id', NEW.id,
            'type', NEW.type,
            'severity', NEW.severity,
            'title', NEW.title,
            'status', NEW.status,
            'visible_to_client', NEW.visible_to_client
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. CRIAR TRIGGERS
-- =====================================================

-- Trigger para mudança de status
DROP TRIGGER IF EXISTS trigger_log_status_change ON prostoral_work_orders;
CREATE TRIGGER trigger_log_status_change
    AFTER UPDATE ON prostoral_work_orders
    FOR EACH ROW
    EXECUTE FUNCTION log_work_order_status_change();

-- Trigger para alterações gerais
DROP TRIGGER IF EXISTS trigger_log_order_changes ON prostoral_work_orders;
CREATE TRIGGER trigger_log_order_changes
    AFTER UPDATE ON prostoral_work_orders
    FOR EACH ROW
    EXECUTE FUNCTION log_work_order_changes();

-- Trigger para adição de material
DROP TRIGGER IF EXISTS trigger_log_material_added ON prostoral_work_order_materials;
CREATE TRIGGER trigger_log_material_added
    AFTER INSERT ON prostoral_work_order_materials
    FOR EACH ROW
    EXECUTE FUNCTION log_material_added();

-- Trigger para remoção de material
DROP TRIGGER IF EXISTS trigger_log_material_removed ON prostoral_work_order_materials;
CREATE TRIGGER trigger_log_material_removed
    AFTER DELETE ON prostoral_work_order_materials
    FOR EACH ROW
    EXECUTE FUNCTION log_material_removed();

-- Trigger para time tracking
DROP TRIGGER IF EXISTS trigger_log_time_tracking ON prostoral_work_order_time_tracking;
CREATE TRIGGER trigger_log_time_tracking
    AFTER INSERT OR UPDATE ON prostoral_work_order_time_tracking
    FOR EACH ROW
    EXECUTE FUNCTION log_time_tracking_changes();

-- Trigger para intercorrências
DROP TRIGGER IF EXISTS trigger_log_issues ON prostoral_work_order_issues;
CREATE TRIGGER trigger_log_issues
    AFTER INSERT OR UPDATE ON prostoral_work_order_issues
    FOR EACH ROW
    EXECUTE FUNCTION log_issue_changes();

-- =====================================================
-- 9. FUNÇÃO PARA REGISTRAR CRIAÇÃO DE ORDEM
-- =====================================================

CREATE OR REPLACE FUNCTION log_work_order_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO prostoral_work_order_status_history (
        work_order_id,
        change_type,
        new_status,
        description,
        changed_by,
        changed_at,
        metadata
    ) VALUES (
        NEW.id,
        'status_change',
        NEW.status,
        format('Ordem de serviço criada - Status inicial: %s', NEW.status),
        NEW.created_by,
        NOW(),
        jsonb_build_object(
            'order_number', NEW.order_number,
            'client_id', NEW.client_id,
            'patient_name', NEW.patient_name,
            'initial_status', NEW.status
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criação de ordem
DROP TRIGGER IF EXISTS trigger_log_order_creation ON prostoral_work_orders;
CREATE TRIGGER trigger_log_order_creation
    AFTER INSERT ON prostoral_work_orders
    FOR EACH ROW
    EXECUTE FUNCTION log_work_order_creation();

-- =====================================================
-- 10. VIEW PARA HISTÓRICO FORMATADO
-- =====================================================

CREATE OR REPLACE VIEW v_work_order_history AS
SELECT 
    h.id,
    h.work_order_id,
    wo.order_number,
    h.change_type,
    h.old_status,
    h.new_status,
    h.field_name,
    h.old_value,
    h.new_value,
    h.description,
    h.changed_at,
    h.changed_by,
    u.email as changed_by_email,
    h.notes,
    h.metadata,
    -- Formatação para exibição
    CASE h.change_type
        WHEN 'status_change' THEN '🔄 Alteração de Status'
        WHEN 'material_added' THEN '➕ Material Adicionado'
        WHEN 'material_removed' THEN '➖ Material Removido'
        WHEN 'time_tracking_started' THEN '▶️ Trabalho Iniciado'
        WHEN 'time_tracking_paused' THEN '⏸️ Trabalho Pausado'
        WHEN 'time_tracking_resumed' THEN '▶️ Trabalho Retomado'
        WHEN 'time_tracking_finished' THEN '✅ Trabalho Finalizado'
        WHEN 'issue_created' THEN '⚠️ Intercorrência Criada'
        WHEN 'issue_updated' THEN '📝 Intercorrência Atualizada'
        WHEN 'order_updated' THEN '✏️ Ordem Atualizada'
        WHEN 'client_confirmed' THEN '✔️ Confirmado pelo Cliente'
        ELSE '📋 Alteração'
    END as change_type_label
FROM prostoral_work_order_status_history h
LEFT JOIN prostoral_work_orders wo ON wo.id = h.work_order_id
LEFT JOIN auth.users u ON u.id = h.changed_by
ORDER BY h.changed_at DESC;

-- Comentários
COMMENT ON VIEW v_work_order_history IS 'View formatada do histórico de alterações das ordens de serviço';

-- =====================================================
-- FIM - SISTEMA DE HISTÓRICO
-- =====================================================

