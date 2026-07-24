# Correção: Usuários com Módulos Desativados

## 🐛 Problema

Usuários com acesso liberado viam "Nenhum Módulo Disponível" ao fazer login, mesmo tendo permissões configuradas corretamente no painel de administração.

**Usuário Afetado:** Awais Bashir (e outros)

**Sintoma:**
```
Dashboard: "Nenhum Módulo Disponível"
Você ainda não tem acesso a nenhum módulo do sistema.
```

---

## 🔍 Investigação

### 1. Verificação no Banco de Dados

```sql
-- Verificar user_module_access do Awais
SELECT 
    uma.user_id,
    m.code,
    m.name,
    m.is_active as module_active,
    uma.is_active as access_active
FROM user_module_access uma
JOIN modules m ON uma.module_id = m.id
WHERE uma.user_id = '5aec61ad-1f71-4bdd-9af3-3543c49560c7';
```

**Resultado:**
```
user_id: 5aec61ad-1f71-4bdd-9af3-3543c49560c7
code: laboratory
name: Laboratório
module_active: FALSE  ❌
access_active: TRUE   ✅
```

### 2. Causa Raiz

Quando reorganizamos o dashboard, **desativamos** vários módulos:
- `laboratory` (antigo) → **DESATIVADO**
- `production` → **DESATIVADO**
- `maintenance` → **DESATIVADO**
- `purchases` → **DESATIVADO**

**Problema:** Usuários ficaram vinculados a módulos desativados!

A função SQL `get_user_accessible_modules` filtra apenas módulos ativos:

```sql
WHERE m.is_active = TRUE  -- Filtro que bloqueava o acesso
```

### 3. Módulos de Laboratório

| Código | Nome | Status |
|--------|------|--------|
| `laboratory` | Laboratório | ❌ DESATIVADO |
| `prostoral` | Laboratório ProStoral | ✅ ATIVO |
| `prostoral_client` | Laboratório Cliente | ✅ ATIVO |

---

## ✅ Solução Aplicada

### 1. Identificar Usuários Afetados

```sql
SELECT 
    up.display_name,
    u.email,
    m.code,
    m.name
FROM user_module_access uma
JOIN user_profiles up ON uma.user_id = up.user_id
JOIN auth.users u ON uma.user_id = u.id
JOIN modules m ON uma.module_id = m.id
WHERE m.is_active = false
AND uma.is_active = true;
```

**Usuários Afetados:**
- Awais Bashir
- Danielly Motta
- Dr. Leonardo Saraiva
- Eduardo Souza
- Sistema Validacao

### 2. Migração de Acessos

**Passo 1:** Deletar duplicatas (usuários que já tinham `prostoral` E `laboratory`)
```sql
DELETE FROM user_module_access
WHERE module_id = 'e5e2b041-5ac1-4fcd-b876-1081c1d08c3c' -- laboratory
AND user_id IN (
    SELECT user_id FROM user_module_access
    WHERE module_id = '7c00dc44-7477-493e-b2ad-90ca7143aaf8' -- prostoral
);
```

**Passo 2:** Migrar acessos de `laboratory` para `prostoral`
```sql
UPDATE user_module_access
SET module_id = '7c00dc44-7477-493e-b2ad-90ca7143aaf8' -- prostoral (ATIVO)
WHERE module_id = 'e5e2b041-5ac1-4fcd-b876-1081c1d08c3c'; -- laboratory (DESATIVADO)
```

**Passo 3:** Deletar acessos a módulos removidos permanentemente
```sql
DELETE FROM user_module_access
WHERE module_id IN (
    SELECT id FROM modules 
    WHERE code IN ('production', 'maintenance', 'purchases')
);
```

### 3. Verificação

```sql
-- Testar função SQL para o Awais
SELECT * FROM get_user_accessible_modules('5aec61ad-1f71-4bdd-9af3-3543c49560c7');
```

**Resultado Após Correção:**
```json
{
  "id": "7c00dc44-7477-493e-b2ad-90ca7143aaf8",
  "code": "prostoral",
  "name": "Laboratório ProStoral",
  "is_active": true,
  "route": "prostoral.html"
}
```

✅ **Módulo agora aparece corretamente!**

---

## 📊 Resultado

### Antes
```
Awais → user_module_access → laboratory (DESATIVADO)
                             ↓
                        BLOQUEADO
                             ↓
                  "Nenhum Módulo Disponível"
```

### Depois
```
Awais → user_module_access → prostoral (ATIVO)
                             ↓
                        PERMITIDO
                             ↓
                  "Laboratório ProStoral" ✅
```

---

## 🔧 Impacto

**Usuários Corrigidos:**
- ✅ Awais Bashir → Laboratório ProStoral
- ✅ Danielly Motta → Mantém múltiplos módulos ativos
- ✅ Dr. Leonardo Saraiva (Admin) → Removidos módulos desativados
- ✅ Eduardo Souza (Admin) → Removidos módulos desativados
- ✅ Sistema Validacao (Admin) → Removidos módulos desativados

**Módulos Removidos:**
- ❌ `production`, `maintenance`, `purchases` (não serão mais usados)

---

## 🛡️ Prevenção Futura

### Ao Desativar um Módulo:

1. **Verificar** usuários vinculados:
```sql
SELECT up.display_name, u.email
FROM user_module_access uma
JOIN user_profiles up ON uma.user_id = up.user_id
JOIN auth.users u ON uma.user_id = u.id
WHERE uma.module_id = '<module_id_to_deactivate>';
```

2. **Migrar** acessos para módulo equivalente (se houver):
```sql
UPDATE user_module_access
SET module_id = '<new_module_id>'
WHERE module_id = '<old_module_id>';
```

3. **OU** deletar acessos:
```sql
DELETE FROM user_module_access
WHERE module_id = '<module_id_to_deactivate>';
```

4. **Então** desativar o módulo:
```sql
UPDATE modules
SET is_active = false
WHERE id = '<module_id>';
```

---

## 📝 Lições Aprendidas

1. ✅ **Sempre verificar dependências** antes de desativar módulos
2. ✅ **Migrar dados** antes de mudanças estruturais
3. ✅ **Testar com usuários reais** após mudanças no dashboard
4. ✅ **Função SQL** `get_user_accessible_modules` funciona corretamente (filtrava corretamente por `is_active`)

---

**Data:** 24/10/2025  
**Status:** ✅ Resolvido e Documentado  
**Ticket:** Awais Bashir - "Nenhum Módulo Disponível"

