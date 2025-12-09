-- =====================================================
-- SISTEMA DE ORDENS DE SERVIÇO - STORAGE
-- ProStoral - Laboratório Protético
-- =====================================================

-- NOTA: Buckets devem ser criados manualmente no Supabase Dashboard
-- ou via API. Este arquivo documenta as configurações necessárias.

-- =====================================================
-- BUCKET: work-orders
-- =====================================================

-- Criar bucket via Dashboard:
-- Nome: work-orders
-- Public: false
-- File size limit: 50MB
-- Allowed MIME types: image/*, application/pdf, application/msword, 
--                     application/vnd.openxmlformats-officedocument.wordprocessingml.document

-- =====================================================
-- POLÍTICAS DE STORAGE PARA work-orders
-- =====================================================

-- Política 1: Admin pode fazer tudo
-- CREATE POLICY "Admin full access to work orders storage"
-- ON storage.objects FOR ALL
-- TO authenticated
-- USING (
--     bucket_id = 'work-orders' 
--     AND EXISTS (
--         SELECT 1 FROM user_roles ur
--         JOIN roles r ON r.id = ur.role_id
--         WHERE ur.user_id = auth.uid() 
--         AND r.name IN ('admin', 'superadmin')
--         AND ur.is_active = true
--     )
-- );

-- Política 2: Técnicos podem upload em suas OS
-- CREATE POLICY "Technicians can upload to their work orders"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--     bucket_id = 'work-orders'
--     AND (storage.foldername(name))[1] IN (
--         SELECT id::text FROM prostoral_work_orders 
--         WHERE technician_id = auth.uid()
--     )
-- );

-- Política 3: Técnicos podem ver anexos de suas OS
-- CREATE POLICY "Technicians can view their work order files"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--     bucket_id = 'work-orders'
--     AND (storage.foldername(name))[1] IN (
--         SELECT id::text FROM prostoral_work_orders 
--         WHERE technician_id = auth.uid()
--     )
-- );

-- Política 4: Clientes podem ver anexos de suas OS
-- CREATE POLICY "Clients can view their work order files"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--     bucket_id = 'work-orders'
--     AND (storage.foldername(name))[1] IN (
--         SELECT wo.id::text FROM prostoral_work_orders wo
--         JOIN prostoral_clients c ON c.id = wo.client_id
--         WHERE c.created_by = auth.uid()
--     )
-- );

-- Política 5: Clientes podem upload em intercorrências visíveis
-- CREATE POLICY "Clients can upload to visible issues"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--     bucket_id = 'work-orders'
--     AND (storage.foldername(name))[2] = 'issues'
-- );

-- =====================================================
-- ESTRUTURA DE PASTAS
-- =====================================================

-- Estrutura esperada:
-- /work-orders/
--   /{work_order_id}/
--     /documents/          <- Documentos da OS
--       - spec.pdf
--       - photo1.jpg
--     /issues/             <- Anexos de intercorrências
--       /{issue_id}/
--         - problem.jpg
--         - solution.jpg

-- =====================================================
-- HELPER FUNCTION: Upload de arquivo
-- =====================================================

-- Esta function será usada pelo frontend para fazer upload
-- e automaticamente adicionar a referência no campo attachments

CREATE OR REPLACE FUNCTION add_attachment_to_work_order(
    p_work_order_id UUID,
    p_file_name TEXT,
    p_file_path TEXT,
    p_file_size INTEGER,
    p_mime_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_attachment JSONB;
BEGIN
    -- Criar objeto de anexo
    v_attachment := jsonb_build_object(
        'name', p_file_name,
        'path', p_file_path,
        'size', p_file_size,
        'type', p_mime_type,
        'uploaded_at', NOW()
    );
    
    -- Adicionar ao array de attachments
    UPDATE prostoral_work_orders
    SET attachments = attachments || v_attachment
    WHERE id = p_work_order_id;
    
    RETURN v_attachment;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTION: Upload de anexo de intercorrência
-- =====================================================

CREATE OR REPLACE FUNCTION add_attachment_to_issue(
    p_issue_id UUID,
    p_file_name TEXT,
    p_file_path TEXT,
    p_file_size INTEGER,
    p_mime_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_attachment JSONB;
BEGIN
    v_attachment := jsonb_build_object(
        'name', p_file_name,
        'path', p_file_path,
        'size', p_file_size,
        'type', p_mime_type,
        'uploaded_at', NOW()
    );
    
    UPDATE prostoral_work_order_issues
    SET attachments = attachments || v_attachment
    WHERE id = p_issue_id;
    
    RETURN v_attachment;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTION: Remover anexo
-- =====================================================

CREATE OR REPLACE FUNCTION remove_attachment_from_work_order(
    p_work_order_id UUID,
    p_file_path TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE prostoral_work_orders
    SET attachments = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(attachments) elem
        WHERE elem->>'path' != p_file_path
    )
    WHERE id = p_work_order_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_attachment_from_issue(
    p_issue_id UUID,
    p_file_path TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE prostoral_work_order_issues
    SET attachments = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(attachments) elem
        WHERE elem->>'path' != p_file_path
    )
    WHERE id = p_issue_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIM DA CONFIGURAÇÃO DE STORAGE
-- =====================================================

-- INSTRUÇÕES PARA CRIAR O BUCKET:
-- 1. Ir ao Supabase Dashboard > Storage
-- 2. Criar novo bucket: "work-orders"
-- 3. Configurar como privado (não public)
-- 4. Aplicar as políticas acima manualmente ou via SQL

