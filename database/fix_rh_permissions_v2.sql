-- Corrigir permissões do RH para usar maiúsculo (HR) - Versão V2 (Com tratamento de duplicatas)

DO $$
DECLARE
    v_hr_lower_id UUID;
    v_hr_upper_id UUID;
BEGIN
    -- 1. Obter IDs dos módulos se existirem
    SELECT id INTO v_hr_lower_id FROM modules WHERE code = 'hr';
    SELECT id INTO v_hr_upper_id FROM modules WHERE code = 'HR';

    -- 2. Tratamento da tabela modules
    IF v_hr_lower_id IS NOT NULL AND v_hr_upper_id IS NOT NULL THEN
        -- Ambos existem: Migrar referências e deletar o minúsculo
        RAISE NOTICE 'Ambos módulos hr e HR encontrados. Mesclando...';
        
        -- Atualizar role_module_access para apontar para o HR maiúsculo
        UPDATE role_module_access
        SET module_id = v_hr_upper_id
        WHERE module_id = v_hr_lower_id
        AND NOT EXISTS (
            SELECT 1 FROM role_module_access rma 
            WHERE rma.module_id = v_hr_upper_id AND rma.role_id = role_module_access.role_id
        );
        
        -- Deletar o módulo minúsculo (cascade vai limpar referências restantes se houver)
        DELETE FROM modules WHERE id = v_hr_lower_id;
        
    ELSIF v_hr_lower_id IS NOT NULL THEN
        -- Apenas minúsculo existe: Renomear
        RAISE NOTICE 'Apenas módulo hr encontrado. Renomeando para HR...';
        UPDATE modules SET code = 'HR' WHERE id = v_hr_lower_id;
    END IF;

    -- 3. Atualizar nomes das permissões existentes (de 'hr:...' para 'HR:...')
    UPDATE permissions
    SET name = REPLACE(name, 'hr:', 'HR:')
    WHERE name LIKE 'hr:%';

    -- 4. Atualizar module_name nas permissões
    UPDATE permissions
    SET module_name = 'HR'
    WHERE module_name = 'hr';

    -- 5. Garantir que Admin tenha todas as permissões do módulo HR
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 
        (SELECT id FROM roles WHERE name = 'Admin'),
        id
    FROM permissions
    WHERE module_name = 'HR'
    AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'Admin')
        AND rp.permission_id = permissions.id
    );

END $$;

-- 6. Verificar resultado final
SELECT code, name FROM modules WHERE code ILIKE 'hr';
SELECT count(*) as permissions_count FROM permissions WHERE module_name = 'HR';
