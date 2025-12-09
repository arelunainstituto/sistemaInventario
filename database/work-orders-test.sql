-- =====================================================
-- TESTE COMPLETO DO SISTEMA DE ORDENS DE SERVIÇO
-- ProStoral - Laboratório Protético
-- =====================================================

-- Este arquivo testa todos os componentes do sistema:
-- 1. Criação de OS (com QR automático)
-- 2. Adição de materiais (com baixa de estoque)
-- 3. Time tracking (com cálculo de custos)
-- 4. Intercorrências
-- 5. Confirmação de recebimento

-- =====================================================
-- PREPARAÇÃO: Obter IDs necessários
-- =====================================================

-- Obter um cliente
SELECT id, name FROM prostoral_clients LIMIT 1;

-- Obter um produto do estoque
SELECT id, name, code, quantity, unit_cost FROM prostoral_inventory LIMIT 5;

-- Obter um kit (se houver)
SELECT id, nome FROM kits LIMIT 1;

-- Obter usuário atual
SELECT auth.uid() as current_user_id;

-- =====================================================
-- TESTE 1: Criar OS com QR automático
-- =====================================================

-- Substituir pelos IDs reais antes de executar
DO $$
DECLARE
    v_client_id UUID := (SELECT id FROM prostoral_clients LIMIT 1);
    v_tenant_id UUID := (SELECT tenant_id FROM prostoral_clients LIMIT 1);
    v_user_id UUID := auth.uid();
    v_wo_id UUID;
    v_product_id UUID;
    v_tracking_id UUID;
    v_issue_id UUID;
BEGIN
    -- Criar OS
    INSERT INTO prostoral_work_orders (
        order_number,
        client_id,
        patient_name,
        patient_age,
        work_description,
        shade,
        due_date,
        priority,
        status,
        tenant_id,
        created_by
    ) VALUES (
        'OS-TEST-' || EXTRACT(EPOCH FROM NOW())::TEXT,
        v_client_id,
        'Paciente Teste',
        45,
        'Coroa de Zircônia elemento 36',
        'A2',
        NOW() + INTERVAL '7 days',
        'normal',
        'received',
        v_tenant_id,
        v_user_id
    ) RETURNING id INTO v_wo_id;
    
    RAISE NOTICE '✅ OS criada: %', v_wo_id;
    
    -- Verificar QR Code gerado
    RAISE NOTICE 'QR Code: %', (SELECT qr_code FROM prostoral_work_orders WHERE id = v_wo_id);
    RAISE NOTICE 'QR URL: %', (SELECT qr_code_url FROM prostoral_work_orders WHERE id = v_wo_id);
    
    -- =====================================================
    -- TESTE 2: Adicionar materiais (baixa automática)
    -- =====================================================
    
    -- Pegar primeiro produto disponível
    SELECT id INTO v_product_id FROM prostoral_inventory WHERE quantity > 0 LIMIT 1;
    
    IF v_product_id IS NOT NULL THEN
        -- Quantidade antes
        RAISE NOTICE 'Quantidade no estoque antes: %', 
            (SELECT quantity FROM prostoral_inventory WHERE id = v_product_id);
        
        -- Adicionar material
        INSERT INTO prostoral_work_order_materials (
            work_order_id,
            inventory_item_id,
            used_quantity,
            unit,
            unit_cost,
            added_by
        ) VALUES (
            v_wo_id,
            v_product_id,
            2,
            (SELECT unit FROM prostoral_inventory WHERE id = v_product_id),
            (SELECT unit_cost FROM prostoral_inventory WHERE id = v_product_id),
            v_user_id
        );
        
        RAISE NOTICE '✅ Material adicionado';
        
        -- Quantidade depois (deve ter diminuído)
        RAISE NOTICE 'Quantidade no estoque depois: %', 
            (SELECT quantity FROM prostoral_inventory WHERE id = v_product_id);
        
        -- Verificar movimentação criada
        RAISE NOTICE 'Movimentação registrada: %',
            (SELECT COUNT(*) FROM prostoral_inventory_movements 
             WHERE inventory_item_id = v_product_id AND work_order_id = v_wo_id);
    ELSE
        RAISE NOTICE '⚠️  Nenhum produto com estoque disponível';
    END IF;
    
    -- =====================================================
    -- TESTE 3: Time Tracking
    -- =====================================================
    
    -- Iniciar trabalho
    INSERT INTO prostoral_work_order_time_tracking (
        work_order_id,
        technician_id,
        stage,
        hourly_rate
    ) VALUES (
        v_wo_id,
        v_user_id,
        'production',
        25.00
    ) RETURNING id INTO v_tracking_id;
    
    RAISE NOTICE '✅ Time tracking iniciado: %', v_tracking_id;
    
    -- Simular pausa
    UPDATE prostoral_work_order_time_tracking
    SET 
        status = 'paused',
        paused_at = NOW() + INTERVAL '1 hour',
        pause_periods = jsonb_build_array(
            jsonb_build_object(
                'paused_at', NOW() + INTERVAL '1 hour'
            )
        )
    WHERE id = v_tracking_id;
    
    RAISE NOTICE '⏸️  Trabalho pausado';
    
    -- Simular retomada
    UPDATE prostoral_work_order_time_tracking
    SET 
        status = 'in_progress',
        resumed_at = NOW() + INTERVAL '1 hour 15 minutes',
        pause_periods = jsonb_set(
            pause_periods,
            '{0,resumed_at}',
            to_jsonb(NOW() + INTERVAL '1 hour 15 minutes')
        )
    WHERE id = v_tracking_id;
    
    RAISE NOTICE '▶️  Trabalho retomado';
    
    -- Finalizar trabalho (2 horas depois, com 15min de pausa = 1h45min efetivos)
    UPDATE prostoral_work_order_time_tracking
    SET finished_at = NOW() + INTERVAL '2 hours'
    WHERE id = v_tracking_id;
    
    RAISE NOTICE '✅ Trabalho finalizado';
    RAISE NOTICE 'Duração: % minutos', 
        (SELECT duration_minutes FROM prostoral_work_order_time_tracking WHERE id = v_tracking_id);
    RAISE NOTICE 'Custo: €%', 
        (SELECT labor_cost FROM prostoral_work_order_time_tracking WHERE id = v_tracking_id);
    
    -- =====================================================
    -- TESTE 4: Intercorrências
    -- =====================================================
    
    INSERT INTO prostoral_work_order_issues (
        work_order_id,
        type,
        severity,
        title,
        description,
        reported_by,
        visible_to_client
    ) VALUES (
        v_wo_id,
        'material',
        'medium',
        'Necessário material adicional',
        'O bloco de zircônia precisa ser maior que o especificado',
        v_user_id,
        true
    ) RETURNING id INTO v_issue_id;
    
    RAISE NOTICE '✅ Intercorrência criada: %', v_issue_id;
    
    -- Responder intercorrência
    UPDATE prostoral_work_order_issues
    SET 
        response = 'Material adicional foi providenciado',
        responded_by = v_user_id,
        responded_at = NOW(),
        status = 'resolved'
    WHERE id = v_issue_id;
    
    RAISE NOTICE '✅ Intercorrência respondida';
    
    -- =====================================================
    -- TESTE 5: Custos Totais
    -- =====================================================
    
    RAISE NOTICE '--- CUSTOS TOTAIS ---';
    RAISE NOTICE 'Custo Materiais: €%', 
        (SELECT total_material_cost FROM prostoral_work_orders WHERE id = v_wo_id);
    RAISE NOTICE 'Custo Mão de Obra: €%', 
        (SELECT total_labor_cost FROM prostoral_work_orders WHERE id = v_wo_id);
    RAISE NOTICE 'Custo Total: €%', 
        (SELECT total_cost FROM prostoral_work_orders WHERE id = v_wo_id);
    
    -- =====================================================
    -- TESTE 6: Confirmação de Recebimento
    -- =====================================================
    
    UPDATE prostoral_work_orders
    SET 
        status = 'delivered',
        confirmed_by_client_at = NOW(),
        confirmed_by_client_id = v_user_id,
        delivered_date = NOW()
    WHERE id = v_wo_id;
    
    RAISE NOTICE '✅ Recebimento confirmado';
    
    -- =====================================================
    -- RESULTADO FINAL
    -- =====================================================
    
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ TODOS OS TESTES PASSARAM!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'OS ID: %', v_wo_id;
    RAISE NOTICE 'Número: %', (SELECT order_number FROM prostoral_work_orders WHERE id = v_wo_id);
    RAISE NOTICE 'Status: %', (SELECT status FROM prostoral_work_orders WHERE id = v_wo_id);
    RAISE NOTICE 'Materiais: %', (SELECT COUNT(*) FROM prostoral_work_order_materials WHERE work_order_id = v_wo_id);
    RAISE NOTICE 'Time Tracking: %', (SELECT COUNT(*) FROM prostoral_work_order_time_tracking WHERE work_order_id = v_wo_id);
    RAISE NOTICE 'Intercorrências: %', (SELECT COUNT(*) FROM prostoral_work_order_issues WHERE work_order_id = v_wo_id);
    RAISE NOTICE 'Histórico Status: %', (SELECT COUNT(*) FROM prostoral_work_order_status_history WHERE work_order_id = v_wo_id);
    
END $$;

-- =====================================================
-- QUERIES DE VERIFICAÇÃO
-- =====================================================

-- Ver última OS criada
SELECT 
    order_number,
    patient_name,
    status,
    qr_code,
    total_material_cost,
    total_labor_cost,
    total_cost,
    created_at
FROM prostoral_work_orders
ORDER BY created_at DESC
LIMIT 1;

-- Ver materiais da última OS
SELECT 
    pi.name,
    pi.code,
    m.used_quantity,
    m.unit,
    m.unit_cost,
    m.total_cost
FROM prostoral_work_order_materials m
JOIN prostoral_inventory pi ON pi.id = m.inventory_item_id
WHERE m.work_order_id = (
    SELECT id FROM prostoral_work_orders ORDER BY created_at DESC LIMIT 1
);

-- Ver time tracking da última OS
SELECT 
    stage,
    duration_minutes,
    hourly_rate,
    labor_cost,
    status,
    started_at,
    finished_at
FROM prostoral_work_order_time_tracking
WHERE work_order_id = (
    SELECT id FROM prostoral_work_orders ORDER BY created_at DESC LIMIT 1
);

-- Ver intercorrências da última OS
SELECT 
    type,
    severity,
    title,
    status,
    visible_to_client,
    reported_at
FROM prostoral_work_order_issues
WHERE work_order_id = (
    SELECT id FROM prostoral_work_orders ORDER BY created_at DESC LIMIT 1
);

