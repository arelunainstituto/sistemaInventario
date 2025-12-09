# 🐛 Debug - Erro 404 ao Abrir OS

## ✅ O que já foi verificado:

1. **✅ Servidor está rodando** na porta 3002
2. **✅ Módulo prostoral-ordens.js carregado** com sucesso
3. **✅ Rotas registradas** corretamente no backend
4. **✅ Rotas respondem** (testado com curl - retorna 401 sem auth, que é esperado)

## 🔍 Próximos Passos de Debug

### 1️⃣ Recarregar o Navegador

```bash
# Pressione no navegador:
Ctrl + Shift + R (Windows/Linux)
ou
Cmd + Shift + R (Mac)

# Ou limpe todo o cache:
Ctrl + Shift + Delete
```

### 2️⃣ Abrir Console do Navegador

1. Pressione **F12**
2. Vá na aba **Console**
3. Limpe o console (ícone 🚫)
4. Tente abrir uma OS
5. Observe os logs

### 3️⃣ Logs que devem aparecer:

Quando você clicar para abrir uma OS, deve ver:

```
📦 Carregando detalhes da OS: 0ee87bc6-2a9f-432e-85b6-21452a21563d
🔑 Token obtido: OK
🌐 URL completa: /api/prostoral/orders/0ee87bc6-2a9f-432e-85b6-21452a21563d
📡 Status da resposta: 200
✅ Dados recebidos: {...}
```

### 4️⃣ Se aparecer "Token obtido: FALHOU"

**Problema:** Auth não está funcionando

**Solução:**
1. Faça logout
2. Faça login novamente
3. Tente abrir a OS

### 5️⃣ Se aparecer "Status da resposta: 401"

**Problema:** Token expirado ou inválido

**Solução:**
1. Recarregue a página (F5)
2. Se persistir, faça logout e login
3. Tente novamente

### 6️⃣ Se aparecer "Status da resposta: 404"

**Problema:** A rota não existe ou a OS não foi encontrada

**Causas possíveis:**

**a) A OS não existe no banco de dados**
```sql
-- Execute no Supabase SQL Editor:
SELECT * FROM prostoral_work_orders 
WHERE id = '0ee87bc6-2a9f-432e-85b6-21452a21563d';
```

**b) Problema de tenant**
```sql
-- Verifique o tenant da OS:
SELECT wo.*, up.tenant_id as user_tenant
FROM prostoral_work_orders wo
CROSS JOIN user_profiles up
WHERE wo.id = '0ee87bc6-2a9f-432e-85b6-21452a21563d'
AND up.user_id = auth.uid();
```

### 7️⃣ Se aparecer "Status da resposta: 500"

**Problema:** Erro no servidor

**Solução:**
1. Verifique os logs do servidor no terminal
2. Procure por erros em vermelho
3. O erro deve mostrar o problema exato

## 🔧 Logs do Servidor

No terminal onde o servidor está rodando, você deve ver:

```
🔧 Carregando módulo prostoral-ordens.js...
✅ Módulo prostoral-ordens.js exportado com sucesso!
🚀 Servidor rodando na porta 3002
```

Quando você tentar abrir uma OS, deve aparecer:

```
🔍 getOrderDetails chamado para ID: 0ee87bc6-2a9f-432e-85b6-21452a21563d
🔍 Tenant ID: xxx-xxx-xxx
```

## 🧪 Teste Manual da Rota

### Teste 1: Verificar se a rota existe

```bash
curl -s http://localhost:3002/api/prostoral/orders
```

**Esperado:** `{"success":false,"error":"No authorization header"}`  
**Significado:** Rota existe, mas precisa de autenticação ✅

### Teste 2: Listar todas as OS (com auth)

No console do navegador (F12 > Console), cole:

```javascript
const token = await window.authManager.getAccessToken();
const response = await fetch('/api/prostoral/orders', {
    headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
console.log('Ordens:', data);
```

**Esperado:** Lista de ordens de serviço

### Teste 3: Abrir OS específica

No console do navegador:

```javascript
const token = await window.authManager.getAccessToken();
const orderId = '0ee87bc6-2a9f-432e-85b6-21452a21563d'; // Cole o ID real aqui
const response = await fetch(`/api/prostoral/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});
console.log('Status:', response.status);
const data = await response.json();
console.log('Dados:', data);
```

## 📋 Checklist de Resolução

- [ ] Recarreguei o navegador (Ctrl+Shift+R)
- [ ] Limpei o cache
- [ ] Verifiquei o console do navegador
- [ ] Vi os logs aparecerem
- [ ] Verifiquei o terminal do servidor
- [ ] Testei a rota manualmente no console
- [ ] Verifiquei se a OS existe no banco
- [ ] Verifiquei o tenant da OS

## 🎯 Diagnósticos Rápidos

### Se o console mostrar:

**"Token obtido: FALHOU"**
→ Problema: Auth  
→ Ação: Logout + Login

**"Status: 401"**
→ Problema: Token inválido  
→ Ação: Recarregar página

**"Status: 404"**
→ Problema: OS não existe ou tenant errado  
→ Ação: Verificar banco de dados

**"Status: 500"**
→ Problema: Erro no servidor  
→ Ação: Ver logs do terminal

**Nenhum log aparece**
→ Problema: Frontend não carregou  
→ Ação: Hard refresh (Ctrl+Shift+R)

## 📞 Próximo Passo

1. **Recarregue o navegador** (Ctrl+Shift+R)
2. **Abra o console** (F12)
3. **Tente abrir uma OS**
4. **Cole aqui os logs que aparecerem**

Assim posso ver exatamente o que está acontecendo e resolver!

---

**Status:** Logs de debug adicionados ✅  
**Servidor:** Rodando e funcionando ✅  
**Aguardando:** Logs do navegador para diagnóstico

