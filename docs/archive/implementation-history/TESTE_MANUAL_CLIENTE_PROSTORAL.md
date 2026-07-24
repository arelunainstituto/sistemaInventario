# 🧪 Teste Manual - Cliente Prostoral

**Data:** 23/10/2025  
**Status:** 📋 **INSTRUÇÕES DE TESTE**

---

## ✅ **Servidor Está Rodando**

```
✅ Porta 3002 ativa
✅ Rotas reorganizadas corretamente
✅ Endpoint /api/prostoral/clients/all funcionando
```

---

## 🧪 **Passo a Passo do Teste**

### **Pré-requisito: Criar Clientes Prostoral**

Se ainda não criou, execute no **Supabase SQL Editor**:

```sql
-- Verificar se há clientes
SELECT COUNT(*) FROM prostoral_clients;

-- Se retornar 0, criar clientes de teste:
INSERT INTO prostoral_clients (name, email, phone, address, created_at, updated_at)
VALUES 
('Clínica Dentária Lisboa', 'clinica@lisboa.pt', '+351 21 123 4567', 'Av. da Liberdade, 123, Lisboa', NOW(), NOW()),
('Dr. João Silva', 'joao.silva@prostoral.pt', '+351 91 234 5678', 'Rua do Comércio, 45, Porto', NOW(), NOW()),
('Centro Médico Coimbra', 'centro@coimbra.pt', '+351 23 987 6543', 'Praça da República, 78, Coimbra', NOW(), NOW());
```

---

### **Teste 1: Verificar Endpoint no Console (F12)**

1. Abra `http://localhost:3002/user-management.html`
2. Pressione **F12** para abrir o Console
3. Cole e execute:

```javascript
// Testar endpoint
const token = localStorage.getItem('access_token');
fetch('http://localhost:3002/api/prostoral/clients/all', {
    headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(d => {
    console.log('✅ Resposta:', d);
    if (d.clients && d.clients.length > 0) {
        console.log(`🎉 ${d.clients.length} clientes encontrados!`);
        d.clients.forEach((c, i) => {
            console.log(`${i+1}. ${c.name} (${c.email})`);
        });
    } else {
        console.warn('⚠️ Nenhum cliente cadastrado');
    }
})
.catch(e => console.error('❌ Erro:', e));
```

**Resultado esperado:**
```
✅ Resposta: {success: true, clients: Array(3)}
🎉 3 clientes encontrados!
1. Clínica Dentária Lisboa (clinica@lisboa.pt)
2. Dr. João Silva (joao.silva@prostoral.pt)
3. Centro Médico Coimbra (centro@coimbra.pt)
```

---

### **Teste 2: Verificar Modal de Usuário**

1. Na página de **Gerenciamento de Usuários**
2. Clique em **"✏️ Editar"** no usuário "Ana Moraes"
3. Aguarde o modal abrir
4. Desça até a seção **"🦷 Acesso ao Portal do Cliente Prostoral"**

**O que verificar:**

#### **✅ Se os clientes carregarem:**
- [ ] Checkbox "Liberar Acesso como Cliente Prostoral" aparece
- [ ] Ao marcar o checkbox, o dropdown aparece
- [ ] Dropdown mostra "Carregando clientes Prostoral..."
- [ ] Após 1-2 segundos, lista de clientes aparece
- [ ] Clientes aparecem no formato: `Nome (email)`

#### **❌ Se houver erro:**
Verifique no Console (F12):

```javascript
// Deve aparecer:
Carregando clientes Prostoral...
Response status: 200
Clientes carregados: {clients: Array(3), success: true}
✅ Clientes carregados com sucesso: 3

// Se aparecer erro:
❌ Error loading clients: ...
```

---

### **Teste 3: Vincular Usuário a Cliente**

1. No modal de edição do usuário
2. ☑ **Marque** "Liberar Acesso como Cliente Prostoral"
3. **Selecione** um cliente no dropdown (ex: "Clínica Dentária Lisboa")
4. Clique em **"💾 Salvar Usuário"**

**No Console (F12) deve aparecer:**
```
✅ Usuário vinculado ao cliente com sucesso
```

**Na listagem de usuários deve aparecer:**
```
Ana Moraes  |  🦷 Cliente Prostoral  👑 Admin
```

---

### **Teste 4: Verificar Vínculo no Banco**

No **Supabase SQL Editor**:

```sql
-- Verificar vínculo criado
SELECT 
    u.email AS usuario_email,
    c.name AS cliente_nome,
    c.email AS cliente_email,
    '✅ Vinculado' AS status
FROM prostoral_clients c
INNER JOIN auth.users u ON c.user_id = u.id
WHERE u.email = 'ana.moraes@institutoareluna.pt';
```

**Resultado esperado:**
```
usuario_email                    | cliente_nome              | status
---------------------------------|---------------------------|-------------
ana.moraes@institutoareluna.pt  | Clínica Dentária Lisboa   | ✅ Vinculado
```

---

### **Teste 5: Testar Acesso ao Portal**

1. **Fazer logout** do admin
2. **Fazer login** com "ana.moraes@institutoareluna.pt"
3. **Acessar:** `http://localhost:3002/prostoral-clientes.html`
4. **Deve mostrar** o dashboard do cliente ✅

---

## 🐛 **Troubleshooting**

### **Problema 1: "Erro ao carregar clientes"**

**Console mostra:**
```javascript
Response status: 500
Error: invalid input syntax for type uuid: "all"
```

**Solução:** Servidor não foi reiniciado após a correção
```bash
cd /Users/insitutoareluna/Documents/sistemaInventario
kill -9 $(lsof -t -i:3002)
npm start
```

---

### **Problema 2: "Nenhum cliente Prostoral cadastrado"**

**Console mostra:**
```javascript
✅ Resposta: {success: true, clients: []}
⚠️ Nenhum cliente encontrado
```

**Solução:** Execute o SQL de criação de clientes (ver início do documento)

---

### **Problema 3: Dropdown fica em "Carregando..."**

**Causas possíveis:**

1. **Token expirado**
   ```javascript
   // No console, verificar:
   localStorage.getItem('access_token')
   // Se null, fazer login novamente
   ```

2. **Servidor não está rodando**
   ```bash
   lsof -i:3002
   # Se nada aparecer, iniciar servidor:
   npm start
   ```

3. **Erro no JavaScript**
   - Abrir Console (F12)
   - Procurar por erros em vermelho
   - Enviar screenshot do erro

---

### **Problema 4: "Acesso negado" no Portal do Cliente**

**Causa:** Usuário vinculado mas ainda não fez logout/login

**Solução:**
1. Fazer **logout**
2. Fazer **login** novamente
3. Acessar `prostoral-clientes.html`

---

## 📸 **Screenshots Esperados**

### **1. Dropdown com Clientes**
```
┌────────────────────────────────────┐
│ ☑ Liberar Acesso como Cliente     │
│    Prostoral                        │
│                                     │
│ Vincular ao Cliente Prostoral:     │
│ ┌──────────────────────────────┐  │
│ │ -- Selecione um Cliente      │  │
│ │ Prostoral --                 │  │
│ ├──────────────────────────────┤  │
│ │ Clínica Dentária Lisboa      │  │
│ │ (clinica@lisboa.pt)          │  │
│ ├──────────────────────────────┤  │
│ │ Dr. João Silva               │  │
│ │ (joao.silva@prostoral.pt)    │  │
│ ├──────────────────────────────┤  │
│ │ Centro Médico Coimbra        │  │
│ │ (centro@coimbra.pt)          │  │
│ └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### **2. Badge na Listagem**
```
┌────────────────────────────────────────┐
│ Nome       | Funções                   │
├────────────────────────────────────────┤
│ Ana Moraes | 🦷 Cliente Prostoral      │
│            | 👑 Admin                  │
└────────────────────────────────────────┘
```

### **3. Console sem Erros**
```
Carregando clientes Prostoral...
Response status: 200
Clientes carregados: {success: true, clients: Array(3)}
✅ Clientes carregados com sucesso: 3
```

---

## ✅ **Checklist de Teste**

- [ ] SQL executado (clientes criados)
- [ ] Endpoint testado no console (responde 200)
- [ ] Modal de usuário abre corretamente
- [ ] Checkbox "Cliente Prostoral" aparece
- [ ] Dropdown carrega lista de clientes
- [ ] Consegue selecionar cliente
- [ ] Salva usuário com sucesso
- [ ] Badge "🦷 Cliente Prostoral" aparece
- [ ] Vínculo confirmado no banco de dados
- [ ] Portal do cliente acessível

---

## 📞 **Se Precisar de Ajuda**

1. **Tire screenshot** do Console (F12) com o erro
2. **Copie** a mensagem de erro completa
3. **Verifique** se o servidor está rodando: `lsof -i:3002`
4. **Verifique** os logs: `tail -f server.log`

---

**Última Atualização:** 23/10/2025  
**Status:** 📋 **PRONTO PARA TESTAR**

