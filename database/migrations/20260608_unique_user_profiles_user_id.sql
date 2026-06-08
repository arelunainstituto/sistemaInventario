-- =====================================================
-- Migration: garante UNIQUE em user_profiles.user_id
-- =====================================================
-- Sem esta constraint:
--   • Pode haver mais de um profile para o mesmo auth.users.id.
--   • api/middleware/auth.js:44 usa .single() em user_profiles, que
--     falha (PGRST116) quando há 2+ linhas — usuário cai em 403
--     "Perfil não encontrado" sem motivo aparente.
--   • Helpers como ensureAuthUserAndProfile e o bloco SQL que cria
--     usuários ad-hoc não podem usar ON CONFLICT (user_id) — precisam
--     fazer SELECT-then-INSERT/UPDATE, que é racy.
--
-- Comportamento:
--   1. Se a constraint já existe → no-op.
--   2. Detecta duplicatas. Se houver, ABORTA listando os user_ids
--      afetados. Você precisa decidir manualmente qual linha manter
--      (keep newest, ou por tenant_id, etc.) antes de re-rodar.
--   3. Se zero duplicatas, adiciona UNIQUE.
--
-- Idempotente. Pode ser rodada quantas vezes for necessário.
-- =====================================================

DO $$
DECLARE
    v_exists     BOOLEAN;
    v_dup_count  INTEGER;
    v_dup_sample TEXT;
BEGIN
    -- 1) Constraint já existe?
    SELECT EXISTS (
        SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
         WHERE t.relname = 'user_profiles'
           AND c.contype = 'u'
           AND c.conname = 'uq_user_profiles_user_id'
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE 'uq_user_profiles_user_id já existe — nada a fazer.';
        RETURN;
    END IF;

    -- 2) Detectar duplicatas
    SELECT COUNT(*) INTO v_dup_count
      FROM (
        SELECT user_id
          FROM user_profiles
         GROUP BY user_id
        HAVING COUNT(*) > 1
      ) dups;

    IF v_dup_count > 0 THEN
        SELECT STRING_AGG(user_id::TEXT || ' (' || cnt || 'x)', ', ')
          INTO v_dup_sample
          FROM (
            SELECT user_id, COUNT(*) AS cnt
              FROM user_profiles
             GROUP BY user_id
            HAVING COUNT(*) > 1
             LIMIT 20
          ) dups;

        RAISE EXCEPTION
          'ABORTADO: % user_id(s) com mais de um profile. Resolva manualmente antes de re-rodar. Amostra: %',
          v_dup_count, v_dup_sample;
    END IF;

    -- 3) Limpo — cria a constraint
    ALTER TABLE user_profiles
        ADD CONSTRAINT uq_user_profiles_user_id UNIQUE (user_id);

    RAISE NOTICE 'Constraint uq_user_profiles_user_id criada com sucesso.';
END $$;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Constraints únicas em user_profiles (esperado: uq_user_profiles_user_id presente)
SELECT conname AS constraint_name, pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
 WHERE t.relname = 'user_profiles'
   AND c.contype = 'u'
 ORDER BY conname;

-- Dupes restantes (esperado: 0 linhas)
SELECT user_id, COUNT(*) AS cnt
  FROM user_profiles
 GROUP BY user_id
HAVING COUNT(*) > 1;
