# 🚀 Aplicar Sistema de Histórico - Ação Imediata

## ⚡ Passo a Passo Rápido

### 1️⃣ Aplicar no Banco de Dados (Supabase)

1. Acesse o Supabase SQL Editor
2. Copie todo o conteúdo de `database/work-orders-history.sql`
3. Cole no editor SQL
4. Execute o script (botão RUN)
5. Aguarde a confirmação de sucesso

### 2️⃣ Reiniciar o Servidor Backend

```bash
# Parar o servidor atual (Ctrl+C no terminal onde está rodando)
# Depois reinicie:
npm start
```

### 3️⃣ Limpar Cache do Navegador

```
1. Abra o navegador
2. Pressione Ctrl+Shift+Delete (Windows) ou Cmd+Shift+Delete (Mac)
3. Limpe o cache
4. Ou simplesmente pressione Ctrl+F5 para hard refresh
```

### 4️⃣ Testar

1. Acesse o sistema ProStoral
2. Abra uma Ordem de Serviço
3. Veja se o histórico está aparecendo
4. Faça uma alteração (mude o status, adicione um material)
5. Recarregue a OS
6. Verifique se a alteração foi registrada no histórico

## 🐛 Se der erro 404 nas rotas

O erro que você está vendo:
```
GET http://localhost:3002/api/prostoral/orders/... 404 (Not Found)
```

**Soluções:**

### Solução 1: Reiniciar o servidor
```bash
# No terminal onde o servidor está rodando
Ctrl+C

# Reiniciar
npm start
```

### Solução 2: Verificar se o módulo está sendo carregado

Adicione um console.log no arquivo `api/index.js` na linha onde carrega o módulo:

```javascript
const prostoralOrders = require('./prostoral-ordens');
console.log('✅ Módulo prostoral-ordens carregado:', !!prostoralOrders);
```

### Solução 3: Verificar se as rotas estão registradas

Verifique no terminal quando o servidor inicia se há algum erro relacionado ao módulo prostoral-ordens.

### Solução 4: Verificar permissões

Certifique-se de que o arquivo `api/prostoral-ordens.js` tem as permissões corretas:

```bash
ls -la api/prostoral-ordens.js
```

## ✅ Checklist Rápido

- [ ] Script SQL executado no Supabase
- [ ] Servidor backend reiniciado
- [ ] Cache do navegador limpo
- [ ] Sistema testado
- [ ] Histórico aparecendo corretamente

## 📊 Como Verificar se Funcionou

### No Banco de Dados (Supabase SQL Editor)

```sql
-- Ver se os triggers foram criados
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname LIKE 'trigger_log%';

-- Deve retornar algo como:
-- trigger_log_status_change | prostoral_work_orders
-- trigger_log_order_changes | prostoral_work_orders
-- trigger_log_material_added | prostoral_work_order_materials
-- etc...
```

### No Frontend

1. Abra uma OS
2. Procure pela seção "Histórico de Alterações"
3. Deve aparecer pelo menos um registro: "Ordem de serviço criada"

### Teste Completo

```sql
-- Buscar uma OS existente
SELECT * FROM prostoral_work_orders LIMIT 1;

-- Fazer uma alteração (use o ID da OS acima)
UPDATE prostoral_work_orders 
SET status = 'design' 
WHERE id = 'cole-o-id-aqui';

-- Ver o histórico
SELECT * FROM prostoral_work_order_status_history 
WHERE work_order_id = 'cole-o-id-aqui' 
ORDER BY changed_at DESC;
```

## 🆘 Problemas Comuns

### Erro: "relation prostoral_work_order_status_history does not exist"

**Causa:** A tabela não foi criada  
**Solução:** Execute o script SQL novamente

### Erro: "function log_work_order_status_change() does not exist"

**Causa:** As funções não foram criadas  
**Solução:** Execute o script SQL novamente

### Erro: 404 nas rotas da API

**Causa:** Servidor não foi reiniciado  
**Solução:** Reinicie o servidor (Ctrl+C e npm start)

### Histórico não aparece no frontend

**Causa 1:** RLS (Row Level Security) não está configurado  
**Solução:** Execute as políticas RLS do guia

**Causa 2:** Backend não está retornando os dados  
**Solução:** Verifique o console do navegador para erros

## 📞 Próximos Passos

Depois de aplicar e testar:

1. ✅ Fazer commit das alterações
2. ✅ Push para o repositório
3. ✅ Testar em produção
4. ✅ Treinar a equipe sobre o novo recurso

---

**Tempo estimado:** 5-10 minutos  
**Data:** 22/10/2025

