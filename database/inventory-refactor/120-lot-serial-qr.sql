-- =====================================================
-- INVENTORY REFACTOR — 120. QR Code por lote e por número de série
-- =====================================================
-- O QR passa a ser por LOTE (inv_lots) e por SÉRIE (inv_serial_units), além do
-- item (fallback para consumo sem lote). Cada linha ganha um qr_code UUID que o
-- QR codifica na URL .../item-view.html?qr=<uuid> e o /scan resolve.
--
-- ⚠️ O DEFAULT gen_random_uuid() é PERMANENTE — NÃO remover. Os inserts que
-- criam lotes (trigger fn_inv_process_entry_line) e séries (api patrimony.js)
-- NÃO nomeiam qr_code; a coluna precisa se auto-preencher para sempre, senão
-- toda entrada/patrimônio futura falha o NOT NULL.
--
-- inv_lots NÃO tem deleted_at → índice único SIMPLES.
-- inv_serial_units tem deleted_at → índice único PARCIAL (WHERE deleted_at IS NULL),
-- espelhando uq_inv_serial_units_item_serial.
--
-- Idempotente (passos individualmente re-executáveis).
-- =====================================================

BEGIN;

-- ---------- inv_lots ----------
ALTER TABLE inv_lots            ADD COLUMN IF NOT EXISTS qr_code UUID;
ALTER TABLE inv_lots            ALTER COLUMN qr_code SET DEFAULT gen_random_uuid();
UPDATE inv_lots                 SET qr_code = gen_random_uuid() WHERE qr_code IS NULL;
ALTER TABLE inv_lots            ALTER COLUMN qr_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_lots_qr_code ON inv_lots (qr_code);

-- ---------- inv_serial_units ----------
ALTER TABLE inv_serial_units    ADD COLUMN IF NOT EXISTS qr_code UUID;
ALTER TABLE inv_serial_units    ALTER COLUMN qr_code SET DEFAULT gen_random_uuid();
UPDATE inv_serial_units         SET qr_code = gen_random_uuid() WHERE qr_code IS NULL;
ALTER TABLE inv_serial_units    ALTER COLUMN qr_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_serial_units_qr_code
    ON inv_serial_units (qr_code) WHERE deleted_at IS NULL;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Sem NULL e todos distintos (count = count(qr_code) = count(distinct qr_code)):
--   SELECT count(*), count(qr_code), count(DISTINCT qr_code) FROM inv_lots;
--   SELECT count(*), count(qr_code), count(DISTINCT qr_code) FROM inv_serial_units;
-- O DEFAULT deve permanecer (não deve retornar vazio):
--   SELECT column_default FROM information_schema.columns
--    WHERE table_name IN ('inv_lots','inv_serial_units') AND column_name='qr_code';
