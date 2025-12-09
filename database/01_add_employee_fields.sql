-- =====================================================
-- PHASE 1: DATABASE SCHEMA EXPANSION
-- Complete Employee Data System
-- =====================================================

-- 1.1 Update rh_employees table with new fields
-- =====================================================

-- Personal Data Fields
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) DEFAULT 'Portuguesa';
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50);
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS id_document_type VARCHAR(50); -- BI, CC, Passaporte
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS id_document_number VARCHAR(100);
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS niss VARCHAR(50); -- Número Segurança Social
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);

-- Professional Data Fields
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS contract_type VARCHAR(100);
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS work_schedule VARCHAR(255);
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS work_location VARCHAR(255) DEFAULT 'Porto – Instituto AreLuna';
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50) UNIQUE;
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES rh_employees(id);
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS professional_category VARCHAR(100);

-- Corporate/Internal Data Fields
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS corporate_email VARCHAR(255);
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS uniform_size VARCHAR(20);
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS has_access_card BOOLEAN DEFAULT false;
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS has_keys BOOLEAN DEFAULT false;
ALTER TABLE rh_employees ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_supervisor ON rh_employees(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_number ON rh_employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_niss ON rh_employees(niss);

-- Add comments for documentation
COMMENT ON COLUMN rh_employees.birth_date IS 'Data de nascimento do funcionário';
COMMENT ON COLUMN rh_employees.nationality IS 'Nacionalidade do funcionário';
COMMENT ON COLUMN rh_employees.marital_status IS 'Estado civil: Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), União de Facto';
COMMENT ON COLUMN rh_employees.id_document_type IS 'Tipo de documento: BI, CC (Cartão de Cidadão), Passaporte';
COMMENT ON COLUMN rh_employees.id_document_number IS 'Número do documento de identificação';
COMMENT ON COLUMN rh_employees.niss IS 'Número de Identificação da Segurança Social';
COMMENT ON COLUMN rh_employees.contract_type IS 'Tipo de contrato: termo_certo, termo_incerto, sem_termo, prestacao_servicos, estagio';
COMMENT ON COLUMN rh_employees.work_schedule IS 'Horário de trabalho (ex: 9h-18h)';
COMMENT ON COLUMN rh_employees.work_location IS 'Local de trabalho';
COMMENT ON COLUMN rh_employees.employee_number IS 'Número interno do colaborador';
COMMENT ON COLUMN rh_employees.supervisor_id IS 'ID do supervisor direto';
COMMENT ON COLUMN rh_employees.professional_category IS 'Categoria profissional: Técnico, Administrativo, Direção, etc.';
COMMENT ON COLUMN rh_employees.corporate_email IS 'Email corporativo do funcionário';
COMMENT ON COLUMN rh_employees.uniform_size IS 'Tamanho do uniforme: XS, S, M, L, XL, XXL';
COMMENT ON COLUMN rh_employees.has_access_card IS 'Possui cartão de acesso/ponto';
COMMENT ON COLUMN rh_employees.has_keys IS 'Possui chaves do escritório';
