-- 1. Adicionar coluna avatar_url na tabela rh_employees
ALTER TABLE rh_employees
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN rh_employees.avatar_url IS 'URL da foto de perfil do funcionário';

-- 2. Criar bucket de storage para fotos de funcionários (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Configurar políticas de segurança para o bucket (Storage Policies)

-- Permitir acesso público para leitura (necessário para exibir no frontend)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'employee-photos' );

-- Permitir upload apenas para usuários autenticados (RH)
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'employee-photos' );

-- Permitir atualização apenas para usuários autenticados
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'employee-photos' );

-- Permitir deleção apenas para usuários autenticados
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'employee-photos' );
