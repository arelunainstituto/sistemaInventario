-- =====================================================
-- Migration: campos novos em marketing_posts (blog frontend v2)
-- =====================================================
-- Adiciona 4 colunas usadas pelo blog público (institutoareluna.pt):
--   • slug                   — URL canônica (default: gerado do title)
--   • subtitle               — subtítulo italic abaixo do <h1>
--   • image_caption          — legenda centrada sob a hero
--   • image_object_position  — CSS object-position do crop (ex: "center 15%")
--
-- E faz backfill: gera slug único para todos os posts existentes.
--
-- Idempotente.
-- =====================================================

BEGIN;

-- ---------- 1) Helper: slugify português ----------
CREATE OR REPLACE FUNCTION slugify_pt(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    v TEXT;
BEGIN
    IF input IS NULL OR input = '' THEN RETURN NULL; END IF;
    -- Lowercase + remove acentos PT (cobertura comum)
    v := LOWER(input);
    v := TRANSLATE(
        v,
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
    );
    -- Troca tudo que não for [a-z0-9] por hífen
    v := REGEXP_REPLACE(v, '[^a-z0-9]+', '-', 'g');
    -- Remove hífens nas pontas
    v := REGEXP_REPLACE(v, '^-+|-+$', '', 'g');
    -- Limita a 80 chars (proteção)
    IF LENGTH(v) > 80 THEN v := LEFT(v, 80); v := REGEXP_REPLACE(v, '-+$', '', 'g'); END IF;
    RETURN NULLIF(v, '');
END;
$$;

-- ---------- 2) Novas colunas (idempotentes) ----------
ALTER TABLE marketing_posts
    ADD COLUMN IF NOT EXISTS slug                  VARCHAR(120),
    ADD COLUMN IF NOT EXISTS subtitle              TEXT,
    ADD COLUMN IF NOT EXISTS image_caption         TEXT,
    ADD COLUMN IF NOT EXISTS image_object_position VARCHAR(60);

COMMENT ON COLUMN marketing_posts.slug                  IS 'URL slug canônica para o blog público. Único quando preenchido.';
COMMENT ON COLUMN marketing_posts.subtitle              IS 'Subtítulo italic exibido abaixo do <h1> na página do post.';
COMMENT ON COLUMN marketing_posts.image_caption         IS 'Legenda centrada sob a hero image.';
COMMENT ON COLUMN marketing_posts.image_object_position IS 'CSS object-position do hero (ex: "center 15%"); fallback frontend = "center center".';

-- ---------- 3) Backfill de slug para posts existentes ----------
DO $$
DECLARE
    p RECORD;
    base_slug TEXT;
    candidate TEXT;
    suffix INT;
BEGIN
    FOR p IN SELECT id, title FROM marketing_posts WHERE slug IS NULL OR slug = '' LOOP
        base_slug := slugify_pt(COALESCE(p.title, ''));
        IF base_slug IS NULL OR base_slug = '' THEN
            base_slug := 'post-' || SUBSTRING(p.id::TEXT FROM 1 FOR 8);
        END IF;
        candidate := base_slug;
        suffix := 1;
        WHILE EXISTS (SELECT 1 FROM marketing_posts WHERE slug = candidate AND id <> p.id) LOOP
            suffix := suffix + 1;
            candidate := base_slug || '-' || suffix;
            EXIT WHEN suffix > 50; -- safety
        END LOOP;
        UPDATE marketing_posts SET slug = candidate WHERE id = p.id;
    END LOOP;
END $$;

-- ---------- 4) Índice único parcial em slug ----------
-- Único entre posts não-deletados (a tabela não tem deleted_at hoje, então
-- é único global enquanto slug for não-nulo).
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_posts_slug
    ON marketing_posts (slug)
 WHERE slug IS NOT NULL;

-- Índice auxiliar para buscas públicas por slug
CREATE INDEX IF NOT EXISTS idx_marketing_posts_slug_published
    ON marketing_posts (slug)
 WHERE status = 'published';

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- 1) Novas colunas presentes
SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns
 WHERE table_name = 'marketing_posts'
   AND column_name IN ('slug', 'subtitle', 'image_caption', 'image_object_position')
 ORDER BY column_name;

-- 2) Todos os posts existentes têm slug
SELECT COUNT(*) FILTER (WHERE slug IS NULL OR slug = '') AS sem_slug,
       COUNT(*)                                          AS total
  FROM marketing_posts;
-- Esperado: sem_slug = 0

-- 3) Sem colisões de slug
SELECT slug, COUNT(*) AS cnt
  FROM marketing_posts
 WHERE slug IS NOT NULL
 GROUP BY slug
HAVING COUNT(*) > 1;
-- Esperado: 0 linhas

-- 4) Amostra
SELECT id, title, slug, subtitle, image_caption, image_object_position
  FROM marketing_posts
 ORDER BY published_at DESC NULLS LAST
 LIMIT 5;
