-- =====================================================
-- CORREÇÃO: Módulos Duplicados no Dashboard
-- Problema: Módulos apareciam duplicados quando usuário tinha
--           acesso direto (user_module_access) E acesso via role
-- Solução: Usar DISTINCT ON para garantir que cada módulo
--          apareça apenas uma vez
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_accessible_modules(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    code VARCHAR,
    name VARCHAR,
    description TEXT,
    icon VARCHAR,
    emoji VARCHAR,
    color VARCHAR,
    route VARCHAR,
    display_order INTEGER,
    access_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    WITH accessible_modules AS (
        SELECT DISTINCT ON (m.id)
            m.id,
            m.code,
            m.name,
            m.description,
            m.icon,
            m.emoji,
            m.color,
            m.route,
            m.display_order,
            CASE 
                WHEN uma.user_id IS NOT NULL THEN 'direct'::VARCHAR
                ELSE 'role'::VARCHAR
            END as access_type
        FROM modules m
        LEFT JOIN user_module_access uma ON m.id = uma.module_id 
            AND uma.user_id = p_user_id
            AND uma.is_active = true
            AND (uma.expires_at IS NULL OR uma.expires_at > NOW())
        LEFT JOIN role_module_access rma ON m.id = rma.module_id
            AND rma.is_active = true
        LEFT JOIN user_roles ur ON rma.role_id = ur.role_id
            AND ur.user_id = p_user_id
            AND ur.is_active = true
        WHERE m.is_active = true
            AND (
                (uma.user_id IS NOT NULL) -- Tem acesso direto
                OR (ur.user_id IS NOT NULL) -- Tem acesso via role
            )
        ORDER BY m.id
    )
    SELECT 
        id,
        code,
        name,
        description,
        icon,
        emoji,
        color,
        route,
        display_order,
        access_type
    FROM accessible_modules
    ORDER BY display_order, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;






