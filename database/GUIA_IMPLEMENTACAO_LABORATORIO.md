# 🚀 Guia de Implementação - Sistema de Estoque Laboratório

## 📋 Checklist de Implementação

### Fase 1: Preparação do Banco de Dados ✅
- [ ] 1.1. Fazer backup do banco de dados atual
- [ ] 1.2. Revisar o arquivo `laboratorio-schema.sql`
- [ ] 1.3. Executar o schema no Supabase
- [ ] 1.4. Verificar criação de tabelas, triggers e views
- [ ] 1.5. Testar triggers manualmente

### Fase 2: Backend - API Endpoints 🔧
- [ ] 2.1. Criar endpoints de produtos
- [ ] 2.2. Criar endpoints de estoque
- [ ] 2.3. Criar endpoints de movimentações
- [ ] 2.4. Criar endpoints de custos
- [ ] 2.5. Criar endpoints de alertas
- [ ] 2.6. Implementar autenticação e permissões

### Fase 3: Frontend - Interface Web 🎨
- [ ] 3.1. Criar página de cadastro de produtos
- [ ] 3.2. Criar página de controle de estoque
- [ ] 3.3. Criar página de movimentações
- [ ] 3.4. Criar dashboard com alertas
- [ ] 3.5. Implementar leitor de QR Code/Código de Barras
- [ ] 3.6. Criar relatórios e consultas

### Fase 4: Testes e Ajustes 🧪
- [ ] 4.1. Testes de integração
- [ ] 4.2. Testes de performance
- [ ] 4.3. Testes de validação
- [ ] 4.4. Ajustes baseados em feedback

### Fase 5: Deploy e Treinamento 🎯
- [ ] 5.1. Deploy em produção
- [ ] 5.2. Treinamento dos usuários
- [ ] 5.3. Documentação de uso
- [ ] 5.4. Suporte inicial

---

## 1️⃣ EXECUTAR O SCHEMA NO SUPABASE

### Passo 1: Acessar o Supabase
1. Ir para [https://supabase.com](https://supabase.com)
2. Selecionar seu projeto
3. Ir em **SQL Editor**

### Passo 2: Executar o Script
1. Abrir o arquivo `database/laboratorio-schema.sql`
2. Copiar todo o conteúdo
3. Colar no SQL Editor do Supabase
4. Clicar em **Run** ou pressionar `Ctrl+Enter`

### Passo 3: Verificar Criação
Execute as queries de verificação:

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%laboratorio%'
ORDER BY table_name;

-- Resultado esperado:
-- alertaslaboratorio
-- custoslaboratorio
-- estoquelaboratorio
-- movimentacoeslaboratorio
-- produtoslaboratorio

-- Verificar triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND event_object_table LIKE '%laboratorio%'
ORDER BY event_object_table, trigger_name;

-- Verificar views
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
  AND table_name LIKE 'vw_%'
ORDER BY table_name;

-- Verificar funções
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

---

## 2️⃣ TESTAR OS TRIGGERS

### Teste 1: Criar um Produto e Verificar QR Code

```sql
-- Inserir produto
INSERT INTO produtoslaboratorio (
    categoria, 
    nome_material, 
    marca, 
    fornecedor,
    unidade_medida,
    localizacao,
    criado_por
) VALUES (
    'resinas',
    'Resina Acrílica Autopolimerizável',
    'Vipi',
    'DentalSupply',
    'g',
    'Armário A - Prateleira 2',
    (SELECT id FROM user_profiles LIMIT 1) -- Usar um usuário existente
)
RETURNING id, qr_code;

-- Verificar se QR Code foi gerado automaticamente
```

### Teste 2: Criar Estoque e Verificar Status

```sql
-- Criar registro de estoque
INSERT INTO estoquelaboratorio (
    produto_id,
    quantidade_atual,
    quantidade_minima,
    quantidade_maxima
) VALUES (
    '<UUID_DO_PRODUTO_CRIADO>', -- Substituir pelo ID do teste 1
    100,
    20,
    200
)
RETURNING id, status;

-- Status esperado: 'ok'
```

### Teste 3: Movimentação e Atualização Automática

```sql
-- Registrar uma saída
INSERT INTO movimentacoeslaboratorio (
    produto_id,
    tipo_movimento,
    quantidade,
    responsavel_id,
    responsavel_nome,
    caso_clinico,
    setor,
    motivo
) VALUES (
    '<UUID_DO_PRODUTO>',
    'saida',
    50,
    (SELECT id FROM user_profiles LIMIT 1),
    (SELECT full_name FROM user_profiles LIMIT 1),
    'OS-2025-001',
    'Prótese Total',
    'Confecção de prótese dentária'
)
RETURNING id, quantidade_anterior, quantidade_nova;

-- Verificar se quantidade foi atualizada
SELECT quantidade_atual, status 
FROM estoquelaboratorio 
WHERE produto_id = '<UUID_DO_PRODUTO>';

-- quantidade_atual esperado: 50
-- status esperado: 'ok' (se ainda acima do mínimo)
```

### Teste 4: Alerta de Estoque Mínimo

```sql
-- Fazer mais uma saída para ficar abaixo do mínimo
INSERT INTO movimentacoeslaboratorio (
    produto_id,
    tipo_movimento,
    quantidade,
    responsavel_id,
    responsavel_nome,
    motivo
) VALUES (
    '<UUID_DO_PRODUTO>',
    'saida',
    35,
    (SELECT id FROM user_profiles LIMIT 1),
    (SELECT full_name FROM user_profiles LIMIT 1),
    'Teste de alerta'
);

-- Verificar status (deve mudar para 'alerta')
SELECT quantidade_atual, quantidade_minima, status 
FROM estoquelaboratorio 
WHERE produto_id = '<UUID_DO_PRODUTO>';

-- Verificar se alerta foi criado
SELECT * FROM alertaslaboratorio 
WHERE produto_id = '<UUID_DO_PRODUTO>'
ORDER BY data_alerta DESC
LIMIT 1;
```

### Teste 5: Views

```sql
-- Testar view de produtos com estoque
SELECT * FROM vw_produtos_estoque LIMIT 5;

-- Testar view de alertas ativos
SELECT * FROM vw_alertas_ativos;

-- Testar view de movimentações detalhadas
SELECT * FROM vw_movimentacoes_detalhadas 
ORDER BY data_movimento DESC 
LIMIT 10;
```

### Teste 6: Função de Valor do Estoque

```sql
-- Primeiro, adicionar um custo
INSERT INTO custoslaboratorio (
    produto_id,
    preco_unitario,
    quantidade_comprada,
    data_compra,
    fornecedor,
    criado_por
) VALUES (
    '<UUID_DO_PRODUTO>',
    15.50,
    100,
    CURRENT_DATE,
    'DentalSupply',
    (SELECT id FROM user_profiles LIMIT 1)
);

-- Calcular valor do estoque
SELECT * FROM calcular_valor_estoque();
```

---

## 3️⃣ ESTRUTURA DE API ENDPOINTS

### Produtos

```javascript
// GET /api/laboratorio/produtos
// GET /api/laboratorio/produtos/:id
// POST /api/laboratorio/produtos
// PUT /api/laboratorio/produtos/:id
// DELETE /api/laboratorio/produtos/:id (soft delete)
// GET /api/laboratorio/produtos/qrcode/:qrcode
// GET /api/laboratorio/produtos/barcode/:barcode
```

### Estoque

```javascript
// GET /api/laboratorio/estoque
// GET /api/laboratorio/estoque/:produto_id
// PUT /api/laboratorio/estoque/:produto_id
// GET /api/laboratorio/estoque/alertas
// GET /api/laboratorio/estoque/criticos
```

### Movimentações

```javascript
// GET /api/laboratorio/movimentacoes
// GET /api/laboratorio/movimentacoes/:id
// POST /api/laboratorio/movimentacoes/entrada
// POST /api/laboratorio/movimentacoes/saida
// POST /api/laboratorio/movimentacoes/ajuste
// GET /api/laboratorio/movimentacoes/produto/:produto_id
// GET /api/laboratorio/movimentacoes/caso/:caso_clinico
```

### Custos

```javascript
// GET /api/laboratorio/custos
// GET /api/laboratorio/custos/:id
// POST /api/laboratorio/custos
// PUT /api/laboratorio/custos/:id
// GET /api/laboratorio/custos/produto/:produto_id
```

### Alertas

```javascript
// GET /api/laboratorio/alertas
// GET /api/laboratorio/alertas/ativos
// PUT /api/laboratorio/alertas/:id/visualizar
// PUT /api/laboratorio/alertas/:id/resolver
```

### Relatórios

```javascript
// GET /api/laboratorio/relatorios/valor-estoque
// GET /api/laboratorio/relatorios/movimentacoes-periodo
// GET /api/laboratorio/relatorios/consumo-responsavel
// GET /api/laboratorio/relatorios/consumo-caso
```

---

## 4️⃣ EXEMPLO DE IMPLEMENTAÇÃO - API

### Exemplo: POST /api/laboratorio/produtos

```javascript
app.post('/api/laboratorio/produtos', authMiddleware, async (req, res) => {
  try {
    const {
      codigo_barras,
      categoria,
      nome_material,
      marca,
      fornecedor,
      referencia_lote,
      unidade_medida,
      localizacao,
      data_validade,
      descricao,
      observacoes,
      quantidade_inicial,
      quantidade_minima,
      quantidade_maxima
    } = req.body;

    // Validações
    if (!categoria || !nome_material || !unidade_medida) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: categoria, nome_material, unidade_medida' 
      });
    }

    const userId = req.user.id;

    // Inserir produto
    const { data: produto, error: produtoError } = await supabase
      .from('produtoslaboratorio')
      .insert({
        codigo_barras,
        categoria,
        nome_material,
        marca,
        fornecedor,
        referencia_lote,
        unidade_medida,
        localizacao,
        data_validade,
        descricao,
        observacoes,
        criado_por: userId,
        atualizado_por: userId
      })
      .select()
      .single();

    if (produtoError) throw produtoError;

    // Se quantidade inicial fornecida, criar registro de estoque
    if (quantidade_inicial !== undefined) {
      const { error: estoqueError } = await supabase
        .from('estoquelaboratorio')
        .insert({
          produto_id: produto.id,
          quantidade_atual: quantidade_inicial,
          quantidade_minima: quantidade_minima || 0,
          quantidade_maxima: quantidade_maxima || null,
          atualizado_por: userId
        });

      if (estoqueError) throw estoqueError;

      // Registrar movimentação de entrada inicial
      if (quantidade_inicial > 0) {
        await supabase
          .from('movimentacoeslaboratorio')
          .insert({
            produto_id: produto.id,
            tipo_movimento: 'entrada',
            quantidade: quantidade_inicial,
            responsavel_id: userId,
            responsavel_nome: req.user.full_name,
            motivo: 'Estoque inicial',
            criado_por: userId
          });
      }
    }

    res.json({ 
      success: true, 
      data: produto 
    });

  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ 
      error: 'Erro ao criar produto',
      details: error.message 
    });
  }
});
```

### Exemplo: POST /api/laboratorio/movimentacoes/saida

```javascript
app.post('/api/laboratorio/movimentacoes/saida', authMiddleware, async (req, res) => {
  try {
    const {
      produto_id,
      qr_code,
      codigo_barras,
      quantidade,
      caso_clinico,
      paciente,
      setor,
      motivo,
      observacoes
    } = req.body;

    // Validações
    if (!quantidade || quantidade <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
    }

    const userId = req.user.id;
    let produtoId = produto_id;

    // Se forneceu QR Code ou código de barras, buscar produto
    if (!produtoId && (qr_code || codigo_barras)) {
      const query = supabase
        .from('produtoslaboratorio')
        .select('id')
        .is('deleted_at', null);

      if (qr_code) query.eq('qr_code', qr_code);
      else query.eq('codigo_barras', codigo_barras);

      const { data: produto, error: produtoError } = await query.single();
      
      if (produtoError || !produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      produtoId = produto.id;
    }

    if (!produtoId) {
      return res.status(400).json({ 
        error: 'É necessário informar produto_id, qr_code ou codigo_barras' 
      });
    }

    // Verificar estoque disponível
    const { data: estoque } = await supabase
      .from('estoquelaboratorio')
      .select('quantidade_atual')
      .eq('produto_id', produtoId)
      .single();

    if (!estoque || estoque.quantidade_atual < quantidade) {
      return res.status(400).json({ 
        error: 'Estoque insuficiente',
        disponivel: estoque?.quantidade_atual || 0,
        solicitado: quantidade
      });
    }

    // Registrar movimentação (trigger atualiza estoque automaticamente)
    const { data: movimentacao, error: movError } = await supabase
      .from('movimentacoeslaboratorio')
      .insert({
        produto_id: produtoId,
        tipo_movimento: 'saida',
        quantidade,
        responsavel_id: userId,
        responsavel_nome: req.user.full_name,
        caso_clinico,
        paciente,
        setor,
        motivo,
        observacoes,
        criado_por: userId
      })
      .select()
      .single();

    if (movError) throw movError;

    res.json({ 
      success: true, 
      data: movimentacao 
    });

  } catch (error) {
    console.error('Erro ao registrar saída:', error);
    res.status(500).json({ 
      error: 'Erro ao registrar saída',
      details: error.message 
    });
  }
});
```

---

## 5️⃣ PÁGINAS FRONTEND NECESSÁRIAS

### 1. Cadastro de Produtos (`laboratorio-produtos.html`)
- Formulário de cadastro
- Lista de produtos
- Busca e filtros
- Edição e visualização

### 2. Controle de Estoque (`laboratorio-estoque.html`)
- Dashboard com status geral
- Lista de produtos com estoque
- Indicadores visuais (cores para status)
- Ações rápidas (entrada/saída)

### 3. Movimentações (`laboratorio-movimentacoes.html`)
- Registro de entrada
- Registro de saída
- Histórico de movimentações
- Leitor de QR Code / Código de Barras
- Filtros por data, produto, responsável, caso clínico

### 4. Alertas (`laboratorio-alertas.html`)
- Dashboard de alertas
- Alertas por prioridade
- Ações de visualizar/resolver
- Notificações

### 5. Relatórios (`laboratorio-relatorios.html`)
- Valor total do estoque
- Consumo por período
- Consumo por responsável
- Consumo por caso clínico
- Produtos mais utilizados
- Histórico de compras
- Gráficos e exportação

---

## 📝 NOTAS IMPORTANTES

### Soft Delete
Todas as exclusões são "soft delete" - os registros não são removidos, apenas marcados com `deleted_at`. Para consultas, sempre filtrar:
```sql
WHERE deleted_at IS NULL
```

### Permissões
Ajustar as políticas RLS conforme necessário:
- Todos podem ler
- Apenas certos roles podem criar/editar
- Apenas admins podem excluir

### Performance
Os índices já estão criados, mas monitore:
- Queries lentas
- Quantidade de registros em movimentações
- Considere arquivamento após 1-2 anos

### Backup
Fazer backup regular, especialmente antes de:
- Mudanças no schema
- Atualizações de triggers
- Deploy de novas versões

---

**Criado em:** 20/10/2025  
**Versão:** 1.0

