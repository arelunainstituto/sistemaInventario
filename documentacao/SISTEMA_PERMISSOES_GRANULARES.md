# Sistema de Permissões Granulares - Documentação Completa

## 📋 Problema Identificado

Quando um administrador liberava **módulos** para um usuário (ex: Inventário, Laboratório), o sistema estava salvando apenas o **acesso genérico** ao módulo, **sem** salvar as **funções/permissões específicas** (Visualizar, Criar, Editar, Excluir).

### Comportamento Anterior (❌ Incorreto)

1. Admin marca checkboxes no frontend:
   - ✅ Inventário → Visualizar
   - ✅ Inventário → Criar
   - ✅ Inventário → Editar

2. Frontend envia: `["inventory:read", "inventory:create", "inventory:update"]`

3. Backend recebia e **só** salvava:
   - `user_module_access` → Usuário tem acesso ao módulo "Inventário"
   - **NÃO** salvava que ele pode "read", "create", "update"

4. Resultado: Usuário via o módulo mas sem controle de permissões granulares

---

## ✅ Solução Implementada

### Arquitetura de Permissões

O sistema agora usa uma **arquitetura de 5 tabelas** para controlar permissões:

```
┌─────────────────┐
│   permissions   │  ← Todas as permissões possíveis do sistema
│  (inventory:    │     (inventory:read, inventory:create, etc)
│   read, create) │
└─────────────────┘
         │
         │ (linked via)
         ▼
┌─────────────────┐
│role_permissions │  ← Liga roles a permissões específicas
└─────────────────┘
         │
         │ (belongs to)
         ▼
┌─────────────────┐
│     roles       │  ← Inclui roles customizadas (user_*)
│  (admin,        │     + roles customizadas geradas automaticamente
│   user_029e7c67)│
└─────────────────┘
         │
         │ (assigned to)
         ▼
┌─────────────────┐
│   user_roles    │  ← Liga usuários às suas roles
└─────────────────┘
         │
         │ (belongs to)
         ▼
┌─────────────────┐
│     users       │  ← Usuários do sistema
└─────────────────┘

PARALELO:

┌─────────────────┐
│user_module_     │  ← Controla se usuário pode ACESSAR o módulo
│     access      │     (visibilidade no dashboard)
└─────────────────┘
```

---

## 🔧 Implementação Técnica

### 1. Endpoint POST /api/admin/users (Criar Usuário)

**Arquivo:** `api/index.js` (linhas 3963-4092)

#### Fluxo de Criação:

```javascript
// ETAPA 4.1: Criar acesso aos módulos (user_module_access)
for (const moduleCode of moduleCodes) {
    // Insere: { user_id, module_id, is_active: true }
    // Exemplo: Usuário pode ACESSAR o módulo "Inventário"
}

// ETAPA 4.2: Criar role customizada
const roleName = `user_${userId.substring(0, 8)}_permissions`;
// Insere role: { 
//   name: "user_029e7c67_permissions",
//   display_name: "Permissões de Danielly Motta"
// }

// ETAPA 4.3: Vincular permissões granulares à role
for (const permName of permissions) {
    // Ex: "inventory:read", "inventory:create"
    
    // 1. Busca permission_id na tabela permissions
    // 2. Insere em role_permissions: { role_id, permission_id }
}

// ETAPA 4.4: Atribuir role ao usuário
// Insere em user_roles: { user_id, role_id }
```

#### Exemplo Prático:

**Entrada (Frontend):**
```json
{
  "email": "danielly@institutoareluna.pt",
  "full_name": "Danielly Motta",
  "permissions": [
    "inventory:read",
    "inventory:create",
    "inventory:update",
    "reports:read"
  ]
}
```

**Saída (Banco de Dados):**

1. **user_module_access:**
```sql
user_id: 029e7c67-759f-4662-91e4-8b4b9eba7454
module_id: <inventory_module_id>
is_active: true

user_id: 029e7c67-759f-4662-91e4-8b4b9eba7454
module_id: <reports_module_id>
is_active: true
```

2. **roles:**
```sql
id: a1b2c3d4-e5f6-7890-1234-567890abcdef
name: user_029e7c67_permissions
display_name: Permissões de Danielly Motta
is_active: true
```

3. **user_roles:**
```sql
user_id: 029e7c67-759f-4662-91e4-8b4b9eba7454
role_id: a1b2c3d4-e5f6-7890-1234-567890abcdef
is_active: true
```

4. **role_permissions:**
```sql
role_id: a1b2c3d4-e5f6-7890-1234-567890abcdef
permission_id: <inventory:read_id>

role_id: a1b2c3d4-e5f6-7890-1234-567890abcdef
permission_id: <inventory:create_id>

role_id: a1b2c3d4-e5f6-7890-1234-567890abcdef
permission_id: <inventory:update_id>

role_id: a1b2c3d4-e5f6-7890-1234-567890abcdef
permission_id: <reports:read_id>
```

---

### 2. Endpoint PUT /api/admin/users/:userId (Atualizar Usuário)

**Arquivo:** `api/index.js` (linhas 4217-4374)

#### Fluxo de Atualização:

```javascript
// ETAPA 1: Remove existing user_module_access
await supabaseAdmin.from('user_module_access').delete().eq('user_id', userId);

// ETAPA 2: Remove existing custom roles
// Busca roles que começam com "user_"
// Deleta role_permissions → user_roles → roles

// ETAPA 3: Recria tudo (mesma lógica do POST)
// 3.1: Criar novos user_module_access
// 3.2: Criar nova role customizada
// 3.3: Vincular permissões granulares
```

#### Importante: Limpeza de Roles Antigas

O sistema **identifica e remove** apenas roles customizadas (prefixo `user_`), **preservando** roles padrão como `admin`, `technician`, etc.

```javascript
if (userRole.roles?.name?.startsWith('user_')) {
    // Deletar role_permissions
    // Deletar user_roles
    // Deletar roles
}
```

---

## 📊 Validação e Testes

### Como Testar:

1. **Criar um novo usuário:**
   - Acesse `Configurações` → `Gerenciar Usuários`
   - Clique em `Adicionar Usuário`
   - Marque permissões específicas (ex: Inventário - Visualizar, Criar)
   - Salve

2. **Verificar no banco de dados:**

```sql
-- 1. Verificar user_module_access
SELECT 
    uma.user_id,
    m.code as module_code,
    uma.is_active
FROM user_module_access uma
JOIN modules m ON uma.module_id = m.id
WHERE uma.user_id = '{user_id}';

-- 2. Verificar role customizada
SELECT 
    r.name,
    r.display_name
FROM roles r
JOIN user_roles ur ON r.id = ur.role_id
WHERE ur.user_id = '{user_id}'
AND r.name LIKE 'user_%';

-- 3. Verificar permissões granulares
SELECT 
    p.name as permission_name,
    p.action,
    p.module_name
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permission_id
JOIN roles r ON rp.role_id = r.id
JOIN user_roles ur ON r.id = ur.role_id
WHERE ur.user_id = '{user_id}';
```

3. **Fazer login com o usuário criado:**
   - Login com o novo usuário
   - Verificar que os módulos aparecem no dashboard
   - Tentar executar ações específicas (criar, editar, deletar)
   - Confirmar que apenas ações permitidas funcionam

---

## 🔍 Logs do Sistema

O sistema agora gera logs detalhados durante a criação/atualização:

```
🔵 Iniciando criação de usuário: danielly@institutoareluna.pt
✅ Usuário criado no Auth: 029e7c67-759f-4662-91e4-8b4b9eba7454
✅ Usuário criado em public.users
✅ Perfil criado em user_profiles
📦 Módulos a liberar: [ 'inventory', 'reports' ]
🔑 Permissões específicas recebidas: [ 'inventory:read', 'inventory:create', 'inventory:update', 'reports:read' ]
✅ Acesso ao módulo inventory criado
✅ Acesso ao módulo reports criado
🎭 Criando role customizada para permissões granulares...
✅ Role customizada criada: a1b2c3d4-e5f6-7890-1234-567890abcdef
✅ Role atribuída ao usuário
✅ Permissão inventory:read vinculada à role
✅ Permissão inventory:create vinculada à role
✅ Permissão inventory:update vinculada à role
✅ Permissão reports:read vinculada à role
✅ Usuário criado com sucesso: danielly@institutoareluna.pt
```

---

## ⚠️ Permissões Não Encontradas

Se uma permissão não existir na tabela `permissions`, o sistema emite um **warning** mas **continua** o processo:

```
⚠️ Permissão não encontrada: inventory:special_action
```

### Como Adicionar Novas Permissões:

```sql
INSERT INTO permissions (name, action, module_name, description, resource)
VALUES (
    'inventory:special_action',
    'special_action',
    'inventory',
    'Descrição da ação especial',
    'inventory'
);
```

---

## 🛡️ Rollback e Segurança

### Sistema de Rollback Completo

Se **qualquer etapa** falhar, o sistema executa rollback **completo**:

```javascript
if (roleCreateError) {
    // Rollback:
    await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    await supabaseAdmin.from('users').delete().eq('id', createdUserId);
    await supabaseAdmin.from('user_profiles').delete().eq('user_id', createdUserId);
    await supabaseAdmin.from('user_module_access').delete().eq('user_id', createdUserId);
    throw new Error(`Falha ao criar role: ${roleCreateError.message}`);
}
```

### Validação de Admin

Apenas administradores podem criar/editar usuários:

```javascript
const isAdmin = req.user.roles?.some(role => role.toLowerCase().includes('admin')) ||
                req.user.permissions?.includes('users:manage') ||
                req.user.permissions?.includes('admin:all');

if (!isAdmin) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
}
```

---

## 📝 Commits Relacionados

- **4bf2736** - 🔐 CRÍTICO: Implementado sistema de permissões granulares
- **4a0c7d7** - 🚀 Removido modal de seleção no Inventário - Acesso direto
- **64ac825** - CRÍTICO: Correção de acesso aos módulos para usuários sem roles

---

## 🎯 Benefícios da Implementação

1. ✅ **Controle Granular:** Admin pode definir exatamente quais ações cada usuário pode fazer
2. ✅ **Auditoria:** Sistema de roles customizadas permite rastreamento preciso
3. ✅ **Escalabilidade:** Suporta qualquer número de permissões/módulos
4. ✅ **Compatibilidade:** Funciona em conjunto com roles padrão (admin, technician)
5. ✅ **Segurança:** Rollback automático previne estados inconsistentes
6. ✅ **Logs Detalhados:** Facilitam debugging e auditoria

---

## 🔄 Integração com Frontend

O frontend **não precisa de alterações**. Ele continua enviando:

```javascript
const permissions = [];
document.querySelectorAll('.permission-checkbox:checked').forEach(cb => {
    permissions.push(cb.dataset.permission); // Ex: "inventory:read"
});
```

O backend agora processa corretamente essas permissões e as salva de forma granular.

---

## 📚 Referências

- **Frontend:** `public/user-management.html`, `public/user-management.js`
- **Backend:** `api/index.js` (linhas 3886-4092, 4181-4374)
- **Middleware:** `api/middleware/auth.js` (autenticação e permissões)
- **Documentos Relacionados:**
  - `CORRECAO_FINAL_CRIACAO_USUARIOS.md`
  - `CORRECAO_ACESSO_ADMIN_MODULOS.md`
  - `CORRECAO_ENDPOINT_UPDATE_USUARIOS.md`

---

**Data:** 24/10/2025  
**Status:** ✅ Implementado e Testado  
**Versão:** 1.0.0

