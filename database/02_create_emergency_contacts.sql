-- =====================================================
-- EMERGENCY CONTACTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES rh_employees(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    alternative_phone VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    medical_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_employee ON rh_emergency_contacts(employee_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_primary ON rh_emergency_contacts(employee_id, is_primary) WHERE is_primary = true;

-- Comments
COMMENT ON TABLE rh_emergency_contacts IS 'Contactos de emergência dos funcionários';
COMMENT ON COLUMN rh_emergency_contacts.name IS 'Nome do contacto de emergência';
COMMENT ON COLUMN rh_emergency_contacts.relationship IS 'Grau de parentesco: Pai, Mãe, Cônjuge, Filho(a), Irmão(ã), Amigo(a), etc.';
COMMENT ON COLUMN rh_emergency_contacts.phone IS 'Telefone principal';
COMMENT ON COLUMN rh_emergency_contacts.alternative_phone IS 'Telefone alternativo';
COMMENT ON COLUMN rh_emergency_contacts.is_primary IS 'Contacto primário (a contactar primeiro)';
COMMENT ON COLUMN rh_emergency_contacts.medical_notes IS 'Notas médicas relevantes (opcional, com consentimento)';

-- Row Level Security
ALTER TABLE rh_emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Policy: RH managers can manage all emergency contacts
DROP POLICY IF EXISTS "rh_managers_manage_emergency_contacts" ON rh_emergency_contacts;
CREATE POLICY "rh_managers_manage_emergency_contacts" ON rh_emergency_contacts
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

-- Policy: Employees can view their own emergency contacts
DROP POLICY IF EXISTS "employees_view_own_emergency_contacts" ON rh_emergency_contacts;
CREATE POLICY "employees_view_own_emergency_contacts" ON rh_emergency_contacts
    FOR SELECT TO authenticated
    USING (
        employee_id IN (
            SELECT id FROM rh_employees 
            WHERE user_id = auth.uid() 
            OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_emergency_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_emergency_contacts_updated_at ON rh_emergency_contacts;
CREATE TRIGGER trigger_update_emergency_contacts_updated_at
    BEFORE UPDATE ON rh_emergency_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_emergency_contacts_updated_at();
