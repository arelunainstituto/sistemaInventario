# Migração para Tabela produtoslaboratorio

## 📋 Resumo

Alterado o sistema de estoque do **ProStoral** para usar a tabela `produtoslaboratorio` (58 produtos) ao invés de `prostoral_inventory` (21 produtos).

## 🔄 Mudanças Realizadas

### 1. Tabelas Utilizadas

**ANTES:**
- `prostoral_inventory` → 21 produtos

**DEPOIS:**
- `produtoslaboratorio` → 58 produtos (tabela principal)
- `estoquelaboratorio` → Dados de estoque (JOIN)

### 2. Mapeamento de Campos

| prostoral_inventory | produtoslaboratorio + estoquelaboratorio |
|---------------------|------------------------------------------|
| `name` | `nome_material` |
| `code` | `codigo_barras` ou `qr_code` |
| `brand` | `marca` |
| `quantity` | `estoquelaboratorio.quantidade_atual` |
| `unit` | `unidade_medida` |
| `category` | `categoria` |
| `batch` | `referencia_lote` |

### 3. Alterações em `laboratorio.js`

#### `loadProducts()`:
```javascript
// Query com JOIN
let query = window.authManager.supabase
    .from('produtoslaboratorio')
    .select(`
        *,
        estoquelaboratorio (
            quantidade_atual,
            quantidade_minima,
            quantidade_maxima,
            status
        )
    `, { count: 'exact' })
    .eq('ativo', true)
    .is('deleted_at', null);
```

- **Busca:** Agora usa `nome_material`, `codigo_barras`, `marca`
- **Filtros:** Categoria usa `categoria`
- **Ordenação:** Usa `data_criacao` ao invés de `created_at`
- **Status:** Filtrado após busca usando `estoquelaboratorio.quantidade_atual`

#### `renderProducts()`:
- Renderização atualizada para usar os novos nomes de campos
- Quantidade vem de `product.estoquelaboratorio?.quantidade_atual`

#### `deleteProduct()`:
- **Soft Delete:** Marca `deleted_at` e `ativo = false` ao invés de deletar
- Usa tabela `produtoslaboratorio`

### 4. Paginação

Mantida em **100 produtos por página** para exibir todos os 58 produtos.

## ✅ Resultados

- **58 produtos** agora aparecem no estoque
- Exclusão funciona corretamente (soft delete)
- Filtros de busca, categoria e status funcionando
- JOIN correto com `estoquelaboratorio` para quantidades

## 📍 Arquivos Modificados

- `/public/laboratorio.js`
  - `loadProducts()` - linhas 207-273
  - `renderProducts()` - linhas 275-350
  - `deleteProduct()` - linhas 694-715

## 🎯 Próximos Passos (se necessário)

1. Atualizar outras funções que possam usar campos antigos
2. Verificar se `viewProduct()` e `editProduct()` precisam ajustes
3. Confirmar se os kits devem usar `produtoslaboratorio` também

---

**Data:** 21 de Outubro de 2025
**Status:** ✅ Concluído

