-- Add international columns to rh_payroll_data
ALTER TABLE rh_payroll_data ADD COLUMN IF NOT EXISTS bank_country VARCHAR(10) DEFAULT 'PT';
ALTER TABLE rh_payroll_data ADD COLUMN IF NOT EXISTS bank_agency VARCHAR(50);
ALTER TABLE rh_payroll_data ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE rh_payroll_data ADD COLUMN IF NOT EXISTS pix_key VARCHAR(100);
ALTER TABLE rh_payroll_data ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(20);
ALTER TABLE rh_payroll_data ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(10) DEFAULT 'EUR';

-- Relax IBAN constraint to allow other formats if country is not PT
ALTER TABLE rh_payroll_data DROP CONSTRAINT IF EXISTS valid_iban;
ALTER TABLE rh_payroll_data ADD CONSTRAINT valid_iban CHECK (
    (bank_country = 'PT' AND iban ~ '^PT50[0-9]{21}$') OR
    (bank_country != 'PT')
);

-- Add currency to rh_payrolls for historical accuracy
ALTER TABLE rh_payrolls ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'EUR';
