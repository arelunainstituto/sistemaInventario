-- =====================================================
-- INVENTORY REFACTOR — Defense-in-Depth
-- Reforça RLS em todas as tabelas inv_* para exigir acesso ao
-- módulo INVENTORY (em vez de USING (true) para qualquer
-- authenticated). Idempotente.
-- =====================================================
-- Contexto do risco:
--   - A chave anon do Supabase é pública (entregue ao browser em
--     public/config.js). Qualquer usuário autenticado pode usá-la
--     para consultar tabelas via PostgREST direto.
--   - As policies originais (10-fase1-cadastros-entradas.sql:566-583)
--     usavam USING (true), permitindo SELECT a qualquer JWT válido —
--     mesmo de usuários sem acesso ao módulo inventory.
--   - A camada de proteção real é o requirePermission no Express,
--     mas RLS deve dobrar a defesa caso o frontend (ou um cliente
--     malicioso) bata direto no Supabase REST.
--
-- Estratégia:
--   1) Helper SECURITY DEFINER fn_inv_user_can_access(uuid) que checa
--      se o usuário tem (a) qualquer role Inventory_* ou Admin OU
--      (b) entrada ativa em user_module_access para o módulo INVENTORY.
--   2) DROP das policies *_auth_select USING(true).
--   3) CREATE de policies novas que delegam ao helper.
--   4) inv_access_log é mais sensível (PII, ação por usuário):
--      restringe a Inventory_Admin/Admin.
--
-- O backend continua usando SERVICE_ROLE_KEY e bypassa RLS — sem
-- mudança operacional. Esta migração apenas fecha o vetor de leitura
-- via anon key.
-- =====================================================

BEGIN;

-- ---------- 1) Helper de verificação ----------

CREATE OR REPLACE FUNCTION public.fn_inv_user_can_access(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        p_user_id IS NOT NULL AND (
            EXISTS (
                SELECT 1
                  FROM user_roles ur
                  JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id    = p_user_id
                   AND ur.is_active  = true
                   AND (r.name LIKE 'Inventory\_%' ESCAPE '\'
                        OR LOWER(r.name) = 'admin')
            )
            OR EXISTS (
                SELECT 1
                  FROM user_module_access uma
                  JOIN modules m ON m.id = uma.module_id
                 WHERE uma.user_id   = p_user_id
                   AND uma.is_active = true
                   AND UPPER(m.code) = 'INVENTORY'
            )
        );
$$;

COMMENT ON FUNCTION public.fn_inv_user_can_access(UUID) IS
'Defense-in-depth helper for RLS on inv_* tables. Returns true if the user '
'has any Inventory_* role, the Admin role, or a direct user_module_access '
'entry for the INVENTORY module. SECURITY DEFINER so non-privileged users '
'can use it from RLS policies without exposing user_roles/permissions.';

CREATE OR REPLACE FUNCTION public.fn_inv_user_is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        p_user_id IS NOT NULL AND EXISTS (
            SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id   = p_user_id
               AND ur.is_active = true
               AND (r.name = 'Inventory_Admin' OR LOWER(r.name) = 'admin')
        );
$$;

COMMENT ON FUNCTION public.fn_inv_user_is_admin(UUID) IS
'Defense-in-depth helper for RLS on inv_access_log. Restricts row visibility '
'to Inventory_Admin / Admin only.';

GRANT EXECUTE ON FUNCTION public.fn_inv_user_can_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_inv_user_is_admin(UUID)   TO authenticated;

-- ---------- 2 + 3) Troca policies em todas as tabelas inv_* ----------

DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'inv_units_of_measure',
        'inv_units',
        'inv_locations',
        'inv_categories',
        'inv_suppliers',
        'inv_items',
        'inv_lots',
        'inv_stock',
        'inv_movements',
        'inv_entries',
        'inv_entry_lines',
        'inv_adjustment_reasons',
        'inv_inventory_sessions',
        'inv_inventory_counts',
        'inv_depreciation_runs',
        'inv_system_settings'
    ];
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        -- Só roda se a tabela existe (idempotência defensiva)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = v_table
        ) THEN
            RAISE NOTICE 'Skipping % — table not found', v_table;
            CONTINUE;
        END IF;

        -- Garante RLS ligado
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);

        -- Remove policies antigas (USING(true) e variantes)
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_auth_select', v_table);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_inventory_user_select', v_table);

        -- Cria policy nova restritiva
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.fn_inv_user_can_access())',
            v_table || '_inventory_user_select', v_table
        );

        RAISE NOTICE 'RLS endurecido em %', v_table;
    END LOOP;
END $$;

-- ---------- 4) inv_access_log — restrição extra a admins ----------

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'inv_access_log'
    ) THEN
        EXECUTE 'ALTER TABLE inv_access_log ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS inv_access_log_auth_select ON inv_access_log';
        EXECUTE 'DROP POLICY IF EXISTS inv_access_log_admin_select ON inv_access_log';
        EXECUTE 'CREATE POLICY inv_access_log_admin_select '
                'ON inv_access_log FOR SELECT TO authenticated '
                'USING (public.fn_inv_user_is_admin())';
        RAISE NOTICE 'inv_access_log restrito a Inventory_Admin/Admin';
    END IF;
END $$;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- 1) Listar todas as policies em inv_* (esperado: 1 SELECT por tabela)
SELECT schemaname, tablename, policyname, cmd, qual
  FROM pg_policies
 WHERE tablename LIKE 'inv\_%' ESCAPE '\'
 ORDER BY tablename, policyname;

-- 2) Conferir helper (esperado: TRUE para usuários inventory, FALSE para os demais)
-- SELECT public.fn_inv_user_can_access('<algum_uuid>');
-- SELECT public.fn_inv_user_is_admin('<algum_uuid>');
