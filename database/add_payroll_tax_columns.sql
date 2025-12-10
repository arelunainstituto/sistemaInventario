-- Add tax columns to rh_payrolls
ALTER TABLE rh_payrolls ADD COLUMN IF NOT EXISTS inss_discount NUMERIC DEFAULT 0;
ALTER TABLE rh_payrolls ADD COLUMN IF NOT EXISTS irrf_discount NUMERIC DEFAULT 0;
