# ⚡ Guia Rápido de Correção - Custo Unitário

## 🔴 Problema
Campo "Custo Unitário (€)" vazio ao editar produtos.

## ✅ Solução em 3 Passos

### 1️⃣ Acessar Supabase
🌐 https://app.supabase.com/project/hvqckoajxhdqaxfawisd/editor

### 2️⃣ Abrir SQL Editor
📝 Menu lateral → **SQL Editor** → **+ New query**

### 3️⃣ Executar o SQL
```sql
CREATE OR REPLACE VIEW vw_produtos_estoque AS
SELECT 
    p.id, p.qr_code, p.codigo_barras, p.categoria, p.nome_material,
    p.marca, p.fornecedor, p.referencia_lote, p.unidade_medida,
    p.localizacao, p.data_validade, p.descricao, p.observacoes, p.ativo,
    COALESCE(e.quantidade_atual, 0) AS quantidade_atual,
    COALESCE(e.quantidade_minima, 0) AS quantidade_minima,
    COALESCE(e.quantidade_maxima, 0) AS quantidade_maxima,
    COALESCE(e.status, 'ok') AS status,
    e.ultima_entrada, e.ultima_saida, e.ultima_atualizacao,
    (SELECT AVG(c.preco_unitario) FROM custoslaboratorio c 
     WHERE c.produto_id = p.id AND c.deleted_at IS NULL AND c.ativo = TRUE) 
    AS custo_medio_unitario,
    (SELECT c.preco_unitario FROM custoslaboratorio c 
     WHERE c.produto_id = p.id AND c.deleted_at IS NULL AND c.ativo = TRUE
     ORDER BY c.data_compra DESC LIMIT 1) 
    AS custo_unitario
FROM produtoslaboratorio p
LEFT JOIN estoquelaboratorio e ON p.id = e.produto_id
WHERE p.deleted_at IS NULL;
```

### ✅ Pronto!
Agora teste editando um produto em:
http://localhost:3002/prostoral.html

---

📚 **Documentação Completa:** `INSTRUCOES_APLICAR_CORRECAO.md`

