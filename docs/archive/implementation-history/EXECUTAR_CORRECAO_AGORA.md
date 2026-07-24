# ⚡ EXECUTAR CORREÇÃO AGORA

## 🎯 O QUE FAZER

Você precisa executar o SQL de correção no Supabase para resolver o problema dos dados zerados.

---

## 📍 PASSO A PASSO RÁPIDO

### 1️⃣ Abrir Supabase
🌐 **Link direto**: https://app.supabase.com/project/hvqckoajxhdqaxfawisd/sql/new

### 2️⃣ Copiar o SQL
Abra o arquivo: **`database/fix-view-custo-v2.sql`**

OU copie o SQL abaixo:

```sql
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

### 3️⃣ Colar e Executar
1. Cole o SQL no editor
2. Clique em **RUN** (ou Ctrl+Enter)
3. Aguarde a mensagem de sucesso ✅

### 4️⃣ Verificar
Execute este SQL para testar:
```sql
SELECT 
    nome_material,
    custo_unitario,
    quantidade_atual
FROM vw_produtos_estoque
LIMIT 5;
```

Se aparecer valores no `custo_unitario`, está funcionando! 🎉

---

## ❓ POR QUE ESTAVA ZERADO?

A view estava tentando buscar campos que **NÃO EXISTEM**:
- ❌ `c.custo_unitario` → Correto: `c.preco_unitario`
- ❌ `c.data_registro` → Correto: `c.data_compra`

---

## 📚 Mais Informações

- **Detalhes técnicos**: `ANALISE_DADOS_ZERADOS.md`
- **Documentação completa**: `CORRECAO_CUSTO_UNITARIO.md`
- **Script SQL completo**: `database/fix-view-custo-v2.sql`

---

## ✅ APÓS EXECUTAR

Teste no sistema:
1. Acesse: http://localhost:3002/prostoral.html
2. Entre em "Estoque" → "Produtos"
3. Edite um produto
4. O campo "Custo Unitário (€)" deve aparecer preenchido! ✅

---

**🕐 Tempo estimado**: 2 minutos  
**🎓 Dificuldade**: Fácil  
**⚠️ Risco**: Nenhum (apenas atualiza uma view)

