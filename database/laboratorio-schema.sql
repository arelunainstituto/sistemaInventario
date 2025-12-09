-- =====================================================
-- 🧩 SISTEMA DE ESTOQUE - LABORATÓRIO DE PRÓTESE
-- =====================================================
-- Versão otimizada com triggers, índices e RLS
-- Data: 2025-10-20
-- =====================================================

-- =====================================================
-- 1. TABELA: produtoslaboratorio
-- =====================================================
-- Cadastro base de cada item do estoque
CREATE TABLE IF NOT EXISTS produtoslaboratorio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_code TEXT UNIQUE, -- Gerado automaticamente pelo trigger
    codigo_barras TEXT,
    
    -- Informações do produto
    categoria TEXT NOT NULL CHECK (categoria IN (
        'resinas', 'ceras', 'metais', 'gesso', 'silicone', 
        'ceramica', 'acrilico', 'instrumentos', 'equipamentos', 
        'consumiveis', 'outros'
    )),
    nome_material TEXT NOT NULL,
    marca TEXT,
    fornecedor TEXT,
    referencia_lote TEXT,
    
    -- Medidas e localização
    unidade_medida TEXT NOT NULL CHECK (unidade_medida IN (
        'g', 'kg', 'ml', 'l', 'un', 'barra', 'frasco', 
        'caixa', 'embalagem', 'metro', 'outro'
    )),
    localizacao TEXT, -- Gaveta, prateleira, armário, setor
    
    -- Datas e validade
    data_validade DATE,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Status e auditoria
    ativo BOOLEAN DEFAULT TRUE,
    criado_por UUID REFERENCES user_profiles(id),
    atualizado_por UUID REFERENCES user_profiles(id),
    
    -- Observações
    descricao TEXT,
    observacoes TEXT,
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Índices para busca
    CONSTRAINT nome_material_not_empty CHECK (LENGTH(TRIM(nome_material)) > 0)
);

-- Índices para performance
CREATE INDEX idx_produtos_categoria ON produtoslaboratorio(categoria) WHERE deleted_at IS NULL;
CREATE INDEX idx_produtos_nome ON produtoslaboratorio(nome_material) WHERE deleted_at IS NULL;
CREATE INDEX idx_produtos_qr_code ON produtoslaboratorio(qr_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_produtos_codigo_barras ON produtoslaboratorio(codigo_barras) WHERE codigo_barras IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_produtos_ativo ON produtoslaboratorio(ativo) WHERE deleted_at IS NULL;
CREATE INDEX idx_produtos_fornecedor ON produtoslaboratorio(fornecedor) WHERE deleted_at IS NULL;

-- Comentários
COMMENT ON TABLE produtoslaboratorio IS 'Cadastro base de produtos do laboratório de prótese';
COMMENT ON COLUMN produtoslaboratorio.qr_code IS 'QR Code único gerado automaticamente a partir do UUID';
COMMENT ON COLUMN produtoslaboratorio.codigo_barras IS 'Código de barras físico do produto (opcional)';

-- =====================================================
-- 2. TABELA: estoquelaboratorio
-- =====================================================
-- Controla a quantidade e status de cada produto
CREATE TABLE IF NOT EXISTS estoquelaboratorio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES produtoslaboratorio(id) ON DELETE CASCADE,
    
    -- Quantidades
    quantidade_atual NUMERIC(10,2) DEFAULT 0 CHECK (quantidade_atual >= 0),
    quantidade_minima NUMERIC(10,2) DEFAULT 0 CHECK (quantidade_minima >= 0),
    quantidade_maxima NUMERIC(10,2) CHECK (quantidade_maxima IS NULL OR quantidade_maxima >= quantidade_minima),
    
    -- Status calculado automaticamente pelo trigger
    status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'alerta', 'critico', 'vencido', 'vencendo')),
    
    -- Datas
    ultima_entrada TIMESTAMP WITH TIME ZONE,
    ultima_saida TIMESTAMP WITH TIME ZONE,
    ultima_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Localização específica do lote
    localizacao_especifica TEXT,
    lote_atual TEXT,
    
    -- Auditoria
    atualizado_por UUID REFERENCES user_profiles(id),
    
    -- Constraint: um produto só pode ter um registro de estoque ativo
    CONSTRAINT estoque_produto_unico UNIQUE (produto_id)
);

-- Índices
CREATE INDEX idx_estoque_produto ON estoquelaboratorio(produto_id);
CREATE INDEX idx_estoque_status ON estoquelaboratorio(status);
CREATE INDEX idx_estoque_quantidade ON estoquelaboratorio(quantidade_atual);

COMMENT ON TABLE estoquelaboratorio IS 'Controle de quantidades e status de estoque';
COMMENT ON COLUMN estoquelaboratorio.status IS 'Status calculado: ok, alerta (abaixo do mínimo), critico (zerado), vencido, vencendo';

-- =====================================================
-- 3. TABELA: movimentacoeslaboratorio
-- =====================================================
-- Registra todas as entradas e saídas do estoque
CREATE TABLE IF NOT EXISTS movimentacoeslaboratorio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES produtoslaboratorio(id) ON DELETE RESTRICT,
    
    -- Tipo de movimentação
    tipo_movimento TEXT NOT NULL CHECK (tipo_movimento IN ('entrada', 'saida', 'ajuste', 'perda', 'transferencia')),
    quantidade NUMERIC(10,2) NOT NULL CHECK (quantidade > 0),
    
    -- Saldos (para auditoria)
    quantidade_anterior NUMERIC(10,2),
    quantidade_nova NUMERIC(10,2),
    
    -- Responsável e contexto
    responsavel_id UUID NOT NULL REFERENCES user_profiles(id),
    responsavel_nome TEXT, -- Desnormalizado para histórico
    
    -- Informações de trabalho
    caso_clinico TEXT, -- Número do caso/OS
    paciente TEXT, -- Nome do paciente (opcional)
    setor TEXT, -- Setor do laboratório
    
    -- Motivo e observações
    motivo TEXT, -- Ex: "Nova compra", "Utilização em prótese", "Ajuste de inventário"
    observacoes TEXT,
    
    -- Compra (se for entrada)
    numero_pedido TEXT,
    fornecedor TEXT,
    preco_unitario NUMERIC(10,2),
    preco_total NUMERIC(10,2),
    
    -- Data
    data_movimento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Auditoria
    criado_por UUID REFERENCES user_profiles(id),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX idx_movimentacoes_produto ON movimentacoeslaboratorio(produto_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_movimentacoes_tipo ON movimentacoeslaboratorio(tipo_movimento) WHERE deleted_at IS NULL;
CREATE INDEX idx_movimentacoes_responsavel ON movimentacoeslaboratorio(responsavel_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_movimentacoes_data ON movimentacoeslaboratorio(data_movimento DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_movimentacoes_caso_clinico ON movimentacoeslaboratorio(caso_clinico) WHERE caso_clinico IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE movimentacoeslaboratorio IS 'Histórico completo de movimentações de estoque';
COMMENT ON COLUMN movimentacoeslaboratorio.tipo_movimento IS 'entrada, saida, ajuste, perda, transferencia';

-- =====================================================
-- 4. TABELA: custoslaboratorio (ESTRUTURA REAL DO BANCO)
-- =====================================================
-- Gerencia custos de movimentações de entrada
-- NOTA: Esta é a estrutura REAL que existe no Supabase
CREATE TABLE IF NOT EXISTS custoslaboratorio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES produtoslaboratorio(id) ON DELETE CASCADE,
    movimentacao_id UUID REFERENCES movimentacoeslaboratorio(id),
    
    -- Valores
    custo_unitario NUMERIC(10,2) NOT NULL CHECK (custo_unitario >= 0),
    quantidade NUMERIC(10,2) NOT NULL CHECK (quantidade > 0),
    custo_total NUMERIC(10,2) GENERATED ALWAYS AS (custo_unitario * quantidade) STORED,
    
    -- Data e auditoria
    data_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    registrado_por UUID REFERENCES profiles(id)
);

-- Índices
CREATE INDEX idx_custos_produto ON custoslaboratorio(produto_id);
CREATE INDEX idx_custos_data_registro ON custoslaboratorio(data_registro DESC);
CREATE INDEX idx_custos_movimentacao ON custoslaboratorio(movimentacao_id);

COMMENT ON TABLE custoslaboratorio IS 'Registro de custos associados a movimentações de entrada';
COMMENT ON COLUMN custoslaboratorio.custo_total IS 'Calculado automaticamente: custo_unitario * quantidade';

-- =====================================================
-- 5. TABELA: alertaslaboratorio
-- =====================================================
-- Sistema de alertas e notificações
CREATE TABLE IF NOT EXISTS alertaslaboratorio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID REFERENCES produtoslaboratorio(id) ON DELETE CASCADE,
    
    -- Tipo de alerta
    tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN (
        'estoque_minimo', 'estoque_critico', 'vencimento_proximo', 
        'vencido', 'sem_estoque', 'outro'
    )),
    
    -- Informações
    mensagem TEXT NOT NULL,
    prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
    
    -- Status
    visualizado BOOLEAN DEFAULT FALSE,
    resolvido BOOLEAN DEFAULT FALSE,
    
    -- Datas
    data_alerta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_visualizado TIMESTAMP WITH TIME ZONE,
    data_resolvido TIMESTAMP WITH TIME ZONE,
    
    -- Responsável
    visualizado_por UUID REFERENCES user_profiles(id),
    resolvido_por UUID REFERENCES user_profiles(id),
    
    -- Observações
    observacoes TEXT
);

-- Índices
CREATE INDEX idx_alertas_produto ON alertaslaboratorio(produto_id);
CREATE INDEX idx_alertas_tipo ON alertaslaboratorio(tipo_alerta);
CREATE INDEX idx_alertas_nao_resolvidos ON alertaslaboratorio(resolvido) WHERE resolvido = FALSE;
CREATE INDEX idx_alertas_prioridade ON alertaslaboratorio(prioridade, data_alerta DESC);

COMMENT ON TABLE alertaslaboratorio IS 'Sistema de alertas e notificações de estoque';

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Trigger para gerar QR Code automaticamente
CREATE OR REPLACE FUNCTION gerar_qr_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qr_code IS NULL THEN
        NEW.qr_code := NEW.id::TEXT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gerar_qr_code
    BEFORE INSERT ON produtoslaboratorio
    FOR EACH ROW
    EXECUTE FUNCTION gerar_qr_code();

-- Trigger para atualizar data_atualizacao
CREATE OR REPLACE FUNCTION atualizar_data_atualizacao()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_produto
    BEFORE UPDATE ON produtoslaboratorio
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_data_atualizacao();

-- Trigger para atualizar estoque após movimentação
CREATE OR REPLACE FUNCTION atualizar_estoque_apos_movimentacao()
RETURNS TRIGGER AS $$
DECLARE
    v_quantidade_anterior NUMERIC(10,2);
    v_quantidade_nova NUMERIC(10,2);
BEGIN
    -- Buscar quantidade atual
    SELECT quantidade_atual INTO v_quantidade_anterior
    FROM estoquelaboratorio
    WHERE produto_id = NEW.produto_id;
    
    -- Se não existe registro de estoque, criar
    IF v_quantidade_anterior IS NULL THEN
        INSERT INTO estoquelaboratorio (produto_id, quantidade_atual, atualizado_por)
        VALUES (NEW.produto_id, 0, NEW.responsavel_id);
        v_quantidade_anterior := 0;
    END IF;
    
    -- Calcular nova quantidade
    IF NEW.tipo_movimento IN ('entrada', 'ajuste') THEN
        v_quantidade_nova := v_quantidade_anterior + NEW.quantidade;
    ELSIF NEW.tipo_movimento IN ('saida', 'perda') THEN
        v_quantidade_nova := v_quantidade_anterior - NEW.quantidade;
        IF v_quantidade_nova < 0 THEN
            v_quantidade_nova := 0; -- Não permitir estoque negativo
        END IF;
    ELSE
        v_quantidade_nova := v_quantidade_anterior;
    END IF;
    
    -- Atualizar registro de movimentação com os saldos
    NEW.quantidade_anterior := v_quantidade_anterior;
    NEW.quantidade_nova := v_quantidade_nova;
    
    -- Atualizar estoque
    UPDATE estoquelaboratorio
    SET 
        quantidade_atual = v_quantidade_nova,
        ultima_atualizacao = NOW(),
        atualizado_por = NEW.responsavel_id,
        ultima_entrada = CASE WHEN NEW.tipo_movimento = 'entrada' THEN NOW() ELSE ultima_entrada END,
        ultima_saida = CASE WHEN NEW.tipo_movimento = 'saida' THEN NOW() ELSE ultima_saida END
    WHERE produto_id = NEW.produto_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_estoque
    BEFORE INSERT ON movimentacoeslaboratorio
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_estoque_apos_movimentacao();

-- Trigger para atualizar status do estoque
CREATE OR REPLACE FUNCTION atualizar_status_estoque()
RETURNS TRIGGER AS $$
DECLARE
    v_produto_validade DATE;
    v_novo_status TEXT;
BEGIN
    -- Buscar data de validade do produto
    SELECT data_validade INTO v_produto_validade
    FROM produtoslaboratorio
    WHERE id = NEW.produto_id;
    
    -- Determinar status
    IF v_produto_validade IS NOT NULL AND v_produto_validade < CURRENT_DATE THEN
        v_novo_status := 'vencido';
    ELSIF v_produto_validade IS NOT NULL AND v_produto_validade <= CURRENT_DATE + INTERVAL '30 days' THEN
        v_novo_status := 'vencendo';
    ELSIF NEW.quantidade_atual = 0 THEN
        v_novo_status := 'critico';
    ELSIF NEW.quantidade_minima > 0 AND NEW.quantidade_atual <= NEW.quantidade_minima THEN
        v_novo_status := 'alerta';
    ELSE
        v_novo_status := 'ok';
    END IF;
    
    NEW.status := v_novo_status;
    
    -- Gerar alerta se necessário
    IF v_novo_status IN ('critico', 'alerta', 'vencido', 'vencendo') THEN
        INSERT INTO alertaslaboratorio (produto_id, tipo_alerta, mensagem, prioridade)
        VALUES (
            NEW.produto_id,
            CASE 
                WHEN v_novo_status = 'vencido' THEN 'vencido'
                WHEN v_novo_status = 'vencendo' THEN 'vencimento_proximo'
                WHEN v_novo_status = 'critico' THEN 'sem_estoque'
                ELSE 'estoque_minimo'
            END,
            CASE 
                WHEN v_novo_status = 'vencido' THEN 'Produto vencido'
                WHEN v_novo_status = 'vencendo' THEN 'Produto próximo do vencimento'
                WHEN v_novo_status = 'critico' THEN 'Produto sem estoque'
                ELSE 'Estoque abaixo do mínimo'
            END,
            CASE 
                WHEN v_novo_status IN ('vencido', 'critico') THEN 'urgente'
                WHEN v_novo_status = 'vencendo' THEN 'alta'
                ELSE 'media'
            END
        )
        ON CONFLICT DO NOTHING; -- Evitar duplicatas
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_status
    BEFORE INSERT OR UPDATE ON estoquelaboratorio
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_status_estoque();

-- =====================================================
-- 7. VIEWS ÚTEIS
-- =====================================================

-- View: produtos com estoque
CREATE OR REPLACE VIEW vw_produtos_estoque AS
SELECT 
    p.id,
    p.qr_code,
    p.codigo_barras,
    p.categoria,
    p.nome_material,
    p.marca,
    p.fornecedor,
    p.referencia_lote,
    p.unidade_medida,
    p.localizacao,
    p.data_validade,
    p.descricao,
    p.observacoes,
    p.ativo,
    COALESCE(e.quantidade_atual, 0) AS quantidade_atual,
    COALESCE(e.quantidade_minima, 0) AS quantidade_minima,
    COALESCE(e.quantidade_maxima, 0) AS quantidade_maxima,
    COALESCE(e.status, 'ok') AS status,
    e.ultima_entrada,
    e.ultima_saida,
    e.ultima_atualizacao,
    (
        SELECT AVG(c.preco_unitario)
        FROM custoslaboratorio c
        WHERE c.produto_id = p.id
        AND c.deleted_at IS NULL 
        AND c.ativo = TRUE
    ) AS custo_medio_unitario,
    (
        SELECT c.preco_unitario
        FROM custoslaboratorio c
        WHERE c.produto_id = p.id
        AND c.deleted_at IS NULL 
        AND c.ativo = TRUE
        ORDER BY c.data_compra DESC
        LIMIT 1
    ) AS custo_unitario
FROM produtoslaboratorio p
LEFT JOIN estoquelaboratorio e ON p.id = e.produto_id
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW vw_produtos_estoque IS 'View consolidada de produtos com informações de estoque';

-- View: alertas ativos
CREATE OR REPLACE VIEW vw_alertas_ativos AS
SELECT 
    a.id,
    a.tipo_alerta,
    a.mensagem,
    a.prioridade,
    a.data_alerta,
    p.nome_material,
    p.categoria,
    e.quantidade_atual,
    e.quantidade_minima,
    p.data_validade
FROM alertaslaboratorio a
JOIN produtoslaboratorio p ON a.produto_id = p.id
LEFT JOIN estoquelaboratorio e ON p.id = e.produto_id
WHERE a.resolvido = FALSE
ORDER BY 
    CASE a.prioridade
        WHEN 'urgente' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'media' THEN 3
        ELSE 4
    END,
    a.data_alerta DESC;

COMMENT ON VIEW vw_alertas_ativos IS 'View de alertas não resolvidos ordenados por prioridade';

-- View: movimentações com detalhes
CREATE OR REPLACE VIEW vw_movimentacoes_detalhadas AS
SELECT 
    m.id,
    m.tipo_movimento,
    m.quantidade,
    m.quantidade_anterior,
    m.quantidade_nova,
    m.data_movimento,
    p.nome_material,
    p.categoria,
    p.unidade_medida,
    u.full_name AS responsavel_nome,
    m.caso_clinico,
    m.setor,
    m.motivo,
    m.observacoes
FROM movimentacoeslaboratorio m
JOIN produtoslaboratorio p ON m.produto_id = p.id
JOIN user_profiles u ON m.responsavel_id = u.id
WHERE m.deleted_at IS NULL
ORDER BY m.data_movimento DESC;

COMMENT ON VIEW vw_movimentacoes_detalhadas IS 'View de movimentações com informações completas';

-- =====================================================
-- 8. FUNÇÕES ÚTEIS
-- =====================================================

-- Função para obter valor do estoque
CREATE OR REPLACE FUNCTION calcular_valor_estoque(p_produto_id UUID DEFAULT NULL)
RETURNS TABLE (
    produto_id UUID,
    nome_material TEXT,
    quantidade_atual NUMERIC,
    preco_unitario_medio NUMERIC,
    valor_total NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS produto_id,
        p.nome_material,
        COALESCE(e.quantidade_atual, 0) AS quantidade_atual,
        COALESCE(AVG(c.preco_unitario), 0) AS preco_unitario_medio,
        COALESCE(e.quantidade_atual, 0) * COALESCE(AVG(c.preco_unitario), 0) AS valor_total
    FROM produtoslaboratorio p
    LEFT JOIN estoquelaboratorio e ON p.id = e.produto_id
    LEFT JOIN custoslaboratorio c ON p.id = c.produto_id AND c.ativo = TRUE AND c.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
        AND (p_produto_id IS NULL OR p.id = p_produto_id)
    GROUP BY p.id, p.nome_material, e.quantidade_atual;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_valor_estoque IS 'Calcula o valor total do estoque baseado no preço médio de compra';

-- =====================================================
-- 9. RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE produtoslaboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoquelaboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoeslaboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE custoslaboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertaslaboratorio ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (exemplo básico - ajustar conforme necessário)
-- Todos os usuários autenticados podem ler
CREATE POLICY "Usuários podem ler produtos"
    ON produtoslaboratorio FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem ler estoque"
    ON estoquelaboratorio FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem ler movimentações"
    ON movimentacoeslaboratorio FOR SELECT
    USING (auth.role() = 'authenticated');

-- Apenas administradores podem inserir/atualizar produtos
-- (ajustar conforme o sistema de roles que você usar)

-- =====================================================
-- 10. DADOS INICIAIS (SEED)
-- =====================================================

-- Inserir categorias padrão de produtos
-- (Isso é opcional - as categorias já estão no CHECK constraint)

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================

-- Para verificar a instalação, execute:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%laboratorio%';

