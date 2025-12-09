-- =====================================================
-- CRIAR BUCKET DE ARMAZENAMENTO E POLÍTICAS DE SEGURANÇA
-- =====================================================

-- 1. Criar o bucket 'rh-documents' (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rh-documents', 'rh-documents', false, 10485760, NULL) -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar RLS na tabela de objetos (se ainda não estiver)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de Segurança (RLS)

-- Política: Gerentes de RH podem fazer upload de documentos
DROP POLICY IF EXISTS "rh_managers_upload_documents" ON storage.objects;
CREATE POLICY "rh_managers_upload_documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rh-documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('Admin', 'rh_manager')
    AND ur.is_active = true
  )
);

-- Política: Gerentes de RH podem ver/baixar todos os documentos
DROP POLICY IF EXISTS "rh_managers_read_documents" ON storage.objects;
CREATE POLICY "rh_managers_read_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rh-documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('Admin', 'rh_manager')
    AND ur.is_active = true
  )
);

-- Política: Gerentes de RH podem deletar documentos
DROP POLICY IF EXISTS "rh_managers_delete_documents" ON storage.objects;
CREATE POLICY "rh_managers_delete_documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rh-documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('Admin', 'rh_manager')
    AND ur.is_active = true
  )
);

-- Política: Funcionários podem ver APENAS seus próprios documentos
-- Assumindo estrutura de pasta: rh-documents/{employee_id}/{filename}
DROP POLICY IF EXISTS "employees_read_own_documents" ON storage.objects;
CREATE POLICY "employees_read_own_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rh-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.rh_employees 
    WHERE user_id = auth.uid()
  )
);

-- Confirmação
SELECT 'Bucket rh-documents criado e políticas configuradas com sucesso!' as status;
