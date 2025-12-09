-- Verificar se a coluna salary_base existe e adicioná-la se necessário
DO $$
BEGIN
    -- Verificar se a coluna salary_base existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rh_employees' 
        AND column_name = 'salary_base'
    ) THEN
        -- Adicionar a coluna salary_base
        ALTER TABLE rh_employees 
        ADD COLUMN salary_base NUMERIC;
        
        RAISE NOTICE 'Coluna salary_base adicionada à tabela rh_employees';
    ELSE
        RAISE NOTICE 'Coluna salary_base já existe na tabela rh_employees';
    END IF;
END $$;
