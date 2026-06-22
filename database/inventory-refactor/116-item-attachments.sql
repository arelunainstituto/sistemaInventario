-- =====================================================
-- INVENTORY REFACTOR — 116. Anexos (fotos) por item de patrimônio
-- =====================================================
-- Itens de patrimônio passam a ter até 6 anexos (fotos do bem/modelo). Anexos
-- de documentos de ENTRADA (nota fiscal etc.) ficam para um fluxo futuro, na
-- própria entrada — não fazem parte desta migração.
--
-- Esta migração:
--   1) cria inv_item_attachments (FK p/ inv_items, CASCADE);
--   2) cria o bucket público "item-attachments" no Storage;
--   3) trigger que limita a 6 anexos por item (backstop do limite da API).
--
-- A coluna mime_type guarda o tipo; a API restringe a imagens por enquanto,
-- mas o schema é genérico para permitir outros tipos no futuro sem migração.
--
-- Idempotente.
-- =====================================================

BEGIN;

-- ---------- 1) Tabela ----------
CREATE TABLE IF NOT EXISTS inv_item_attachments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id      UUID NOT NULL REFERENCES inv_items(id) ON DELETE CASCADE,
    file_url     TEXT NOT NULL,
    storage_path TEXT NOT NULL,        -- caminho no bucket, p/ apagar o objeto
    file_name    VARCHAR(255),
    mime_type    VARCHAR(120),
    size_bytes   BIGINT,
    uploaded_by  UUID REFERENCES auth.users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_item_attachments_item ON inv_item_attachments (item_id);

ALTER TABLE inv_item_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_item_attachments_auth_select" ON inv_item_attachments;
CREATE POLICY "inv_item_attachments_auth_select" ON inv_item_attachments
    FOR SELECT TO authenticated USING (true);

-- ---------- 2) Bucket de Storage (público, igual aos demais arquivos de item) ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-attachments', 'item-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- ---------- 3) Limite de 6 anexos por item (backstop do check da API) ----------
CREATE OR REPLACE FUNCTION fn_inv_item_attachments_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT count(*) FROM inv_item_attachments WHERE item_id = NEW.item_id) >= 6 THEN
        RAISE EXCEPTION 'Limite de 6 anexos por item atingido' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_inv_item_attachments_limit ON inv_item_attachments;
CREATE TRIGGER tg_inv_item_attachments_limit BEFORE INSERT ON inv_item_attachments
    FOR EACH ROW EXECUTE FUNCTION fn_inv_item_attachments_limit();

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- SELECT id, name, public FROM storage.buckets WHERE id = 'item-attachments';
-- \d inv_item_attachments
