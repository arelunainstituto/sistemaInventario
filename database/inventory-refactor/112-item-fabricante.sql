-- =====================================================
-- INVENTORY REFACTOR — 112. Campo "Fabricante" em inv_items
-- =====================================================
-- Adiciona o NOME do fabricante/marca do item (ex.: Apple, Dell, HP).
-- Complementa a coluna já existente `manufacturer_ref` (que é a
-- referência/código do fabricante, não o nome). Útil especialmente para
-- itens de patrimônio.
--
-- Coluna global em inv_items, nullable. Aplicar UMA VEZ. Idempotente.
-- =====================================================

BEGIN;

ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(120);

COMMIT;

-- VERIFICAÇÃO
SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns
 WHERE table_name = 'inv_items' AND column_name = 'manufacturer';
