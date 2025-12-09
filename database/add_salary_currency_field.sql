-- =====================================================
-- ADD SALARY CURRENCY FIELD TO RH_PAYROLL_DATA
-- =====================================================
-- Adiciona campo para armazenar a moeda do salário (EUR ou BRL)

DO $$
BEGIN
    -- Verificar se a coluna salary_currency já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rh_payroll_data' 
        AND column_name = 'salary_currency'
    ) THEN
        -- Adicionar a coluna salary_currency
        ALTER TABLE rh_payroll_data
        ADD COLUMN salary_currency VARCHAR(3) DEFAULT 'EUR' NOT NULL;
        
        -- Adicionar constraint para validar apenas EUR ou BRL
        ALTER TABLE rh_payroll_data
        ADD CONSTRAINT valid_salary_currency CHECK (salary_currency IN ('EUR', 'BRL'));
        
        -- Atualizar registros existentes para EUR (padrão europeu)
        UPDATE rh_payroll_data
        SET salary_currency = 'EUR'
        WHERE salary_currency IS NULL;
        
        RAISE NOTICE 'Coluna salary_currency adicionada à tabela rh_payroll_data';
    ELSE
        RAISE NOTICE 'Coluna salary_currency já existe na tabela rh_payroll_data';
    END IF;
END $$;

-- Comentário da coluna
COMMENT ON COLUMN rh_payroll_data.salary_currency IS 'Moeda do salário: EUR (Euro) ou BRL (Real Brasileiro)';
