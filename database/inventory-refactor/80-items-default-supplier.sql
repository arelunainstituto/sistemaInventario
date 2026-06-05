-- =====================================================
-- INVENTORY REFACTOR — 80. Fornecedor padrão no item
-- =====================================================
-- Adiciona ao cadastro do item uma FK opcional para inv_suppliers:
-- "fornecedor padrão" (a fonte habitual daquele item). Não obriga;
-- entradas continuam a registrar seu próprio supplier_id por documento.
--
-- Motivação:
--   • A planilha v1.2 do Areluna referencia o fornecedor pelo Nome
--     Fantasia, mas pode estar com erros tipográficos (INIBSA vs
--     INIBISA) ou ambíguo (AMAZON com 2 NIFs distintos).
--   • Decisão da equipe: durante o import, vincular APENAS quando o
--     Nome Fantasia tem match único na aba de fornecedores; nos demais
--     casos, deixar em branco para o usuário vincular manualmente.
--
-- Idempotente.
-- =====================================================

BEGIN;

ALTER TABLE inv_items
    ADD COLUMN IF NOT EXISTS default_supplier_id UUID REFERENCES inv_suppliers(id);

COMMENT ON COLUMN inv_items.default_supplier_id IS
    'Fornecedor habitual deste item (opcional). Usado como sugestão em entradas; cada entrada pode usar fornecedor diferente.';

CREATE INDEX IF NOT EXISTS idx_inv_items_default_supplier
    ON inv_items (default_supplier_id)
    WHERE default_supplier_id IS NOT NULL AND deleted_at IS NULL;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'inv_items'
   AND column_name = 'default_supplier_id';
