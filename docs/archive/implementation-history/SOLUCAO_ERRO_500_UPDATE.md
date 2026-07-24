# 🔧 Solução: Erro 500 ao Atualizar Ordem de Serviço

## 🎯 Problema

Ao tentar **editar/atualizar** uma ordem de serviço existente, ocorre erro 500:
```
PUT http://localhost:3002/api/prostoral/orders/{id} 500 (Internal Server Error)
```

---

## 🔍 Causa Provável

O erro acontece porque o campo **`work_type`** está sendo enviado no UPDATE, mas a **coluna não existe** no banco de dados.

---

## ✅ Solução

### Passo 1: Executar SQL para Criar a Coluna

No **SQL Editor do Supabase**, execute:

```sql
-- Adicionar coluna work_type
ALTER TABLE prostoral_work_orders 
ADD COLUMN IF NOT EXISTS work_type VARCHAR(255);

-- Adicionar comentário
COMMENT ON COLUMN prostoral_work_orders.work_type IS 
    'Tipo de trabalho (texto livre): ex: Coroa, Prótese, Implante, etc';
```

**Ou execute o arquivo completo:**
```bash
database/add-work-type-column.sql
```

---

### Passo 2: Verificar se a Coluna Foi Criada

No SQL Editor, execute:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'prostoral_work_orders' 
AND column_name = 'work_type';
```

**Resultado esperado:**
```
column_name | data_type
------------|---------------
work_type   | character varying
```

---

### Passo 3: Testar Novamente

1. Tente **editar** uma ordem de serviço
2. Altere o "Tipo de Trabalho"
3. Salve
4. Deve funcionar agora! ✅

---

## 🔍 Como Identificar o Erro Específico

Com as melhorias que fiz no código, agora você verá no **Console do Navegador** (F12):

```javascript
❌ Erro na resposta: {
  "success": false,
  "error": "column \"work_type\" of relation \"prostoral_work_orders\" does not exist",
  "details": "..."
}
```

Isso confirma que o problema é a coluna faltando.

---

## 📋 Checklist de Diagnóstico

Se ainda tiver erro 500:

### 1. Verificar Console do Navegador (F12)
- [ ] Abrir DevTools (F12)
- [ ] Aba "Console"
- [ ] Ver mensagem `❌ Erro na resposta:`
- [ ] Anotar a mensagem de erro

### 2. Verificar Logs do Servidor
```bash
# Se estiver rodando localmente
tail -f /Users/insitutoareluna/Documents/sistemaInventario/server.log | grep "Erro"
```

Procurar por:
- `❌ Erro ao atualizar ordem:`
- `❌ Detalhes do erro:`

### 3. Verificar Campos no Banco
```sql
-- Listar TODAS as colunas da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'prostoral_work_orders'
ORDER BY ordinal_position;
```

---

## 🛠️ Melhorias Implementadas

### Backend (`api/prostoral-ordens.js`)

1. **Logs detalhados:**
   ```javascript
   console.log('📝 Atualizando ordem:', id);
   console.log('📦 Dados para atualizar:', updateData);
   ```

2. **Limpeza de campos:**
   - Remove relacionamentos (`client`, `materials`, `issues`, etc)
   - Remove campos imutáveis (`order_number`, `tenant_id`)

3. **Erro detalhado:**
   ```javascript
   return res.status(500).json({ 
       success: false, 
       error: error.message,
       details: error.details || error.hint
   });
   ```

### Frontend (`public/prostoral-ordens.js`)

1. **Logs de envio:**
   ```javascript
   console.log('📤 Enviando dados:', formData);
   ```

2. **Captura de erro detalhado:**
   ```javascript
   const errorData = await response.json();
   throw new Error(errorData.error || errorData.details);
   ```

---

## 🧪 Teste Completo

### Teste 1: Criar Nova OS
1. Clique em "Nova Ordem de Serviço"
2. Preencha todos os campos
3. Tipo de Trabalho: "Coroa"
4. Data: 23/10/2025 14:30
5. Salvar
6. ✅ Deve criar com sucesso

### Teste 2: Editar OS Existente
1. Clique no ícone de editar (✏️) em uma OS
2. Altere o "Tipo de Trabalho" para "Prótese"
3. Altere a data
4. Salvar
5. ✅ Deve atualizar com sucesso
6. Abrir novamente e verificar que os valores foram salvos

### Teste 3: Verificar no Banco
```sql
-- Ver última ordem criada/atualizada
SELECT 
    order_number,
    work_type,
    due_date,
    updated_at
FROM prostoral_work_orders
ORDER BY updated_at DESC
LIMIT 5;
```

---

## 🚨 Outros Erros Possíveis

### Erro: "column 'X' does not exist"
**Solução:** A coluna X não existe. Verifique o schema e crie a coluna necessária.

### Erro: "tenant_id não corresponde"
**Solução:** Usuário tentando editar OS de outro tenant. Verificar RLS.

### Erro: "violates foreign key constraint"
**Solução:** ID de cliente ou técnico não existe. Verificar se IDs são válidos.

---

## ✅ Resultado Esperado

Após executar o SQL:
- ✅ Criar nova OS funciona
- ✅ **Editar OS existente funciona** (antes dava erro 500)
- ✅ Tipo de trabalho salva corretamente
- ✅ Data com hora salva corretamente

---

**Problema resolvido! 🎉**

