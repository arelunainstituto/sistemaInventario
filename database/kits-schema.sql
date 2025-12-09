-- ============================================
-- SCHEMA PARA KITS DE PROCEDIMENTOS
-- ============================================

-- Tabela de Kits
CREATE TABLE IF NOT EXISTS kits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('zirconia', 'dissilicato', 'hibrida', 'provisoria', 'outro')),
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabela de Produtos dos Kits (relação many-to-many)
CREATE TABLE IF NOT EXISTS kit_produtos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES laboratorio_produtos(id) ON DELETE CASCADE,
    quantidade DECIMAL(10, 2) NOT NULL CHECK (quantidade > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(kit_id, produto_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_kits_tipo ON kits(tipo);
CREATE INDEX IF NOT EXISTS idx_kits_created_at ON kits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kit_produtos_kit_id ON kit_produtos(kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_produtos_produto_id ON kit_produtos(produto_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_kits_updated_at 
    BEFORE UPDATE ON kits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) Policies
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_produtos ENABLE ROW LEVEL SECURITY;

-- Política: Todos os usuários autenticados podem ler kits
CREATE POLICY "Usuários autenticados podem ler kits" 
    ON kits FOR SELECT 
    TO authenticated 
    USING (true);

-- Política: Usuários autenticados podem criar kits
CREATE POLICY "Usuários autenticados podem criar kits" 
    ON kits FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Política: Usuários autenticados podem atualizar kits
CREATE POLICY "Usuários autenticados podem atualizar kits" 
    ON kits FOR UPDATE 
    TO authenticated 
    USING (true);

-- Política: Usuários autenticados podem deletar kits
CREATE POLICY "Usuários autenticados podem deletar kits" 
    ON kits FOR DELETE 
    TO authenticated 
    USING (true);

-- Política: Todos os usuários autenticados podem ler produtos dos kits
CREATE POLICY "Usuários autenticados podem ler kit_produtos" 
    ON kit_produtos FOR SELECT 
    TO authenticated 
    USING (true);

-- Política: Usuários autenticados podem criar produtos nos kits
CREATE POLICY "Usuários autenticados podem criar kit_produtos" 
    ON kit_produtos FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Política: Usuários autenticados podem atualizar produtos dos kits
CREATE POLICY "Usuários autenticados podem atualizar kit_produtos" 
    ON kit_produtos FOR UPDATE 
    TO authenticated 
    USING (true);

-- Política: Usuários autenticados podem deletar produtos dos kits
CREATE POLICY "Usuários autenticados podem deletar kit_produtos" 
    ON kit_produtos FOR DELETE 
    TO authenticated 
    USING (true);

-- Comentários nas tabelas
COMMENT ON TABLE kits IS 'Tabela de kits de procedimentos odontológicos';
COMMENT ON TABLE kit_produtos IS 'Tabela de relação entre kits e produtos do estoque';

COMMENT ON COLUMN kits.nome IS 'Nome identificador do kit';
COMMENT ON COLUMN kits.tipo IS 'Tipo de procedimento: zirconia, dissilicato, hibrida, provisoria, outro';
COMMENT ON COLUMN kits.descricao IS 'Descrição detalhada do kit e sua finalidade';

COMMENT ON COLUMN kit_produtos.kit_id IS 'Referência ao kit';
COMMENT ON COLUMN kit_produtos.produto_id IS 'Referência ao produto do estoque';
COMMENT ON COLUMN kit_produtos.quantidade IS 'Quantidade necessária do produto para este kit';

