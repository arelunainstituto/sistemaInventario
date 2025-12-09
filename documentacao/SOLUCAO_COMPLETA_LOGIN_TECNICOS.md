# ✅ SOLUÇÃO COMPLETA: LOGIN DOS TÉCNICOS

## 📋 RESUMO EXECUTIVO

**Problema:** Técnicos não conseguiam fazer login com erro "Database error querying schema"

**Causa Raiz:** **FALTA DE REGISTROS** na tabela `user_profiles`

**Solução:** Criação de perfis para todos os 5 técnicos + correção de hashes e identities

---

## 🔍 DIAGNÓSTICO COMPLETO

### **Foram identificados 3 problemas:**

1. ❌ **Hashes de senha incorretos** (6 rounds ao invés de 10)
2. ❌ **Falta de registros em `auth.identities`** (obrigatório para login)
3. ❌ **FALTA DE REGISTROS em `user_profiles`** (causava erro 500)

---

## 🛠️ CORREÇÕES APLICADAS

### **1. Correção dos Hashes de Senha (10 rounds bcrypt)**

```sql
-- Atualizar hashes com 10 rounds
UPDATE auth.users 
SET encrypted_password = '$2a$10$...' 
WHERE email IN (
    'raphael.santana@institutoareluna.pt',
    'helda.natal@institutoareluna.pt',
    'juliana.brito@institutoareluna.pt',
    'cleiton.prata@institutoareluna.pt',
    'awais.bashir@institutoareluna.pt'
);
```

**Hashes aplicados:**
- Raphael: `$2a$10$SkNPt0Iyw...`
- Helda: `$2a$10$TYz0vgI6b...`
- Juliana: `$2a$10$fYZqO5QMI...`
- Cleiton: `$2a$10$879uUkO9r...`
- Awais: `$2a$10$tkLrb0bvB...`

---

### **2. Criação de Identities (CRÍTICO!)**

```sql
-- Criar identities para todos os técnicos
INSERT INTO auth.identities (
    id, user_id, provider_id, provider, 
    identity_data, last_sign_in_at, created_at, updated_at
)
VALUES 
    (gen_random_uuid(), 'b9f5bbf2-...', 'b9f5bbf2-...', 'email', ...),
    (gen_random_uuid(), 'a894ef19-...', 'a894ef19-...', 'email', ...),
    (gen_random_uuid(), '19d4ba79-...', '19d4ba79-...', 'email', ...),
    (gen_random_uuid(), 'ded0a951-...', 'ded0a951-...', 'email', ...),
    (gen_random_uuid(), '5aec61ad-...', '5aec61ad-...', 'email', ...);
```

**O que é `auth.identities`?**

A tabela `auth.identities` é **OBRIGATÓRIA** no Supabase Auth. Ela conecta usuários aos seus provedores de autenticação (email, Google, GitHub, etc.).

**Sem esta tabela:**
- ❌ Login não funciona
- ❌ Reset de senha não funciona
- ❌ Verificação de email não funciona

---

### **3. Criação de Perfis (CAUSA DO ERRO!)**

```sql
-- Criar perfis para TODOS os 5 técnicos
INSERT INTO public.user_profiles (user_id, tenant_id, is_active, created_at, updated_at)
VALUES 
    ('b9f5bbf2-d116-4c95-beb4-9b4b177eff43', '00000000-0000-0000-0000-000000000002', true, NOW(), NOW()),
    ('a894ef19-37da-42f2-bc8a-22ee7b97f75c', '00000000-0000-0000-0000-000000000002', true, NOW(), NOW()),
    ('19d4ba79-8969-42b7-95c0-0fade6470cd9', '00000000-0000-0000-0000-000000000002', true, NOW(), NOW()),
    ('ded0a951-f788-4208-9738-d4e1caca789a', '00000000-0000-0000-0000-000000000002', true, NOW(), NOW()),
    ('5aec61ad-1f71-4bdd-9af3-3543c49560c7', '00000000-0000-0000-0000-000000000002', true, NOW(), NOW());
```

**Por que era crítico?**

O sistema tem políticas RLS que verificam `user_profiles` durante o login. Sem o registro, o banco retornava erro 500 "Database error querying schema".

---

## ✅ VERIFICAÇÃO FINAL

### **Checklist Completo:**

```sql
-- Verificar tudo de uma vez
SELECT 
    au.email,
    au.encrypted_password LIKE '$2a$10$%' as hash_ok,
    ai.provider as identity_provider,
    up.tenant_id as tem_perfil,
    COUNT(ur.id) as qtd_roles
FROM auth.users au
LEFT JOIN auth.identities ai ON au.id = ai.user_id
LEFT JOIN public.user_profiles up ON au.id = up.user_id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id AND ur.is_active = true
WHERE au.email IN (
    'raphael.santana@institutoareluna.pt',
    'helda.natal@institutoareluna.pt',
    'juliana.brito@institutoareluna.pt',
    'cleiton.prata@institutoareluna.pt',
    'awais.bashir@institutoareluna.pt'
)
GROUP BY au.email, au.encrypted_password, ai.provider, up.tenant_id
ORDER BY au.email;
```

### **Resultado Esperado:**

| Email | hash_ok | identity_provider | tem_perfil | qtd_roles |
|-------|---------|-------------------|------------|-----------|
| awais.bashir@... | ✅ true | ✅ email | ✅ 00000000-... | ✅ 1 |
| cleiton.prata@... | ✅ true | ✅ email | ✅ 00000000-... | ✅ 1 |
| helda.natal@... | ✅ true | ✅ email | ✅ 00000000-... | ✅ 1 |
| juliana.brito@... | ✅ true | ✅ email | ✅ 00000000-... | ✅ 1 |
| raphael.santana@... | ✅ true | ✅ email | ✅ 00000000-... | ✅ 1 |

---

## 🚀 TESTE DE LOGIN

```
URL: http://localhost:3002/login.html

Credenciais para teste:
Email: juliana.brito@institutoareluna.pt
Senha: 123456

Email: raphael.santana@institutoareluna.pt
Senha: 123456

(Todos os 5 técnicos usam a mesma senha: 123456)
```

---

## 📚 PROCESSO CORRETO PARA CRIAR USUÁRIOS

### **Ordem de Criação (SEMPRE seguir esta ordem!):**

```sql
-- 1️⃣ CRIAR USUÁRIO em auth.users
INSERT INTO auth.users (
    instance_id, id, aud, role, email, 
    encrypted_password, email_confirmed_at, 
    raw_user_meta_data, created_at, updated_at, 
    confirmation_token, is_sso_user
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'novo.usuario@dominio.com',
    crypt('senha123', gen_salt('bf', 10)),  -- 10 rounds!
    NOW(),  -- Email já confirmado
    '{"full_name": "Nome do Usuário", "email_verified": true}'::jsonb,
    NOW(),
    NOW(),
    '',
    false
);

-- 2️⃣ CRIAR IDENTITY (OBRIGATÓRIO!)
INSERT INTO auth.identities (
    id, user_id, provider_id, provider,
    identity_data, last_sign_in_at, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    id,
    id,
    'email',
    jsonb_build_object(
        'sub', id::text,
        'email', email,
        'email_verified', true
    ),
    NOW(),
    NOW(),
    NOW()
FROM auth.users
WHERE email = 'novo.usuario@dominio.com';

-- 3️⃣ CRIAR PERFIL (OBRIGATÓRIO!)
INSERT INTO public.user_profiles (user_id, tenant_id, is_active, created_at, updated_at)
SELECT 
    id,
    '00000000-0000-0000-0000-000000000002',  -- tenant_id
    true,
    NOW(),
    NOW()
FROM auth.users
WHERE email = 'novo.usuario@dominio.com';

-- 4️⃣ ATRIBUIR ROLES
INSERT INTO public.user_roles (user_id, role_id, tenant_id, is_active, created_at, updated_at)
SELECT 
    u.id,
    r.id,
    '00000000-0000-0000-0000-000000000002',
    true,
    NOW(),
    NOW()
FROM auth.users u
CROSS JOIN public.roles r
WHERE u.email = 'novo.usuario@dominio.com'
AND r.name = 'tecnico';
```

---

## 🔍 DEBUG DE PROBLEMAS DE LOGIN

### **Erro: "Database error querying schema"**

**Causas Possíveis:**
1. ✅ Falta de registro em `user_profiles` (RESOLVIDO!)
2. ✅ Falta de registro em `auth.identities` (RESOLVIDO!)
3. Trigger ou função quebrada
4. RLS policy muito restritiva

### **Comando de Debug:**

```sql
-- Verificar se usuário tem TUDO necessário
SELECT 
    'auth.users' as tabela,
    email,
    encrypted_password LIKE '$2a$10$%' as hash_correto
FROM auth.users 
WHERE email = 'usuario@dominio.com'

UNION ALL

SELECT 
    'auth.identities',
    i.identity_data->>'email',
    i.provider::text
FROM auth.identities i
JOIN auth.users u ON i.user_id = u.id
WHERE u.email = 'usuario@dominio.com'

UNION ALL

SELECT 
    'user_profiles',
    u.email,
    up.tenant_id::text
FROM public.user_profiles up
JOIN auth.users u ON up.user_id = u.id
WHERE u.email = 'usuario@dominio.com'

UNION ALL

SELECT 
    'user_roles',
    u.email,
    COUNT(ur.id)::text || ' roles'
FROM public.user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'usuario@dominio.com'
AND ur.is_active = true
GROUP BY u.email;
```

Se QUALQUER uma dessas linhas estiver faltando, o usuário não conseguirá fazer login!

---

## 📊 ARQUITETURA DO SISTEMA DE AUTH

```
┌─────────────────────────────────────────────────┐
│                  LOGIN REQUEST                   │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│           1. Supabase Auth verifica             │
│              ✓ auth.users (email/senha)         │
│              ✓ auth.identities (provider)       │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│       2. Sistema busca dados do usuário         │
│              ✓ user_profiles (tenant_id)        │
│              ✓ user_roles (permissões)          │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│            3. RLS policies verificam            │
│              ✓ Acesso ao tenant correto         │
│              ✓ Permissões de módulos            │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│               ✅ LOGIN SUCESSO!                  │
└─────────────────────────────────────────────────┘
```

Se QUALQUER uma dessas etapas falhar → **"Database error querying schema"**

---

## 🎯 CONCLUSÃO

Os 5 técnicos agora estão **100% configurados** e prontos para login:

- ✅ Hashes de senha corretos (bcrypt 10 rounds)
- ✅ Identities criadas (provider: email)
- ✅ Perfis criados (tenant_id configurado)
- ✅ Roles atribuídas (tecnico)
- ✅ Acessos configurados (módulo ProStoral)

**Todos podem fazer login com sucesso!** 🎉

---

**Data:** 24 de outubro de 2025
**Status:** ✅ RESOLVIDO COMPLETAMENTE
**Testado:** ✅ Sim

