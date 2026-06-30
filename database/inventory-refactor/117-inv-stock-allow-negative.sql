-- =====================================================
-- INVENTORY REFACTOR — 117. Permitir saldo negativo em inv_stock (seeding)
-- =====================================================
-- Sintoma (produção): mesmo com o modo seeding ligado e a função fn_inv_consume
-- já corrigida (migração 113), a saída em negativo falhava com:
--
--   new row for relation "inv_stock" violates check constraint
--   "inv_stock_quantity_check"
--
-- Causa: inv_stock.quantity foi criada com CHECK (quantity >= 0)
-- (10-fase1-cadastros-entradas.sql:213). A feature de stock negativo (migração
-- 100) relaxou a regra NA FUNÇÃO (RN05, condicionada ao flag global), mas o
-- CHECK estático da TABELA nunca foi removido — então a gravação do saldo
-- negativo é barrada no nível da tabela, antes de qualquer lógica de seeding.
--
-- Correção: remover o CHECK (quantity >= 0). A regra de não-negativo passa a ser
-- garantida exclusivamente nas funções que decrementam stock, todas já
-- condicionadas ao flag/role:
--   • fn_inv_consume  → RN05 (bloqueia negativo se NOT v_allow_neg)
--   • fn_inv_adjust   → v_can_neg (Admin OU flag global)
--   • fn_inv_transfer → delega o decremento da origem ao fn_inv_consume
-- Ou seja: com o flag OFF continua impossível ficar negativo; com o flag ON
-- (seeding) passa a ser permitido, que é o comportamento desejado.
--
-- A coluna mantém NOT NULL e DEFAULT 0 — só o CHECK de não-negativo sai.
--
-- Idempotente.
-- =====================================================

BEGIN;

ALTER TABLE inv_stock DROP CONSTRAINT IF EXISTS inv_stock_quantity_check;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Não deve retornar nenhuma linha (constraint removido):
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'inv_stock'::regclass AND conname = 'inv_stock_quantity_check';
--
-- Flag de seeding (precisa estar ON para permitir o negativo):
--   SELECT fn_inv_negative_stock_allowed();
