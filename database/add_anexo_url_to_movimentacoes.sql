-- Adicionar coluna anexo_url na tabela movimentacoeslaboratorio
ALTER TABLE public.movimentacoeslaboratorio 
ADD COLUMN IF NOT EXISTS anexo_url TEXT;

-- Comentário na coluna
COMMENT ON COLUMN public.movimentacoeslaboratorio.anexo_url IS 'URL do arquivo anexo (PDF ou Imagem) da movimentação';
