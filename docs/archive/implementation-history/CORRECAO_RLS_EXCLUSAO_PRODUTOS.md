# Correção RLS - Exclusão de Produtos

## Problema

Erro ao tentar excluir produtos da tabela `produtoslaboratorio`:

```
Error: new row violates row-level security policy for table "produtoslaboratorio"
403 Forbidden
```

## Causa Raiz (REAL)

As tabelas relacionadas (`estoquelaboratorio`, `movimentacoeslaboratorio`, `custoslaboratorio`, `alertaslaboratorio`) tinham:
- ✅ RLS habilitado (`rowsecurity: true`)
- ❌ **SEM política DELETE**
- ✅ Foreign keys com CASCADE

Quando tentávamos deletar um produto:
1. DELETE em `produtoslaboratorio` → OK
2. CASCADE tenta deletar em `estoquelaboratorio` → **BLOQUEADO (sem política DELETE)**
3. Erro 403 retornado

## Solução Implementada

### 1. Mudança de Soft Delete para Hard Delete

Modificado `public/laboratorio.js` (linha 694-712) para usar DELETE ao invés de UPDATE:

```javascript
async deleteProduct(productId) {
    try {
        // Hard delete: remove permanentemente
        const { error } = await window.authManager.supabase
            .from('produtoslaboratorio')
            .delete()
            .eq('id', productId);
        // ...
    }
}
```

### 2. Criação de Políticas DELETE nas Tabelas Relacionadas

```sql
-- estoquelaboratorio
CREATE POLICY "Usuários autenticados podem deletar estoque"
ON estoquelaboratorio FOR DELETE TO authenticated USING (true);

-- movimentacoeslaboratorio
CREATE POLICY "Usuários autenticados podem deletar movimentações"
ON movimentacoeslaboratorio FOR DELETE TO authenticated USING (true);

-- custoslaboratorio
CREATE POLICY "Usuários autenticados podem deletar custos"
ON custoslaboratorio FOR DELETE TO authenticated USING (true);

-- alertaslaboratorio
CREATE POLICY "Usuários autenticados podem deletar alertas"
ON alertaslaboratorio FOR DELETE TO authenticated USING (true);
```

## Impacto

✅ **DELETE funcional** - Produtos podem ser excluídos
✅ **CASCADE automático** - Dados relacionados (estoque, movimentações, custos, alertas) são deletados automaticamente
⚠️ **Sem histórico** - Dados são removidos permanentemente (não há soft delete)

## Arquivos Afetados

- **Supabase**: Política RLS da tabela `produtoslaboratorio`
- **Código**: `public/laboratorio.js` (função `deleteProduct()` - linha 694-715)

## Como Funciona Agora

1. Usuário clica em "Excluir" no produto
2. Sistema executa DELETE:
   ```javascript
   .delete().eq('id', productId)
   ```
3. Política RLS permite DELETE em `produtoslaboratorio`
4. CASCADE deleta automaticamente registros relacionados:
   - `estoquelaboratorio` (políticas DELETE permitem)
   - `movimentacoeslaboratorio` (políticas DELETE permitem)
   - `custoslaboratorio` (políticas DELETE permitem)
   - `alertaslaboratorio` (políticas DELETE permitem)
5. Produto e dados relacionados são removidos permanentemente

## Teste

Recarregue `http://localhost:3002/prostoral.html` → Estoque → Produtos
Tente excluir qualquer produto → Deve funcionar sem erros!

---

**Data**: 21 de Outubro de 2025
**Status**: ✅ Corrigido

