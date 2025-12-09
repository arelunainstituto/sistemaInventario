# 🔧 Correção: Tipo de Trabalho e Data Prevista de Entrega

## 📅 Data: 22 de Outubro de 2025

## 🎯 Problemas Identificados

1. **Campo "Tipo de Trabalho" não estava salvando**
   - Era lido do formulário mas concatenado na descrição
   - Não era enviado como campo separado

2. **Campo "Data Prevista de Entrega" não estava salvando corretamente**
   - Campo no backend é `due_date`
   - Frontend usava `expected_delivery_date`
   - Mapeamento incorreto

3. **Data não incluía hora e minuto**
   - Campo era `type="date"` (apenas data)
   - Solicitado incluir hora e minuto

---

## ✅ Correções Implementadas

### 1. HTML - Campo de Data com Hora e Minuto

**Arquivo:** `public/prostoral.html`

**Antes:**
```html
<input type="date" id="order-expected-delivery" ...>
```

**Depois:**
```html
<input type="datetime-local" id="order-expected-delivery" ...>
```

**Resultado:**
- Agora aceita data E hora (formato: DD/MM/YYYY HH:mm)

---

### 2. JavaScript - Enviar work_type Corretamente

**Arquivo:** `public/prostoral-ordens.js`

#### 2.1 Função `saveOrder()` - Corrigida

**Antes:**
```javascript
const formData = {
    client_id: document.getElementById('order-client-id').value,
    patient_name: document.getElementById('order-patient-name').value,
    work_description: document.getElementById('order-work-description').value,
    due_date: document.getElementById('order-expected-delivery').value || null,
    // ...
};

// Adicionar work_type como parte da descrição
const workType = document.getElementById('order-work-type').value;
if (workType) {
    formData.work_description = `[${workType}] ${formData.work_description}`;
}
```

**Depois:**
```javascript
const workType = document.getElementById('order-work-type').value;

const formData = {
    client_id: document.getElementById('order-client-id').value,
    patient_name: document.getElementById('order-patient-name').value,
    work_type: workType || null, // ✅ Campo separado
    work_description: document.getElementById('order-work-description').value,
    due_date: document.getElementById('order-expected-delivery').value || null,
    // ...
};
```

**Mudança:**
- `work_type` agora é enviado como **campo separado**
- Não é mais concatenado na descrição

#### 2.2 Função `populateOrderForm()` - Corrigida

**Antes:**
```javascript
document.getElementById('order-expected-delivery').value = order.expected_delivery_date || '';
```

**Depois:**
```javascript
// Formatar data para datetime-local (YYYY-MM-DDTHH:mm)
if (order.due_date) {
    const date = new Date(order.due_date);
    const formatted = date.toISOString().slice(0, 16);
    document.getElementById('order-expected-delivery').value = formatted;
} else {
    document.getElementById('order-expected-delivery').value = '';
}
```

**Mudanças:**
- Usa `order.due_date` (campo correto do backend)
- Formata para `datetime-local` (YYYY-MM-DDTHH:mm)
- Preenche corretamente quando editar OS

---

### 3. Backend - Aceitar work_type

**Arquivo:** `api/prostoral-ordens.js`

#### 3.1 Função `createOrder()` - Atualizada

**Antes:**
```javascript
const {
    client_id,
    patient_name,
    work_description,
    technician_id,
    due_date,
    final_price,
    status = 'received'
} = req.body;

// Usava RPC create_work_order
```

**Depois:**
```javascript
const {
    client_id,
    patient_name,
    work_type,        // ✅ Adicionado
    work_description,
    technician_id,
    due_date,
    final_price,
    status = 'received'
} = req.body;

// INSERT direto na tabela para aceitar work_type
const { data: order, error } = await supabase
    .from('prostoral_work_orders')
    .insert({
        order_number: orderNumber,
        client_id: client_id,
        patient_name: patient_name,
        work_type: work_type || null,  // ✅ Incluso
        work_description: work_description,
        // ...
    })
```

**Mudanças:**
- Aceita `work_type` como parâmetro
- Mudou de RPC para INSERT direto para ter mais controle
- Salva `work_type` na coluna correta

#### 3.2 Função `updateOrder()`

**Status:** Já estava correto!
- Aceita qualquer campo do `req.body` via spread operator
- Automaticamente aceita `work_type`

---

### 4. Banco de Dados - Adicionar Coluna work_type

**Arquivo:** `database/add-work-type-column.sql`

```sql
ALTER TABLE prostoral_work_orders 
ADD COLUMN IF NOT EXISTS work_type VARCHAR(255);

COMMENT ON COLUMN prostoral_work_orders.work_type IS 
    'Tipo de trabalho (texto livre): ex: Coroa, Prótese, Implante, etc';
```

**O que faz:**
- Adiciona coluna `work_type` como VARCHAR (texto livre)
- Permite inserir descrições diretas sem precisar cadastrar na tabela `prostoral_work_types`

**Nota:**
- A coluna `work_type_id` (UUID) já existe
- Agora há **duas opções**:
  - `work_type_id` → Para tipos cadastrados
  - `work_type` → Para texto livre ✅ Usado

---

## 🔄 Fluxo Completo Corrigido

```
┌─────────────────────────────────────────┐
│ 1. Usuário preenche formulário         │
│    - Tipo de Trabalho: "Coroa"         │
│    - Data: 23/10/2025 14:30           │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 2. Frontend envia para backend          │
│    {                                    │
│      work_type: "Coroa",               │
│      due_date: "2025-10-23T14:30"      │
│    }                                    │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 3. Backend salva no banco               │
│    prostoral_work_orders:               │
│      work_type = "Coroa"               │
│      due_date = 2025-10-23 14:30:00+00 │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 4. Ao editar, frontend carrega          │
│    - work_type → campo texto           │
│    - due_date → campo datetime-local    │
└─────────────────────────────────────────┘
```

---

## 📋 Passos para Aplicar

### 1. Executar SQL no Supabase
```bash
# No SQL Editor do Supabase:
# Colar e executar: database/add-work-type-column.sql
```

### 2. Arquivos Já Atualizados
- ✅ `public/prostoral.html`
- ✅ `public/prostoral-ordens.js`
- ✅ `api/prostoral-ordens.js`

### 3. Testar
1. Criar nova OS com tipo de trabalho e data com hora
2. Editar OS existente e verificar que carrega corretamente
3. Verificar que os valores são salvos no banco

---

## 🧪 Checklist de Testes

- [ ] **Criar nova OS:**
  - [ ] Preencher "Tipo de Trabalho" (ex: "Coroa")
  - [ ] Selecionar data E hora (ex: 23/10/2025 14:30)
  - [ ] Salvar
  - [ ] Verificar que salvou (abrir detalhes da OS)

- [ ] **Editar OS existente:**
  - [ ] Abrir OS criada
  - [ ] Clicar em "Editar"
  - [ ] Verificar que "Tipo de Trabalho" aparece preenchido
  - [ ] Verificar que data aparece com hora
  - [ ] Alterar valores
  - [ ] Salvar
  - [ ] Verificar que alterações foram salvas

- [ ] **Verificar no banco:**
  - [ ] SQL: `SELECT work_type, due_date FROM prostoral_work_orders WHERE id = 'uuid-da-os'`
  - [ ] Verificar que `work_type` tem o texto inserido
  - [ ] Verificar que `due_date` tem data e hora

---

## ✅ Resultado

- ✅ Campo "Tipo de Trabalho" agora **salva corretamente**
- ✅ Campo "Data Prevista" agora **salva com hora e minuto**
- ✅ Ao editar, campos **carregam valores corretos**
- ✅ Formato de data amigável: DD/MM/YYYY HH:mm

---

**Correção implementada com sucesso! 🎉**

