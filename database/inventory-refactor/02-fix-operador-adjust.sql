-- =====================================================
-- INVENTORY REFACTOR — Fix
-- Conceder inventory:adjust ao Inventory_Operador
-- =====================================================
-- Alinhamento com RF06 do documento:
--   "Ajuste manual: …autorização necessária para ajustes acima de 5%
--    do stock." → implica que ajustes ≤ 5% devem ser livres para o
--    Operador. A regra dos 5% (que bloqueia Operador acima desse limite)
--    já está implementada em fn_inv_adjust desde a Fase 2, mas o
--    Operador faltava a permissão de base para sequer entrar no
--    endpoint.
--
-- Esta migração é idempotente (ON CONFLICT DO NOTHING).
-- =====================================================

BEGIN;

DO $$
DECLARE
    v_operador_id UUID;
    v_adjust_id   UUID;
BEGIN
    SELECT id INTO v_operador_id FROM roles WHERE name = 'Inventory_Operador';
    SELECT id INTO v_adjust_id   FROM permissions WHERE name = 'inventory:adjust';

    IF v_operador_id IS NULL THEN
        RAISE NOTICE 'Role Inventory_Operador não encontrado — execute 01-roles-permissions.sql primeiro';
        RETURN;
    END IF;
    IF v_adjust_id IS NULL THEN
        RAISE NOTICE 'Permissão inventory:adjust não encontrada — execute 01-roles-permissions.sql primeiro';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM role_permissions
         WHERE role_id = v_operador_id AND permission_id = v_adjust_id
    ) THEN
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (v_operador_id, v_adjust_id);
        RAISE NOTICE 'inventory:adjust concedida a Inventory_Operador';
    ELSE
        RAISE NOTICE 'Inventory_Operador já tinha inventory:adjust — nada a fazer';
    END IF;
END $$;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT r.name AS role, p.name AS permission
  FROM role_permissions rp
  JOIN roles r       ON r.id = rp.role_id
  JOIN permissions p ON p.id = rp.permission_id
 WHERE r.name = 'Inventory_Operador' AND p.name = 'inventory:adjust';
-- Esperado: 1 linha
