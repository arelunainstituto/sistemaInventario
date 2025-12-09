-- =====================================================
-- PAYROLL DATA TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_payroll_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL UNIQUE REFERENCES rh_employees(id) ON DELETE CASCADE,
    
    -- Banking Information
    iban VARCHAR(50) NOT NULL,
    bank_name VARCHAR(255),
    
    -- Compensation
    base_salary NUMERIC(10,2),
    variable_compensation NUMERIC(10,2) DEFAULT 0,
    allowances NUMERIC(10,2) DEFAULT 0,
    meal_allowance NUMERIC(10,2) DEFAULT 0,
    transport_allowance NUMERIC(10,2) DEFAULT 0,
    
    -- Tax Information
    social_security_number VARCHAR(50),
    tax_number VARCHAR(50),
    tax_dependents INTEGER DEFAULT 0,
    tax_withholding_option VARCHAR(50),
    
    -- Professional Category
    professional_category VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_iban CHECK (iban ~ '^PT50[0-9]{21}$'),
    CONSTRAINT positive_salary CHECK (base_salary >= 0),
    CONSTRAINT positive_variable CHECK (variable_compensation >= 0),
    CONSTRAINT positive_allowances CHECK (allowances >= 0),
    CONSTRAINT valid_dependents CHECK (tax_dependents >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON rh_payroll_data(employee_id);

-- Comments
COMMENT ON TABLE rh_payroll_data IS 'Dados de folha de pagamento dos funcionários';
COMMENT ON COLUMN rh_payroll_data.iban IS 'IBAN português (PT50 + 21 dígitos)';
COMMENT ON COLUMN rh_payroll_data.bank_name IS 'Nome do banco';
COMMENT ON COLUMN rh_payroll_data.base_salary IS 'Salário base mensal';
COMMENT ON COLUMN rh_payroll_data.variable_compensation IS 'Remuneração variável (comissões, prémios)';
COMMENT ON COLUMN rh_payroll_data.allowances IS 'Subsídios diversos';
COMMENT ON COLUMN rh_payroll_data.meal_allowance IS 'Subsídio de alimentação';
COMMENT ON COLUMN rh_payroll_data.transport_allowance IS 'Subsídio de transporte';
COMMENT ON COLUMN rh_payroll_data.social_security_number IS 'Número da Segurança Social (NISS)';
COMMENT ON COLUMN rh_payroll_data.tax_number IS 'NIF';
COMMENT ON COLUMN rh_payroll_data.tax_dependents IS 'Número de dependentes para IRS';
COMMENT ON COLUMN rh_payroll_data.tax_withholding_option IS 'Opção de retenção na fonte: casado_unico_titular, casado_dois_titulares, nao_casado';
COMMENT ON COLUMN rh_payroll_data.professional_category IS 'Categoria profissional para efeitos de Segurança Social';

-- Row Level Security
ALTER TABLE rh_payroll_data ENABLE ROW LEVEL SECURITY;

-- Policy: RH managers can manage all payroll data
DROP POLICY IF EXISTS "rh_managers_manage_payroll" ON rh_payroll_data;
CREATE POLICY "rh_managers_manage_payroll" ON rh_payroll_data
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('Admin', 'rh_manager')
            AND ur.is_active = true
        )
    );

-- Policy: Employees can view their own payroll data
DROP POLICY IF EXISTS "employees_view_own_payroll" ON rh_payroll_data;
CREATE POLICY "employees_view_own_payroll" ON rh_payroll_data
    FOR SELECT TO authenticated
    USING (
        employee_id IN (
            SELECT id FROM rh_employees 
            WHERE user_id = auth.uid()
            OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_payroll_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payroll_data_updated_at ON rh_payroll_data;
CREATE TRIGGER trigger_update_payroll_data_updated_at
    BEFORE UPDATE ON rh_payroll_data
    FOR EACH ROW
    EXECUTE FUNCTION update_payroll_data_updated_at();

-- Trigger to sync salary with rh_salary_history
CREATE OR REPLACE FUNCTION sync_payroll_salary_history()
RETURNS TRIGGER AS $$
BEGIN
    -- When base_salary changes, create entry in salary history
    IF (TG_OP = 'UPDATE' AND OLD.base_salary IS DISTINCT FROM NEW.base_salary) THEN
        INSERT INTO rh_salary_history (
            employee_id,
            old_salary,
            new_salary,
            change_reason,
            effective_date,
            changed_by
        ) VALUES (
            NEW.employee_id,
            OLD.base_salary,
            NEW.base_salary,
            'Atualização de dados de folha de pagamento',
            CURRENT_DATE,
            auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_payroll_salary_history ON rh_payroll_data;
CREATE TRIGGER trigger_sync_payroll_salary_history
    AFTER UPDATE ON rh_payroll_data
    FOR EACH ROW
    EXECUTE FUNCTION sync_payroll_salary_history();
