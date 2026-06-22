-- =====================================================
-- INVENTORY REFACTOR — 115. Fabricantes (entidade própria)
-- =====================================================
-- O campo "Fabricante" do item era texto livre (inv_items.manufacturer,
-- migração 112). Passa a ser uma ENTIDADE com cadastro próprio (semelhante a
-- fornecedores): tabela inv_manufacturers + FK inv_items.manufacturer_id.
--
-- Esta migração:
--   1) cria inv_manufacturers (com trigger de updated_at e RLS permissiva);
--   2) adiciona inv_items.manufacturer_id (FK);
--   3) MIGRA os textos livres existentes para a tabela e linka os itens
--      (1 fabricante por nome distinto, case-insensitive);
--   4) REMOVE a coluna de texto inv_items.manufacturer (dados já migrados;
--      só o cadastro/ficha usavam — ver item-form/item-view).
--
-- NÃO confundir com inv_items.manufacturer_ref (referência/código do
-- fabricante), que permanece como texto.
--
-- Idempotente.
-- =====================================================

BEGIN;

-- ---------- 1) Tabela ----------
CREATE TABLE IF NOT EXISTS inv_manufacturers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(160) NOT NULL,
    website     VARCHAR(200),
    notes       TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_manufacturers_name ON inv_manufacturers (name) WHERE deleted_at IS NULL;
-- Nome único (case-insensitive) entre os não-apagados.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_manufacturers_name
    ON inv_manufacturers (lower(btrim(name))) WHERE deleted_at IS NULL;

-- updated_at automático (reutiliza a função genérica da fase 1).
DROP TRIGGER IF EXISTS tg_inv_manufacturers_updated_at ON inv_manufacturers;
CREATE TRIGGER tg_inv_manufacturers_updated_at BEFORE UPDATE ON inv_manufacturers
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

-- RLS permissiva (segurança real é na API via requirePermission; service role bypassa).
ALTER TABLE inv_manufacturers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_manufacturers_auth_select" ON inv_manufacturers;
CREATE POLICY "inv_manufacturers_auth_select" ON inv_manufacturers
    FOR SELECT TO authenticated USING (true);

-- ---------- 2) FK no item ----------
ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS manufacturer_id UUID REFERENCES inv_manufacturers(id);
CREATE INDEX IF NOT EXISTS idx_inv_items_manufacturer_id
    ON inv_items (manufacturer_id) WHERE manufacturer_id IS NOT NULL;

-- ---------- 3) Migra os textos livres existentes ----------
-- Cria um fabricante por nome distinto (case-insensitive) que ainda não exista.
INSERT INTO inv_manufacturers (name)
SELECT DISTINCT ON (lower(btrim(manufacturer))) btrim(manufacturer)
  FROM inv_items
 WHERE manufacturer IS NOT NULL AND btrim(manufacturer) <> ''
   AND NOT EXISTS (
       SELECT 1 FROM inv_manufacturers m
        WHERE lower(m.name) = lower(btrim(inv_items.manufacturer))
          AND m.deleted_at IS NULL
   )
 ORDER BY lower(btrim(manufacturer)), btrim(manufacturer);

-- Linka cada item ao fabricante correspondente.
UPDATE inv_items i
   SET manufacturer_id = m.id
  FROM inv_manufacturers m
 WHERE i.manufacturer_id IS NULL
   AND i.manufacturer IS NOT NULL AND btrim(i.manufacturer) <> ''
   AND lower(m.name) = lower(btrim(i.manufacturer))
   AND m.deleted_at IS NULL;

-- ---------- 4) Remove a coluna de texto (dados já migrados) ----------
ALTER TABLE inv_items DROP COLUMN IF EXISTS manufacturer;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- SELECT count(*) AS fabricantes        FROM inv_manufacturers;
-- SELECT count(*) AS itens_com_fabricante FROM inv_items WHERE manufacturer_id IS NOT NULL;
-- A coluna de texto não deve mais existir (0 linhas):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='inv_items' AND column_name='manufacturer';
