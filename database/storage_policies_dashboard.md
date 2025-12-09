# Políticas de Storage - Copiar no Dashboard do Supabase

## Como Criar as Políticas

1. Acesse: **Storage** → **rh-documents** → **Policies**
2. Clique em **"New Policy"**
3. Para cada política abaixo, copie o código exatamente como está

---

## Política 1: Upload (INSERT)

**Policy name**: `rh_managers_upload_documents`

**Allowed operation**: `INSERT`

**Target roles**: `authenticated`

**USING expression**: (deixe vazio)

**WITH CHECK expression**:
```sql
bucket_id = 'rh-documents' AND 
EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = auth.uid()
  AND r.name IN ('Admin', 'rh_manager')
  AND ur.is_active = true
)
```

---

## Política 2: Read (SELECT)

**Policy name**: `rh_managers_read_documents`

**Allowed operation**: `SELECT`

**Target roles**: `authenticated`

**USING expression**:
```sql
bucket_id = 'rh-documents' AND 
EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = auth.uid()
  AND r.name IN ('Admin', 'rh_manager')
  AND ur.is_active = true
)
```

**WITH CHECK expression**: (deixe vazio)

---

## Política 3: Delete (DELETE)

**Policy name**: `rh_managers_delete_documents`

**Allowed operation**: `DELETE`

**Target roles**: `authenticated`

**USING expression**:
```sql
bucket_id = 'rh-documents' AND 
EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = auth.uid()
  AND r.name IN ('Admin', 'rh_manager')
  AND ur.is_active = true
)
```

**WITH CHECK expression**: (deixe vazio)

---

## 🚀 Política Temporária Simplificada (Para Testar Rápido)

Se as políticas acima não funcionarem, use esta temporariamente:

**Policy name**: `allow_all_authenticated`

**Allowed operation**: `All`

**Target roles**: `authenticated`

**USING expression**:
```sql
bucket_id = 'rh-documents'
```

**WITH CHECK expression**:
```sql
bucket_id = 'rh-documents'
```

Esta política permite que qualquer usuário autenticado faça upload. Depois você pode deletá-la e usar as políticas mais restritivas acima.
