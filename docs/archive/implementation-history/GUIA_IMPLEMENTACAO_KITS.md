# 🚀 Guia de Implementação - Sistema de Kits

## 📋 Pré-requisitos

- ✅ Projeto Supabase configurado
- ✅ Tabela `laboratorio_produtos` criada e populada
- ✅ Acesso ao SQL Editor do Supabase

## 🔧 Passo a Passo

### 1️⃣ Criar as Tabelas no Banco de Dados

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Crie uma nova query
4. Copie e cole o conteúdo do arquivo `database/kits-schema.sql`
5. Execute a query
6. Verifique se as tabelas foram criadas:
   - `kits`
   - `kit_produtos`

### 2️⃣ Verificar Políticas RLS

Execute no SQL Editor:

```sql
-- Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('kits', 'kit_produtos');

-- Listar políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('kits', 'kit_produtos');
```

### 3️⃣ Testar Acesso às Tabelas

Execute no SQL Editor:

```sql
-- Testar SELECT na tabela kits
SELECT * FROM kits LIMIT 1;

-- Testar SELECT na tabela kit_produtos
SELECT * FROM kit_produtos LIMIT 1;
```

Se houver erro, verifique:
- RLS está habilitado
- Políticas foram criadas corretamente
- Você está logado como usuário autenticado

### 4️⃣ Acessar a Interface

1. Faça login no sistema ProStoral
2. Navegue até **http://localhost:3002/prostoral.html**
3. Clique na aba **Kits**
4. Clique em **Gerenciar Kits**
5. Você será redirecionado para **prostoral-kits.html**

### 5️⃣ Criar Seu Primeiro Kit

1. Clique em **Criar Novo Kit**
2. Preencha os dados:
   - **Nome**: "Kit Teste"
   - **Tipo**: Selecione um tipo
   - **Descrição**: Descrição opcional
3. Clique em **Adicionar Produto**
4. Busque e selecione um produto
5. Informe a quantidade
6. Clique em **Adicionar ao Kit**
7. Repita para adicionar mais produtos
8. Clique em **Salvar Kit**

## 🐛 Solução de Problemas

### Erro: "relation 'kits' does not exist"

**Solução**: Execute o arquivo `database/kits-schema.sql` no SQL Editor

### Erro: "new row violates row-level security policy"

**Solução**: 
1. Verifique se você está autenticado
2. Execute as políticas RLS novamente do arquivo `kits-schema.sql`
3. Certifique-se de que RLS está habilitado:
```sql
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_produtos ENABLE ROW LEVEL SECURITY;
```

### Erro: "Produtos não carregam"

**Solução**:
1. Verifique se existem produtos em `laboratorio_produtos`:
```sql
SELECT COUNT(*) FROM laboratorio_produtos;
```
2. Se vazio, cadastre produtos primeiro

### Erro: "foreign key violation"

**Solução**:
- Certifique-se de que a tabela `laboratorio_produtos` existe
- Se necessário, recrie as tabelas na ordem correta:
  1. `laboratorio_produtos` (se ainda não existe)
  2. `kits`
  3. `kit_produtos`

### Kits não aparecem na lista

**Solução**:
1. Abra o Console do navegador (F12)
2. Verifique erros de JavaScript
3. Verifique a aba Network para erros de API
4. Tente fazer logout e login novamente

### Erro ao salvar kit

**Solução**:
1. Preencha todos os campos obrigatórios
2. Adicione pelo menos um produto
3. Verifique o Console para mais detalhes

## 🧪 Testes Recomendados

### Teste 1: Criar Kit Simples
```
1. Criar kit com 1-2 produtos
2. Verificar se aparece na lista
3. Editar o kit
4. Visualizar detalhes
5. Excluir o kit
```

### Teste 2: Criar Kit Complexo
```
1. Criar kit com 10+ produtos
2. Testar busca e filtros
3. Editar e remover alguns produtos
4. Adicionar novos produtos
```

### Teste 3: Validações
```
1. Tentar salvar kit sem nome
2. Tentar salvar kit sem tipo
3. Tentar salvar kit sem produtos
4. Tentar adicionar produto com quantidade inválida
```

## 📊 Queries Úteis

### Listar todos os kits com contagem de produtos
```sql
SELECT 
    k.id,
    k.nome,
    k.tipo,
    COUNT(kp.id) as total_produtos,
    k.created_at
FROM kits k
LEFT JOIN kit_produtos kp ON k.id = kp.kit_id
GROUP BY k.id, k.nome, k.tipo, k.created_at
ORDER BY k.created_at DESC;
```

### Listar produtos de um kit específico
```sql
SELECT 
    k.nome as kit_nome,
    p.nome as produto_nome,
    p.codigo as produto_codigo,
    kp.quantidade,
    p.unidade_medida,
    p.quantidade_estoque
FROM kits k
JOIN kit_produtos kp ON k.id = kp.kit_id
JOIN laboratorio_produtos p ON kp.produto_id = p.id
WHERE k.id = 'UUID_DO_KIT'
ORDER BY p.nome;
```

### Verificar produtos mais usados em kits
```sql
SELECT 
    p.nome,
    p.codigo,
    COUNT(kp.kit_id) as usado_em_kits,
    SUM(kp.quantidade) as quantidade_total
FROM laboratorio_produtos p
JOIN kit_produtos kp ON p.id = kp.produto_id
GROUP BY p.id, p.nome, p.codigo
ORDER BY usado_em_kits DESC, quantidade_total DESC;
```

### Listar kits por tipo
```sql
SELECT 
    tipo,
    COUNT(*) as total_kits,
    AVG(produtos_count) as media_produtos
FROM (
    SELECT 
        k.tipo,
        COUNT(kp.id) as produtos_count
    FROM kits k
    LEFT JOIN kit_produtos kp ON k.id = kp.kit_id
    GROUP BY k.id, k.tipo
) subquery
GROUP BY tipo
ORDER BY total_kits DESC;
```

## 📝 Checklist de Implementação

- [ ] Arquivo `kits-schema.sql` executado
- [ ] Tabelas `kits` e `kit_produtos` criadas
- [ ] Políticas RLS configuradas e funcionando
- [ ] Arquivo `prostoral-kits.html` no diretório `/public`
- [ ] Arquivo `prostoral-kits.js` no diretório `/public`
- [ ] Link na aba "Kits" do `prostoral.html` atualizado
- [ ] Teste de criação de kit realizado
- [ ] Teste de edição de kit realizado
- [ ] Teste de exclusão de kit realizado
- [ ] Testes de busca e filtros realizados
- [ ] Console do navegador sem erros
- [ ] Documentação lida e compreendida

## 🎯 Próximos Passos

Após implementar o sistema básico de kits:

1. **Populr com dados reais**
   - Crie kits baseados nos seus procedimentos
   - Adicione produtos reais do seu estoque

2. **Treinar usuários**
   - Mostre como criar kits
   - Explique os benefícios da organização

3. **Monitorar uso**
   - Observe quais kits são mais criados
   - Colete feedback dos usuários

4. **Planejar funcionalidades futuras**
   - Uso de kits em ordens de serviço
   - Baixa automática no estoque
   - Relatórios de consumo por kit

## 📞 Suporte

Se encontrar problemas:
1. Consulte a seção "Solução de Problemas"
2. Verifique o console do navegador (F12)
3. Revise os logs do Supabase
4. Consulte `KITS_README.md` para mais informações

---

**Boa implementação! 🚀**

