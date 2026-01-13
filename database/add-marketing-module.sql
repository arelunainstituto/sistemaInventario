-- Migration to add Marketing module and related tables
-- FIXED: Uses INSERT ... WHERE NOT EXISTS preventing ON CONFLICT errors due to missing unique constraints.

-- 1. Add 'in_development' column to modules table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'in_development') THEN
        ALTER TABLE modules ADD COLUMN in_development BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Insert/Update Marketing module
DO $$
BEGIN
    -- Update if exists
    UPDATE modules SET
        name = 'Marketing',
        description = 'Gestão de postagens e conteúdo do blog',
        icon = 'fas fa-bullhorn',
        emoji = '📢',
        color = 'pink',
        route = '/marketing.html',
        display_order = 12,
        is_active = true,
        in_development = true
    WHERE code = 'marketing';

    -- Insert if not exists
    IF NOT EXISTS (SELECT 1 FROM modules WHERE code = 'marketing') THEN
        INSERT INTO modules (code, name, description, icon, emoji, color, route, display_order, is_active, in_development)
        VALUES (
            'marketing',
            'Marketing',
            'Gestão de postagens e conteúdo do blog',
            'fas fa-bullhorn',
            '📢',
            'pink',
            '/marketing.html',
            12,
            true,
            true
        );
    END IF;
END $$;

-- 3. Create marketing_posts table
CREATE TABLE IF NOT EXISTS marketing_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    excerpt TEXT,
    author_id UUID REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, published
    published_at TIMESTAMP WITH TIME ZONE,
    image_url TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_marketing_posts_status ON marketing_posts(status);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_author_id ON marketing_posts(author_id);

-- Trigger to update updated_at
CREATE OR REPLACE TRIGGER update_marketing_posts_updated_at
    BEFORE UPDATE ON marketing_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE marketing_posts ENABLE ROW LEVEL SECURITY;

-- 4. Create Marketing Roles and Permissions
-- Ensure 'Marketing' role exists
INSERT INTO roles (name, description)
SELECT 'Marketing', 'Acesso ao módulo de marketing e blog'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Marketing');

-- Ensure permissions exist
INSERT INTO permissions (name, description, resource, action)
SELECT 'marketing:read', 'Visualizar posts de marketing', 'marketing', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'marketing:read');

INSERT INTO permissions (name, description, resource, action)
SELECT 'marketing:write', 'Criar/Editar/Deletar posts de marketing', 'marketing', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'marketing:write');

-- Link role to permissions
DO $$
DECLARE
    v_role_id UUID;
    v_perm_read_id UUID;
    v_perm_write_id UUID;
BEGIN
    SELECT id INTO v_role_id FROM roles WHERE name = 'Marketing';
    SELECT id INTO v_perm_read_id FROM permissions WHERE name = 'marketing:read';
    SELECT id INTO v_perm_write_id FROM permissions WHERE name = 'marketing:write';

    IF v_role_id IS NOT NULL AND v_perm_read_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_role_id, v_perm_read_id
        WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_role_id AND permission_id = v_perm_read_id);
    END IF;

    IF v_role_id IS NOT NULL AND v_perm_write_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_role_id, v_perm_write_id
        WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_role_id AND permission_id = v_perm_write_id);
    END IF;
END $$;

-- 5. Grant Marketing module access to Admin and Marketing roles
DO $$
DECLARE
    v_module_id UUID;
    v_admin_role_id UUID;
    v_marketing_role_id UUID;
BEGIN
    SELECT id INTO v_module_id FROM modules WHERE code = 'marketing';
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'Admin';
    SELECT id INTO v_marketing_role_id FROM roles WHERE name = 'Marketing';

    -- Grant to Admin
    IF v_module_id IS NOT NULL AND v_admin_role_id IS NOT NULL THEN
        INSERT INTO role_module_access (role_id, module_id)
        SELECT v_admin_role_id, v_module_id
        WHERE NOT EXISTS (SELECT 1 FROM role_module_access WHERE role_id = v_admin_role_id AND module_id = v_module_id);
    END IF;

    -- Grant to Marketing
    IF v_module_id IS NOT NULL AND v_marketing_role_id IS NOT NULL THEN
        INSERT INTO role_module_access (role_id, module_id)
        SELECT v_marketing_role_id, v_module_id
        WHERE NOT EXISTS (SELECT 1 FROM role_module_access WHERE role_id = v_marketing_role_id AND module_id = v_module_id);
    END IF;
END $$;

-- 6. Grant Access to marketing_posts table via RLS
-- Drop policies if they exist to avoid duplication errors or just use OR REPLACE if possible (PG14+? typically DROP IF EXISTS is safer)
DROP POLICY IF EXISTS "Marketing e Admin podem ver todos os posts" ON marketing_posts;
DROP POLICY IF EXISTS "Marketing e Admin podem gerenciar posts" ON marketing_posts;

-- Policy: Marketing role and Admin can read all posts
CREATE POLICY "Marketing e Admin podem ver todos os posts"
    ON marketing_posts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('Admin', 'Marketing')
            AND ur.is_active = true
        )
    );

-- Policy: Marketing role and Admin can create/update/delete posts
CREATE POLICY "Marketing e Admin podem gerenciar posts"
    ON marketing_posts FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('Admin', 'Marketing')
            AND ur.is_active = true
        )
    );

-- 7. Update get_user_accessible_modules function to return in_development
-- DROP first because return type changed
DROP FUNCTION IF EXISTS get_user_accessible_modules(UUID);

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
    access_type VARCHAR,
    in_development BOOLEAN -- Added column
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
            END as access_type,
            m.in_development -- Added column
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
        am.id,
        am.code,
        am.name,
        am.description,
        am.icon,
        am.emoji,
        am.color,
        am.route,
        am.display_order,
        am.access_type,
        am.in_development
    FROM accessible_modules am
    ORDER BY am.display_order, am.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
