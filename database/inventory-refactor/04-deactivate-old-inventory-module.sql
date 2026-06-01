-- =====================================================
-- INVENTORY REFACTOR — Limpeza
-- Desativa o módulo legado 'inventory' (lowercase, /inventory.html)
-- mantendo apenas o novo 'INVENTORY' (uppercase, /inventory/index.html)
-- visível no dashboard.
-- =====================================================
-- Contexto:
--   O seed legado (setup-modules.sql:78 e seed-modules.sql) criou um
--   módulo com code='inventory' apontando para /inventory.html — a UI
--   antiga arquivada em public/_old/. A refatoração criou o novo módulo
--   com code='INVENTORY' apontando para /inventory/index.html.
--
--   A função get_user_accessible_modules (database/fix-duplicate-modules.sql)
--   filtra por is_active=true. Desativar o antigo basta para sumir do
--   dashboard. Antes disso, migramos role_module_access e
--   user_module_access do antigo para o novo, evitando que um usuário
--   que tenha acesso somente via o módulo legado perca a visibilidade.
--
--   permissions (módulo livre por nome) é compartilhada — não precisa
--   migração; a mesma row 'inventory:read' atende ambos.
--
-- Idempotente: pode ser executada várias vezes sem efeito colateral.
-- =====================================================

BEGIN;

DO $$
DECLARE
    v_old_id UUID;
    v_new_id UUID;
BEGIN
    SELECT id INTO v_old_id FROM modules WHERE code = 'inventory'  LIMIT 1;
    SELECT id INTO v_new_id FROM modules WHERE code = 'INVENTORY' LIMIT 1;

    IF v_new_id IS NULL THEN
        RAISE EXCEPTION 'Módulo novo (code=INVENTORY) não encontrado. Execute 01-roles-permissions.sql primeiro.';
    END IF;

    IF v_old_id IS NULL THEN
        RAISE NOTICE 'Módulo legado (code=inventory) não existe — nada a migrar.';
        RETURN;
    END IF;

    IF v_old_id = v_new_id THEN
        RAISE NOTICE 'Old e new apontam para o mesmo id — provavelmente o seed colidiu. Abortando.';
        RETURN;
    END IF;

    -- 1) Migra role_module_access do antigo p/ o novo (evita duplicar)
    INSERT INTO role_module_access (role_id, module_id, is_active)
    SELECT rma.role_id, v_new_id, rma.is_active
      FROM role_module_access rma
     WHERE rma.module_id = v_old_id
       AND NOT EXISTS (
           SELECT 1 FROM role_module_access rma2
            WHERE rma2.role_id = rma.role_id AND rma2.module_id = v_new_id
       );

    -- 2) Migra user_module_access do antigo p/ o novo (evita duplicar)
    INSERT INTO user_module_access (user_id, module_id, is_active, expires_at)
    SELECT uma.user_id, v_new_id, uma.is_active, uma.expires_at
      FROM user_module_access uma
     WHERE uma.module_id = v_old_id
       AND NOT EXISTS (
           SELECT 1 FROM user_module_access uma2
            WHERE uma2.user_id = uma.user_id AND uma2.module_id = v_new_id
       );

    -- 3) Remove as referências antigas (deixa o histórico limpo)
    DELETE FROM role_module_access WHERE module_id = v_old_id;
    DELETE FROM user_module_access WHERE module_id = v_old_id;

    -- 4) Desativa o módulo legado (não DELETA para preservar histórico de auditoria)
    UPDATE modules
       SET is_active = FALSE,
           name      = name || ' (legado)'
     WHERE id = v_old_id
       AND is_active = TRUE;

    RAISE NOTICE 'Módulo legado (id=%) desativado e acessos migrados para o novo (id=%).', v_old_id, v_new_id;
END $$;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- 1) Listar módulos com nome "Inventário" — deve sobrar apenas 'INVENTORY' ativo
SELECT id, code, name, route, display_order, is_active
  FROM modules
 WHERE LOWER(code) = 'inventory' OR name ILIKE '%inventário%'
 ORDER BY code;

-- 2) Confirmar que nenhuma role/user aponta para o módulo legado
SELECT 'role_module_access' AS table, COUNT(*) AS legacy_rows
  FROM role_module_access rma
  JOIN modules m ON m.id = rma.module_id
 WHERE m.code = 'inventory'
UNION ALL
SELECT 'user_module_access', COUNT(*)
  FROM user_module_access uma
  JOIN modules m ON m.id = uma.module_id
 WHERE m.code = 'inventory';
-- Esperado: 0 em ambas as linhas
