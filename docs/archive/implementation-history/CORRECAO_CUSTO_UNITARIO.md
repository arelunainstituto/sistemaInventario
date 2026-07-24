# 🔧 Correção: Campo Custo Unitário não atualiza no formulário de edição

## 📋 Problema Identificado

Ao editar um produto no sistema de laboratório (prostoral.html), o campo "Custo Unitário (€)" não estava sendo preenchido com o valor correto do produto.

### Causa Raiz
A view `vw_produtos_estoque` não incluía informações de custo unitário. A view apenas retornava dados básicos do produto e do estoque, mas não buscava os dados da tabela `custoslaboratorio`.

## ✅ Solução Implementada

### 1. Atualização da View `vw_produtos_estoque`

A view foi atualizada para incluir dois novos campos relacionados a custos:

```sql
-- Campo 1: Custo médio de todas as compras
custo_medio_unitario - Calcula a média de todos os preços de compra

-- Campo 2: Custo da última compra
custo_unitario - Retorna o preço unitário da compra mais recente
```

### 2. Campos Adicionais
Também foram adicionados outros campos que estavam faltando:
- `referencia_lote`
- `descricao`
- `observacoes`

## 📝 Arquivos Modificados

1. **database/laboratorio-schema.sql**
   - Atualização da definição da view `vw_produtos_estoque`

2. **database/fix-view-custo.sql** (novo)
   - Script SQL para aplicar a correção no banco de dados

## 🚀 Como Aplicar a Correção

### Opção 1: Via Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá para SQL Editor
3. Execute o conteúdo do arquivo `database/fix-view-custo.sql`

### Opção 2: Via Terminal (se tiver acesso direto ao PostgreSQL)
```bash
psql -U postgres -d seu_banco -f database/fix-view-custo.sql
```

## 🧪 Teste da Correção

1. Acesse o sistema: http://localhost:3002/prostoral.html
2. Vá para a aba "Estoque" → "Produtos"
3. Clique em "Editar" em qualquer produto
4. Verifique se o campo "Custo Unitário (€)" está sendo preenchido corretamente

## 📊 Estrutura de Dados

### Tabelas Envolvidas
- `produtoslaboratorio` - Dados básicos dos produtos
- `estoquelaboratorio` - Controle de quantidades
- `custoslaboratorio` - Histórico de custos e compras

### View Atualizada
- `vw_produtos_estoque` - View consolidada com todas as informações

## 💡 Detalhes Técnicos

### JavaScript (laboratorio.js)
O código JavaScript já estava correto na linha 348:
```javascript
document.getElementById('productCustoUnitario').value = product.custo_unitario || '';
```

O problema era que `product.custo_unitario` sempre retornava `undefined` porque a view não retornava esse campo.

### SQL
A view agora busca o custo da seguinte forma:
```sql
-- Último custo de compra
(
    SELECT c.preco_unitario
    FROM custoslaboratorio c
    WHERE c.produto_id = p.id 
    AND c.deleted_at IS NULL 
    AND c.ativo = TRUE
    ORDER BY c.data_compra DESC
    LIMIT 1
) AS custo_unitario
```

## ✔️ Checklist de Verificação

- [x] View atualizada no schema SQL
- [x] Script de migração criado
- [ ] Script executado no banco de dados
- [ ] Teste de edição de produto confirmado
- [ ] Campo "Custo Unitário" é preenchido corretamente

## 📅 Data da Correção
21 de outubro de 2025

## 👤 Autor
Sistema de Inventário - Grupo AreLuna

