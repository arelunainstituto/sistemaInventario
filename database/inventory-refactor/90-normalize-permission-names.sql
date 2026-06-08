-- =====================================================
-- INVENTORY REFACTOR — 90. Normalização de permission names
-- =====================================================
-- Conserta o case mismatch que impedia roles Inventory_* de funcionarem:
--
-- Antes:
--   permissions.name        = 'inventory:create_item'  (lowercase)
--   permissions.module_name = 'INVENTORY'              (uppercase)  ← causa
--   permissions.action      = 'create'                 (verbo curto) ← causa
--
-- O middleware (api/middleware/auth.js:128) constrói a string como
-- `${module_name}:${action}` = 'INVENTORY:create', mas as rotas do
-- inventário chamam requirePermission('inventory', 'create_item') que
-- gera 'inventory:create_item'. Strings diferentes → 403 em tudo.
--
-- Depois:
--   permissions.name        = 'inventory:create_item'   (inalterado)
--   permissions.module_name = 'inventory'               (lowercase)
--   permissions.action      = 'create_item'             (sufixo do name)
--
-- Agora `${module_name}:${action}` = 'inventory:create_item' que casa
-- com o que as rotas pedem.
--
-- Idempotente. Apenas linhas com module_name='INVENTORY' são alteradas.
-- Não toca em permissions de outros módulos (HR continua HR:read etc.).
-- =====================================================

BEGIN;

UPDATE permissions
   SET module_name = 'inventory',
       action      = SUBSTRING(name FROM 'inventory:(.+)$')
 WHERE module_name = 'INVENTORY'
   AND name LIKE 'inventory:%';

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- 1) Todas as permissões inventory:* devem ter module_name='inventory'
--    e action igual ao sufixo do name.
SELECT name, module_name, action,
       CASE WHEN (module_name || ':' || action) = name
            THEN 'OK'
            ELSE 'INCONSISTENTE'
       END AS coerencia
  FROM permissions
 WHERE name LIKE 'inventory:%'
 ORDER BY name;

-- 2) Nenhuma linha legada deve sobrar com module_name='INVENTORY'
SELECT COUNT(*) AS legacy_uppercase
  FROM permissions
 WHERE module_name = 'INVENTORY';
-- Esperado: 0

-- 3) Para usuários com role Inventory_*, listar as permissões que
--    eles passam a ter (depois desta migration):
SELECT r.name AS role,
       STRING_AGG(module_name || ':' || action, ', ' ORDER BY action) AS permissions_now
  FROM roles r
  JOIN role_permissions rp ON rp.role_id = r.id
  JOIN permissions p ON p.id = rp.permission_id
 WHERE r.name LIKE 'Inventory_%'
 GROUP BY r.name
 ORDER BY r.name;
