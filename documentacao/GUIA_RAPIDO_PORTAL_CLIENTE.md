# 🚀 Guia Rápido - Portal do Cliente

**Como configurar e usar o portal do cliente em 5 minutos**

---

## ⚡ Passo 1: Executar SQL no Supabase

1. Acesse o **Supabase SQL Editor**
2. Cole e execute o conteúdo de `database/portal-cliente-schema.sql`
3. Aguarde a confirmação: "Schema do Portal do Cliente aplicado com sucesso!"

---

## ⚡ Passo 2: Criar/Configurar Cliente

### Opção A: Cliente já existe

```sql
-- Vincular usuário existente a cliente existente
UPDATE prostoral_clients
SET user_id = 'SEU_USER_UUID'
WHERE id = 'SEU_CLIENT_UUID';
```

### Opção B: Criar novo cliente

```sql
-- Inserir novo cliente
INSERT INTO prostoral_clients (id, name, email, user_id, created_at)
VALUES (
    gen_random_uuid(),
    'Nome da Clínica',
    'cliente@email.com',
    'USER_UUID_AQUI',
    NOW()
);
```

---

## ⚡ Passo 3: Atribuir Role de Cliente

```sql
-- Atribuir role 'cliente' ao usuário
INSERT INTO user_roles (user_id, role_id)
SELECT 
    'SEU_USER_UUID',
    id
FROM roles
WHERE name = 'cliente';
```

---

## ⚡ Passo 4: Acessar o Portal

```
http://localhost:3002/prostoral-clientes.html
```

Ou em produção:
```
https://seu-dominio.com/prostoral-clientes.html
```

---

## 📝 Como Obter UUIDs

### User UUID

```sql
-- Buscar por email
SELECT id, email FROM auth.users WHERE email = 'email@cliente.com';
```

### Client UUID

```sql
-- Buscar por nome ou email
SELECT id, name, email FROM prostoral_clients 
WHERE email = 'email@cliente.com' OR name ILIKE '%nome%';
```

---

## ✅ Verificar Configuração

```sql
-- Verificar se está tudo configurado
SELECT 
    u.email AS user_email,
    c.name AS client_name,
    r.name AS role_name
FROM auth.users u
INNER JOIN prostoral_clients c ON c.user_id = u.id
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'email@cliente.com';
```

**Resultado esperado:**
```
user_email          | client_name       | role_name
email@cliente.com   | Nome da Clínica   | cliente
```

---

## 🎯 Teste Rápido

1. **Login**: Acesse o portal com as credenciais do cliente
2. **Dashboard**: Deve mostrar KPIs (todos em 0 se não houver OSs)
3. **Nova Ordem**: Clique em "+ Nova Ordem" e crie uma OS de teste
4. **Verificar**: A OS deve aparecer na lista

---

## 🐛 Problemas Comuns

### "Usuário não é cliente"
✅ **Solução**: Verificar se `user_id` está setado em `prostoral_clients`

### "Acesso negado"
✅ **Solução**: Verificar se role `cliente` está atribuída

### "Nenhuma ordem encontrada"
✅ **Solução**: Normal se o cliente ainda não tem OSs. Criar uma para testar.

---

## 📞 Suporte

Para mais detalhes, consulte: **[PORTAL_CLIENTE_COMPLETO.md](PORTAL_CLIENTE_COMPLETO.md)**

---

**Pronto! Em menos de 5 minutos você tem o portal do cliente funcionando! 🎉**

