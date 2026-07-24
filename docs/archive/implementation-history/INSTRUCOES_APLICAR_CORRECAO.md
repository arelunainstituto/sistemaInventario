# 📋 Instruções: Como Aplicar a Correção do Custo Unitário

## 🎯 Objetivo
Corrigir o problema do campo "Custo Unitário (€)" que não estava sendo preenchido ao editar produtos no sistema de laboratório.

## 🚀 Método Recomendado: Via Supabase Dashboard

### Passo 1: Acessar o Supabase Dashboard
1. Acesse: https://app.supabase.com/
2. Faça login com sua conta
3. Selecione o projeto: **hvqckoajxhdqaxfawisd**

### Passo 2: Abrir o SQL Editor
1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique em **+ New query** para criar uma nova consulta

### Passo 3: Copiar e Executar o SQL
1. Abra o arquivo: `database/fix-view-custo.sql`
2. Copie todo o conteúdo do arquivo
3. Cole no SQL Editor do Supabase
4. Clique no botão **Run** (ou pressione Ctrl+Enter / Cmd+Enter)

### Passo 4: Verificar o Resultado
Você deve ver mensagens de sucesso indicando:
- ✅ View vw_produtos_estoque atualizada com sucesso!
- Lista das colunas da view atualizada

## 📝 SQL a ser Executado

```sql
-- Recriar a view com as informações de custo
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
```

## 🧪 Como Testar a Correção

### Teste 1: Via Sistema Web
1. Acesse: http://localhost:3002/prostoral.html
2. Faça login no sistema
3. Vá para a aba **Estoque** → **Produtos**
4. Clique em **Editar** em qualquer produto
5. ✅ Verifique se o campo "Custo Unitário (€)" está preenchido

### Teste 2: Via SQL (Opcional)
No SQL Editor do Supabase, execute:
```sql
SELECT 
    nome_material,
    custo_unitario,
    custo_medio_unitario
FROM vw_produtos_estoque
LIMIT 10;
```

Você deve ver os valores de custo preenchidos (se houver registros na tabela custoslaboratorio).

## ⚠️ Possíveis Problemas

### Problema 1: "relation vw_produtos_estoque does not exist"
**Solução:** A view ainda não foi criada. Execute primeiro o schema completo do laboratório:
```bash
database/laboratorio-schema.sql
```

### Problema 2: Custos aparecem como NULL
**Causa:** Não há registros de custo cadastrados para os produtos.
**Solução:** Os custos são registrados automaticamente ao fazer entradas de estoque com o campo "Custo Unitário" preenchido.

### Problema 3: Permissões Negadas
**Solução:** Certifique-se de estar usando uma conta com permissões de administrador no Supabase.

## 📊 O Que Foi Alterado

### Antes
A view `vw_produtos_estoque` retornava apenas:
- Dados básicos do produto
- Informações de estoque (quantidades, status)

### Depois
A view agora também retorna:
- ✅ `custo_unitario` - Último preço de compra
- ✅ `custo_medio_unitario` - Média de todos os preços
- ✅ `referencia_lote` - Referência do lote
- ✅ `descricao` - Descrição do produto
- ✅ `observacoes` - Observações

## 🎉 Resultado Esperado

Após aplicar a correção, ao editar um produto:
1. O formulário será preenchido completamente
2. O campo "Custo Unitário (€)" mostrará o valor correto
3. Todos os outros campos também estarão preenchidos

## 💡 Observações Importantes

1. **Não precisa reiniciar o servidor** - A alteração é no banco de dados
2. **A correção é retroativa** - Funciona para todos os produtos existentes
3. **Sem perda de dados** - Esta é apenas uma alteração de visualização (view)

## 📞 Suporte

Se encontrar algum problema:
1. Verifique os logs do servidor em: `.cursor/.agent-tools/`
2. Consulte a documentação em: `CORRECAO_CUSTO_UNITARIO.md`
3. Execute o teste SQL acima para verificar se a view foi criada corretamente

---

**Data:** 21 de outubro de 2025  
**Sistema:** Inventário AreLuna - Módulo Laboratório  
**Status:** ✅ Pronto para aplicação

