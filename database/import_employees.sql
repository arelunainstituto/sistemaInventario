-- Script para importar usuários da tabela public.users para o módulo de RH
DO $$
DECLARE
    v_user RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Loop através da junção entre public.users e auth.users para garantir IDs válidos
    FOR v_user IN 
        SELECT 
            au.id as auth_id, 
            u.name, 
            u.email 
        FROM public.users u
        JOIN auth.users au ON u.email = au.email
    LOOP
        
        -- Verificar se já existe na tabela de funcionários
        IF NOT EXISTS (SELECT 1 FROM public.rh_employees WHERE user_id = v_user.auth_id) THEN
            
            INSERT INTO public.rh_employees (
                user_id,
                name,
                email,
                nif,
                mobile,
                department,
                role,
                status,
                hire_date,
                created_at,
                updated_at
            ) VALUES (
                v_user.auth_id,
                COALESCE(v_user.name, SPLIT_PART(v_user.email, '@', 1)),
                v_user.email,
                '999' || LPAD(v_count::text, 6, '0'), -- NIF único
                '9' || LPAD(v_count::text, 8, '0'), -- Mobile único
                'Geral',
                'Funcionário',
                'ACTIVE',
                CURRENT_DATE,
                NOW(),
                NOW()
            );
            
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Importação concluída! % funcionários importados.', v_count;
END $$;
