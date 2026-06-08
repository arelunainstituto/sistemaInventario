-- =====================================================
-- INVENTORY REFACTOR — 91. Re-bind das permissões aos roles
-- =====================================================
-- Sintoma observado em produção: usuário com role Inventory_Admin
-- recebe "Acesso negado" no listing /api/inventory/items, mesmo com
-- a role corretamente atribuída.
--
-- Diagnóstico: role_permissions de Inventory_Admin estava 1 linha
-- curta (faltava inventory:read), provavelmente porque a permission
-- foi recriada em algum momento com novo UUID e o link velho ficou
-- órfão (apontando para um id que não existe mais), enquanto o seed
-- 01 com `IF NOT EXISTS` não percebeu que faltava re-criar.
--
-- Esta migration aplica de forma idempotente a matriz da spec:
--   • Inventory_Admin         = TODAS as permissões inventory:*
--   • Inventory_Operador      = read, create_item, update_item, entry,
--                               exit, transfer, inventory_session
--   • Inventory_Consulta      = read, reports
--   • Inventory_Contabilidade = read, reports, financial
--
-- Pode ser re-rodada quantas vezes for necessário — INSERT só acontece
-- quando o par (role_id, permission_id) ainda não existe.
-- =====================================================

BEGIN;

-- ---------- Inventory_Admin: TODAS as permissões inventory:* ----------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r CROSS JOIN permissions p
 WHERE r.name = 'Inventory_Admin'
   AND p.module_name = 'inventory'
   AND NOT EXISTS (
       SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );

-- ---------- Inventory_Operador ----------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r CROSS JOIN permissions p
 WHERE r.name = 'Inventory_Operador'
   AND p.name IN (
       'inventory:read', 'inventory:create_item', 'inventory:update_item',
       'inventory:entry', 'inventory:exit', 'inventory:transfer',
       'inventory:inventory_session'
   )
   AND NOT EXISTS (
       SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );

-- ---------- Inventory_Consulta ----------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r CROSS JOIN permissions p
 WHERE r.name = 'Inventory_Consulta'
   AND p.name IN ('inventory:read', 'inventory:reports')
   AND NOT EXISTS (
       SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );

-- ---------- Inventory_Contabilidade ----------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r CROSS JOIN permissions p
 WHERE r.name = 'Inventory_Contabilidade'
   AND p.name IN ('inventory:read', 'inventory:reports', 'inventory:financial')
   AND NOT EXISTS (
       SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Quantidade de permissões por role inventário + lista
SELECT r.name AS role,
       COUNT(p.id) AS qtd_permissoes,
       ARRAY_AGG(p.name ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL) AS permissoes
  FROM roles r
  LEFT JOIN role_permissions rp ON rp.role_id = r.id
  LEFT JOIN permissions p ON p.id = rp.permission_id AND p.module_name = 'inventory'
 WHERE r.name LIKE 'Inventory_%'
 GROUP BY r.name
 ORDER BY r.name;

-- Esperado (no mínimo — pode ter mais em Inventory_Admin se houver permissões extras):
--   Inventory_Admin          → 10+ (todas as 10 canônicas + quaisquer extras)
--   Inventory_Contabilidade  →  3  (read, reports, financial)
--   Inventory_Consulta       →  2  (read, reports)
--   Inventory_Operador       →  7  (read, create_item, update_item, entry, exit, transfer, inventory_session)
