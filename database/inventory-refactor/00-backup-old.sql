-- =====================================================
-- INVENTORY REFACTOR — FASE 0.1
-- Backup das tabelas/views/triggers/functions antigos
-- =====================================================
-- Renomeia tabelas atuais para *_old (preserva histórico read-only).
-- DROP de views/triggers/functions ligadas ao schema antigo.
--
-- Execução: rodar no SQL Editor do Supabase ANTES de aplicar 01 e 10.
--
-- Reversível: pode ser revertido com ALTER TABLE *_old RENAME TO *
-- (desde que as novas tabelas inv_* ainda não tenham sido criadas).
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1) Drop views dependentes (precisam sair antes do rename)
-- -----------------------------------------------------
DROP VIEW IF EXISTS vw_produtos_estoque CASCADE;
DROP VIEW IF EXISTS vw_alertas_ativos CASCADE;
DROP VIEW IF EXISTS vw_movimentacoes_detalhadas CASCADE;

-- -----------------------------------------------------
-- 2) Drop triggers e funções do schema antigo
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS trigger_gerar_qr_code ON produtoslaboratorio;
DROP TRIGGER IF EXISTS trigger_atualizar_produto ON produtoslaboratorio;
DROP TRIGGER IF EXISTS trigger_atualizar_estoque ON movimentacoeslaboratorio;
DROP TRIGGER IF EXISTS trigger_atualizar_status ON estoquelaboratorio;

DROP FUNCTION IF EXISTS gerar_qr_code() CASCADE;
DROP FUNCTION IF EXISTS atualizar_data_atualizacao() CASCADE;
DROP FUNCTION IF EXISTS atualizar_estoque_apos_movimentacao() CASCADE;
DROP FUNCTION IF EXISTS atualizar_status_estoque() CASCADE;
DROP FUNCTION IF EXISTS calcular_valor_estoque(UUID) CASCADE;

-- -----------------------------------------------------
-- 3) Rename das tabelas antigas → *_old
-- -----------------------------------------------------
-- Tabelas do antigo módulo "inventory" (criadas via dashboard Supabase)
ALTER TABLE IF EXISTS items                     RENAME TO items_old;
ALTER TABLE IF EXISTS categories                RENAME TO categories_old;
ALTER TABLE IF EXISTS collaborators             RENAME TO collaborators_old;

-- Tabelas do antigo módulo "laboratorio"
ALTER TABLE IF EXISTS produtoslaboratorio       RENAME TO produtoslaboratorio_old;
ALTER TABLE IF EXISTS estoquelaboratorio        RENAME TO estoquelaboratorio_old;
ALTER TABLE IF EXISTS movimentacoeslaboratorio  RENAME TO movimentacoeslaboratorio_old;
ALTER TABLE IF EXISTS custoslaboratorio         RENAME TO custoslaboratorio_old;
ALTER TABLE IF EXISTS alertaslaboratorio        RENAME TO alertaslaboratorio_old;

-- Kits (FK quebrada para tabela laboratorio_produtos inexistente)
ALTER TABLE IF EXISTS kit_produtos              RENAME TO kit_produtos_old;
ALTER TABLE IF EXISTS kits                      RENAME TO kits_old;

-- -----------------------------------------------------
-- 4) Bloquear INSERT/UPDATE/DELETE nas tabelas *_old
--    (mantém SELECT para auditoria/consulta histórica)
-- -----------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'items_old','categories_old','collaborators_old',
        'produtoslaboratorio_old','estoquelaboratorio_old',
        'movimentacoeslaboratorio_old','custoslaboratorio_old',
        'alertaslaboratorio_old','kit_produtos_old','kits_old'
    ]
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
            EXECUTE format('DROP POLICY IF EXISTS "%I_readonly_select" ON %I', t, t);
            EXECUTE format(
                'CREATE POLICY "%I_readonly_select" ON %I FOR SELECT USING (true)',
                t, t
            );
            -- Sem policies para INSERT/UPDATE/DELETE = bloqueado para todos
            EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM PUBLIC', t);
            EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM authenticated', t);
        END IF;
    END LOOP;
END $$;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO PÓS-EXECUÇÃO
-- =====================================================
-- Esperado: listar todas as tabelas *_old criadas.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%_old'
ORDER BY table_name;
