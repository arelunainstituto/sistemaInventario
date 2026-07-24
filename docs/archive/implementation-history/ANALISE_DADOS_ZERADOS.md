# 🔍 Análise: Dados de Custo Zerados

## 🚨 Problema Encontrado

Os campos de custo unitário continuavam retornando valores nulos/zerados mesmo após a primeira tentativa de correção.

## 🎯 Causa Raiz Identificada

A view `vw_produtos_estoque` estava tentando buscar dados de **campos que NÃO EXISTEM** na tabela `custoslaboratorio`.

### ❌ Campos Incorretos (Usados na View)
```sql
-- ERRADO:
SELECT c.custo_unitario    -- ❌ Este campo NÃO existe
FROM custoslaboratorio c
ORDER BY c.data_registro   -- ❌ Este campo NÃO existe
```

### ✅ Campos Corretos (Existem na Tabela)
```sql
-- CORRETO:
SELECT c.preco_unitario    -- ✅ Este é o campo correto
FROM custoslaboratorio c
ORDER BY c.data_compra     -- ✅ Este é o campo correto
```

## 📋 Estrutura Real da Tabela `custoslaboratorio`

De acordo com o schema em `database/laboratorio-schema.sql` (linhas 166-200):

```sql
CREATE TABLE custoslaboratorio (
    id UUID PRIMARY KEY,
    produto_id UUID NOT NULL,
    
    -- ✅ CAMPOS QUE EXISTEM:
    preco_unitario NUMERIC(10,2) NOT NULL,     -- ✅ Não custo_unitario
    quantidade_comprada NUMERIC(10,2) NOT NULL,
    custo_total NUMERIC(10,2) GENERATED,       -- Calculado: preco_unitario * quantidade
    
    -- ✅ DATAS:
    data_compra DATE NOT NULL,                 -- ✅ Não data_registro
    data_validade DATE,
    data_criacao TIMESTAMP,
    
    -- Outros campos:
    fornecedor TEXT NOT NULL,
    numero_pedido TEXT,
    numero_nota_fiscal TEXT,
    lote TEXT,
    moeda TEXT DEFAULT 'EUR',
    ativo BOOLEAN DEFAULT TRUE,
    criado_por UUID,
    deleted_at TIMESTAMP,
    dias_alerta_validade INTEGER DEFAULT 30
);
```

## 🔧 Correção Aplicada

### Arquivo: `database/laboratorio-schema.sql`
**Linhas 432-447** - View `vw_produtos_estoque` corrigida

### Mudanças:
1. **Linha 433**: `c.custo_unitario` → `c.preco_unitario` ✅
2. **Linha 440**: `c.custo_unitario` → `c.preco_unitario` ✅  
3. **Linha 445**: `c.data_registro` → `c.data_compra` ✅
4. **Adicionados filtros**: `deleted_at IS NULL` e `ativo = TRUE` ✅

## 📝 Scripts de Correção Criados

### 1. `database/fix-view-custo.sql` (Atualizado)
Script original atualizado com as correções

### 2. `database/fix-view-custo-v2.sql` (Novo)
Script completo com:
- View corrigida
- Consultas de verificação
- Mensagens de debug
- Testes automáticos

## 🚀 Como Aplicar a Correção

### Opção 1: Via Supabase Dashboard (Recomendado)
```bash
1. Acesse: https://app.supabase.com/project/hvqckoajxhdqaxfawisd/editor
2. Menu → SQL Editor → + New query
3. Copie o conteúdo de: database/fix-view-custo-v2.sql
4. Clique em RUN
5. Verifique as mensagens de sucesso
```

### Opção 2: Via Terminal (se tiver acesso)
```bash
psql -U postgres -d seu_banco -f database/fix-view-custo-v2.sql
```

## 🧪 Como Testar

### Teste 1: Verificar estrutura da view
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vw_produtos_estoque'
ORDER BY ordinal_position;
```

Deve listar os campos `custo_unitario` e `custo_medio_unitario`.

### Teste 2: Verificar se os dados aparecem
```sql
SELECT 
    nome_material,
    custo_unitario,
    custo_medio_unitario,
    quantidade_atual
FROM vw_produtos_estoque
WHERE custo_unitario IS NOT NULL
LIMIT 5;
```

Se retornar resultados, a correção funcionou! ✅

### Teste 3: Via Interface Web
```bash
1. Acesse: http://localhost:3002/prostoral.html
2. Login no sistema
3. Aba "Estoque" → "Produtos"
4. Clique em "Editar" em um produto
5. O campo "Custo Unitário (€)" deve estar preenchido
```

## 📊 Diagnóstico: Por que os dados estavam zerados?

### Problema 1: Campos Inexistentes
A view tentava buscar `c.custo_unitario`, mas:
- ✅ Existe: `preco_unitario`
- ❌ NÃO existe: `custo_unitario`

Resultado: Erro SQL silencioso → Retorno NULL

### Problema 2: Data Incorreta
A view tentava ordenar por `c.data_registro`, mas:
- ✅ Existe: `data_compra`
- ❌ NÃO existe: `data_registro`

Resultado: Erro SQL → Busca falha → NULL

### Problema 3: Falta de Filtros
A view não filtrava registros deletados ou inativos:
```sql
-- Antes (sem filtro):
SELECT c.preco_unitario
FROM custoslaboratorio c

-- Agora (com filtro):
SELECT c.preco_unitario
FROM custoslaboratorio c
WHERE c.deleted_at IS NULL 
AND c.ativo = TRUE
```

## ✅ Status da Correção

- [x] Identificado o problema (campos inexistentes)
- [x] Schema `laboratorio-schema.sql` corrigido
- [x] Script `fix-view-custo.sql` atualizado
- [x] Novo script `fix-view-custo-v2.sql` criado
- [x] Documentação completa criada
- [ ] **PENDENTE**: Executar o SQL no Supabase
- [ ] **PENDENTE**: Testar no sistema web

## 🎓 Lição Aprendida

Sempre verificar a **estrutura real** das tabelas no banco de dados antes de criar views ou queries. O schema SQL pode estar desatualizado ou conter uma versão planejada (não implementada) da estrutura.

## 📅 Histórico

- **21/10/2025 - Primeira tentativa**: View criada com campos incorretos
- **21/10/2025 - Análise**: Identificado que campos não existiam
- **21/10/2025 - Correção v2**: View corrigida com campos reais

## 👤 Sistema
Sistema de Inventário - Instituto AreLuna  
Módulo: Laboratório de Prótese Dentária

---

**Próximo Passo**: Execute o arquivo `database/fix-view-custo-v2.sql` no Supabase! 🚀

