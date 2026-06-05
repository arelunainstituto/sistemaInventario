-- =====================================================
-- INVENTORY REFACTOR — 70. Cadastro de Fornecedores (campos estendidos)
-- =====================================================
-- A planilha "IAL Port v1.2" introduz uma aba dedicada de fornecedores
-- com campos fiscais e comerciais completos:
--
--   Tipo de Cadastro (Pessoa Singular / Pessoa Coletiva)
--   Nome Fantasia            → inv_suppliers.name (já existe)
--   Razão Social             → legal_name (NOVO)
--   NIF/NIPC                 → inv_suppliers.tax_id (já existe + UNIQUE)
--   Sede Social              → inv_suppliers.address (já existe)
--   CIRS / CAE               → cae_code (NOVO)
--   E-mail                   → inv_suppliers.email (já existe)
--   Telefone                 → inv_suppliers.phone (já existe)
--   Site                     → website (NOVO)
--   Vendedor (Nome)          → sales_rep_name (NOVO)
--   Vendedor (Telefone)      → sales_rep_phone (NOVO)
--   IBAN                     → iban (NOVO)
--   Regime de IVA            → vat_regime (NOVO)
--
-- A chave de deduplicação no importador é o **NIF/NIPC**. O índice
-- único `uq_inv_suppliers_tax` já garante isso a nível de banco.
-- =====================================================

BEGIN;

-- ---------- 1) Novos campos (idempotentes) ----------
ALTER TABLE inv_suppliers
    ADD COLUMN IF NOT EXISTS entity_type      VARCHAR(40),
    ADD COLUMN IF NOT EXISTS legal_name       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS cae_code         VARCHAR(255),
    ADD COLUMN IF NOT EXISTS website          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS sales_rep_name   VARCHAR(160),
    ADD COLUMN IF NOT EXISTS sales_rep_phone  VARCHAR(40),
    ADD COLUMN IF NOT EXISTS iban             VARCHAR(40),
    ADD COLUMN IF NOT EXISTS vat_regime       VARCHAR(80);

COMMENT ON COLUMN inv_suppliers.entity_type     IS 'Pessoa Singular ou Pessoa Coletiva (texto livre normalizado pelo importador)';
COMMENT ON COLUMN inv_suppliers.legal_name      IS 'Razão Social (denominação jurídica completa)';
COMMENT ON COLUMN inv_suppliers.cae_code        IS 'CIRS (Pessoa Singular) ou CAE (Pessoa Coletiva)';
COMMENT ON COLUMN inv_suppliers.iban            IS 'IBAN para pagamentos (não validado pelo schema)';
COMMENT ON COLUMN inv_suppliers.vat_regime      IS 'Regime de IVA (Normal, Isento, etc.)';

-- ---------- 2) Índices úteis ----------
CREATE INDEX IF NOT EXISTS idx_inv_suppliers_legal_name
    ON inv_suppliers (legal_name)
    WHERE deleted_at IS NULL AND legal_name IS NOT NULL;

-- O índice único uq_inv_suppliers_tax já existe (10-fase1, linha 106).
-- Mantém: UNIQUE (tax_id) WHERE tax_id IS NOT NULL AND deleted_at IS NULL.
-- Isso garante que o NIF/NIPC é a chave de dedup correta a nível de DB.

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- 1) Colunas presentes em inv_suppliers
SELECT column_name, data_type, character_maximum_length, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'inv_suppliers'
 ORDER BY ordinal_position;

-- 2) Índice único de NIF/NIPC ativo
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE tablename = 'inv_suppliers'
   AND indexname IN ('uq_inv_suppliers_tax', 'idx_inv_suppliers_legal_name', 'idx_inv_suppliers_name');
