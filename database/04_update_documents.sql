-- =====================================================
-- ENHANCE DOCUMENTS TABLE
-- =====================================================

-- Add new columns to existing rh_documents table
ALTER TABLE rh_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(100);
ALTER TABLE rh_documents ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;
ALTER TABLE rh_documents ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);
ALTER TABLE rh_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE rh_documents ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE rh_documents ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE rh_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

-- Add index for document type
CREATE INDEX IF NOT EXISTS idx_documents_type ON rh_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_required ON rh_documents(is_required) WHERE is_required = true;
CREATE INDEX IF NOT EXISTS idx_documents_verified ON rh_documents(verified_by, verified_at);

-- Comments
COMMENT ON COLUMN rh_documents.document_type IS 'Tipo de documento: CC, Passaporte, Comprovativo_Morada, IBAN, NIF, NISS, Certificado_Profissional, Escolaridade, Atestado, Declaracao_IRS, Contrato, Outros';
COMMENT ON COLUMN rh_documents.is_required IS 'Documento obrigatório';
COMMENT ON COLUMN rh_documents.verified_by IS 'Usuário que verificou o documento';
COMMENT ON COLUMN rh_documents.verified_at IS 'Data de verificação do documento';
COMMENT ON COLUMN rh_documents.notes IS 'Notas sobre o documento';
COMMENT ON COLUMN rh_documents.file_size_bytes IS 'Tamanho do arquivo em bytes';
COMMENT ON COLUMN rh_documents.mime_type IS 'Tipo MIME do arquivo';

-- Create enum-like constraint for document types (optional, for data integrity)
ALTER TABLE rh_documents DROP CONSTRAINT IF EXISTS valid_document_type;
ALTER TABLE rh_documents ADD CONSTRAINT valid_document_type CHECK (
    document_type IN (
        'CC', 'Passaporte', 'Comprovativo_Morada', 'IBAN', 'NIF', 'NISS',
        'Certificado_Profissional', 'Escolaridade', 'Atestado', 'Declaracao_IRS',
        'Contrato', 'Termo_Aditivo', 'Avaliacao_Desempenho', 'Outros'
    ) OR document_type IS NULL
);

-- Create a view for required documents checklist
CREATE OR REPLACE VIEW vw_employee_documents_checklist AS
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    e.email,
    CASE WHEN d_cc.id IS NOT NULL THEN true ELSE false END as has_cc,
    CASE WHEN d_morada.id IS NOT NULL THEN true ELSE false END as has_comprovativo_morada,
    CASE WHEN d_iban.id IS NOT NULL THEN true ELSE false END as has_iban,
    CASE WHEN d_nif.id IS NOT NULL THEN true ELSE false END as has_nif,
    CASE WHEN d_niss.id IS NOT NULL THEN true ELSE false END as has_niss,
    CASE WHEN d_contrato.id IS NOT NULL THEN true ELSE false END as has_contrato,
    CASE WHEN d_irs.id IS NOT NULL THEN true ELSE false END as has_declaracao_irs,
    -- Count total required documents
    (
        CASE WHEN d_cc.id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN d_morada.id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN d_iban.id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN d_nif.id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN d_niss.id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN d_contrato.id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN d_irs.id IS NOT NULL THEN 1 ELSE 0 END
    ) as documents_submitted,
    7 as documents_required,
    CASE 
        WHEN (
            CASE WHEN d_cc.id IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN d_morada.id IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN d_iban.id IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN d_nif.id IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN d_niss.id IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN d_contrato.id IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN d_irs.id IS NOT NULL THEN 1 ELSE 0 END
        ) = 7 THEN true 
        ELSE false 
    END as all_documents_complete
FROM rh_employees e
LEFT JOIN rh_documents d_cc ON e.id = d_cc.employee_id AND d_cc.document_type = 'CC'
LEFT JOIN rh_documents d_morada ON e.id = d_morada.employee_id AND d_morada.document_type = 'Comprovativo_Morada'
LEFT JOIN rh_documents d_iban ON e.id = d_iban.employee_id AND d_iban.document_type = 'IBAN'
LEFT JOIN rh_documents d_nif ON e.id = d_nif.employee_id AND d_nif.document_type = 'NIF'
LEFT JOIN rh_documents d_niss ON e.id = d_niss.employee_id AND d_niss.document_type = 'NISS'
LEFT JOIN rh_documents d_contrato ON e.id = d_contrato.employee_id AND d_contrato.document_type = 'Contrato'
LEFT JOIN rh_documents d_irs ON e.id = d_irs.employee_id AND d_irs.document_type = 'Declaracao_IRS'
WHERE e.deleted_at IS NULL;

COMMENT ON VIEW vw_employee_documents_checklist IS 'Checklist de documentos obrigatórios por funcionário';
