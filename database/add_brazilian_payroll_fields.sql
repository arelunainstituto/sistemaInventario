-- Add Brazilian banking fields to rh_payroll_data

DO $$
BEGIN
    -- Add bank_country if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rh_payroll_data' AND column_name = 'bank_country') THEN
        ALTER TABLE rh_payroll_data ADD COLUMN bank_country VARCHAR(10) DEFAULT 'PT';
        COMMENT ON COLUMN rh_payroll_data.bank_country IS 'País da conta bancária (PT ou BR)';
    END IF;

    -- Add bank_agency
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rh_payroll_data' AND column_name = 'bank_agency') THEN
        ALTER TABLE rh_payroll_data ADD COLUMN bank_agency VARCHAR(20);
        COMMENT ON COLUMN rh_payroll_data.bank_agency IS 'Agência bancária (para contas BR)';
    END IF;

    -- Add bank_account_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rh_payroll_data' AND column_name = 'bank_account_number') THEN
        ALTER TABLE rh_payroll_data ADD COLUMN bank_account_number VARCHAR(50);
        COMMENT ON COLUMN rh_payroll_data.bank_account_number IS 'Número da conta bancária (para contas BR)';
    END IF;

    -- Add pix_key
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rh_payroll_data' AND column_name = 'pix_key') THEN
        ALTER TABLE rh_payroll_data ADD COLUMN pix_key VARCHAR(100);
        COMMENT ON COLUMN rh_payroll_data.pix_key IS 'Chave PIX (para contas BR)';
    END IF;

    -- Add pix_key_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rh_payroll_data' AND column_name = 'pix_key_type') THEN
        ALTER TABLE rh_payroll_data ADD COLUMN pix_key_type VARCHAR(20);
        COMMENT ON COLUMN rh_payroll_data.pix_key_type IS 'Tipo de chave PIX (cpf, email, phone, random)';
    END IF;

END $$;
