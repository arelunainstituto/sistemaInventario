-- =====================================================
-- Migration: galeria de imagens + posts relacionados (marketing)
-- =====================================================
-- Suporta 2 features novas no editor admin de blog:
--   1. Galeria de imagens por post (uploads que serão usados em
--      <figure>...</figure> no corpo). Separar da hero image evita
--      poluir o campo image_url e permite múltiplos uploads.
--   2. Bloco "Leia também" no fim do artigo. Admin pode selecionar
--      até N posts manualmente; se vazio, o frontend público resolve
--      automaticamente para os mais recentes (excluindo o próprio).
--
-- Idempotente.
-- =====================================================

BEGIN;

-- ---------- 1) Coluna: related_post_ids (array de UUIDs) ----------
ALTER TABLE marketing_posts
    ADD COLUMN IF NOT EXISTS related_post_ids UUID[] DEFAULT '{}'::UUID[];

COMMENT ON COLUMN marketing_posts.related_post_ids IS
    'IDs de posts relacionados (bloco "Leia também"). Quando vazio/null, frontend usa os mais recentes (excluindo o próprio).';

-- ---------- 2) Tabela: galeria de imagens do post ----------
CREATE TABLE IF NOT EXISTS marketing_post_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES marketing_posts(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    alt         VARCHAR(300),
    caption     TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_post_images_post
    ON marketing_post_images (post_id, sort_order);

COMMENT ON TABLE marketing_post_images IS
    'Galeria de imagens por post (uso interno em <figure> no content). Separada do image_url do post (hero).';

-- ---------- 3) RLS ----------
ALTER TABLE marketing_post_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_images_read_public" ON marketing_post_images;
CREATE POLICY "post_images_read_public" ON marketing_post_images
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM marketing_posts p
             WHERE p.id = marketing_post_images.post_id
               AND p.status = 'published'
        )
    );

DROP POLICY IF EXISTS "post_images_write_marketing" ON marketing_post_images;
CREATE POLICY "post_images_write_marketing" ON marketing_post_images
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = auth.uid()
               AND ur.is_active = true
               AND r.name IN ('Marketing', 'Admin', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = auth.uid()
               AND ur.is_active = true
               AND r.name IN ('Marketing', 'Admin', 'admin')
        )
    );

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'marketing_posts' AND column_name = 'related_post_ids';

SELECT COUNT(*) AS images_count FROM marketing_post_images;
