# Correções do Schema do Módulo Laboratório

## 📋 Resumo do Problema

O arquivo `database/laboratorio-schema.sql` contém uma estrutura de banco de dados DIFERENTE da que realmente existe no Supabase. Isso causava erros ao tentar inserir dados com campos que não existem na tabela.

## 🔧 Correções Realizadas

### ❌ Campos que NÃO EXISTEM no banco (foram removidos do código):

**Na tabela `movimentacoeslaboratorio`:**
- `tipo_movimento` → **Usar `tipo`**
- `responsavel_id` → **Usar `responsavel`** (campo de texto)
- `responsavel_nome` → **Não existe, já está incluído em `responsavel`**
- `criado_por` → **Usar `registrado_por`**
- `preco_total` → **Não existe**
- `preco_unitario` → **Não existe**
- `fornecedor` → **Não existe**
- `numero_pedido` → **Não existe**
- `caso_clinico` → **Usar `numero_caso`**
- `paciente` → **Não existe**
- `setor` → **Não existe**
- `quantidade_anterior` → **Não existe** (seria calculado via trigger)
- `quantidade_nova` → **Não existe** (seria calculado via trigger)

### ✅ Estrutura REAL da tabela `movimentacoeslaboratorio`:

```sql
CREATE TABLE movimentacoeslaboratorio (
    id UUID PRIMARY KEY,
    produto_id UUID NOT NULL,
    tipo TEXT NOT NULL,                    -- 'entrada' ou 'saida'
    quantidade NUMERIC(10,2) NOT NULL,
    motivo TEXT NOT NULL,
    responsavel TEXT,                      -- Nome do responsável (texto livre)
    numero_caso TEXT,                      -- Número do caso clínico (opcional)
    data_movimentacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    registrado_por UUID,                   -- ID do usuário que registrou
    observacoes TEXT
);
```

## 📝 Mapeamento de Campos (Antigo → Novo)

### Para ENTRADA:
```javascript
// ❌ ANTIGO (não funciona):
{
    tipo_movimento: 'entrada',
    responsavel_id: userId,
    responsavel_nome: 'João Silva',
    fornecedor: 'Fornecedor XYZ',
    numero_pedido: 'PED123',
    preco_unitario: 10.50,
    preco_total: 105.00,
    criado_por: userId
}

// ✅ NOVO (correto):
{
    tipo: 'entrada',
    responsavel: 'João Silva',
    motivo: 'Compra',
    registrado_por: userId,
    observacoes: 'Fornecedor: XYZ, Pedido: PED123'
}
```

### Para SAÍDA:
```javascript
// ❌ ANTIGO (não funciona):
{
    tipo_movimento: 'saida',
    responsavel_id: userId,
    responsavel_nome: 'João Silva',
    caso_clinico: 'CASO-123',
    paciente: 'Maria Santos',
    setor: 'Prótese',
    criado_por: userId
}

// ✅ NOVO (correto):
{
    tipo: 'saida',
    responsavel: 'João Silva',
    numero_caso: 'CASO-123',
    motivo: 'Uso em produção',
    registrado_por: userId,
    observacoes: 'Paciente: Maria Santos, Setor: Prótese'
}
```

## 🚀 Arquivos Corrigidos

### 1. `/api/index.js` (rotas da API):
- ✅ `POST /api/laboratorio/movimentacoes/entrada` - Corrigida
- ✅ `POST /api/laboratorio/movimentacoes/saida` - Corrigida  
- ✅ Registro de movimentação inicial ao criar produto - Corrigida

### 2. Próximos Passos (se necessário):

Se o frontend (`/public/laboratorio.js`) ainda estiver enviando os campos antigos, será necessário atualizá-lo também.

## 🔍 Como Verificar se Há Mais Erros

Execute no terminal:
```bash
# Buscar por uso de campos antigos no código
grep -r "tipo_movimento" public/
grep -r "responsavel_id" api/
grep -r "preco_total" api/
grep -r "criado_por" api/ | grep movimentacao
```

## 📊 Status Atual

✅ **RESOLVIDO**: Erro "Could not find the 'criado_por' column"  
✅ **RESOLVIDO**: Erro "Could not find the 'preco_total' column"  
🟢 **SERVIDOR**: Rodando corretamente na porta 3002

## ⚠️ Importante

O arquivo `database/laboratorio-schema.sql` parece ser uma **versão futura** do schema que nunca foi aplicada ao banco de dados. Se quiser usar essa estrutura mais completa:

1. Crie uma migração no Supabase para adicionar os campos faltantes
2. OU continue usando a estrutura atual (mais simples)

A estrutura atual é **funcional e suficiente** para as necessidades do sistema de laboratório.


