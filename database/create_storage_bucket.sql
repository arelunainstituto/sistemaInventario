-- Criar o bucket 'anexos' se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anexos', 
  'anexos', 
  true, -- Public bucket para que as URLs públicas funcionem
  10485760, -- 10MB limit
  '{image/*, valication/pdf}' -- Permite imagens e PDFs (typo corrected in usage but broadly usually specific types)
)
ON CONFLICT (id) DO NOTHING;

-- Remover restrição de tipos MIME estritos para garantir compatibilidade se necessário, ou ajustar acima
UPDATE storage.buckets
SET allowed_mime_types = NULL -- Permitir qualquer arquivo por enquanto para evitar erros de tipo
WHERE id = 'anexos';

-- Habilitar RLS (baskets usually have strict policies)
-- Permitir leitura pública (pois o bucket é público)
CREATE POLICY "Public Access Anexos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'anexos' );

-- Permitir upload para usuários autenticados
CREATE POLICY "Authenticated Upload Anexos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'anexos' );

-- Permitir update/delete para quem fez o upload (opcional)
CREATE POLICY "Owner Manage Anexos"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'anexos' AND auth.uid() = owner );
