# 🔧 Sistema de OS de Reparo

## 📋 Visão Geral

Sistema completo para gerenciar **Ordens de Serviço de Reparo** quando pacientes retornam para consertos. Cada OS de reparo é uma OS completa vinculada à OS original.

---

## ✨ Funcionalidades

### 1. **Criar OS de Reparo**
- ✅ Botão "Criar OS de Reparo" nos detalhes da OS
- ✅ Modal para preencher informações do reparo
- ✅ Vinculação automática à OS principal
- ✅ Numeração automática (ex: OS-123 → OS-123-R1, OS-123-R2)

### 2. **Tipos de Reparo**
- **Garantia (warranty)**: Reparo sem custo (coberto pela garantia)
- **Pago (billable)**: Reparo com custo para o cliente
- **Cortesia (goodwill)**: Reparo sem custo por cortesia

### 3. **Vinculação de OSs**
- ✅ OS de reparo vinculada à OS principal
- ✅ Custo total = OS Principal + todos os Reparos
- ✅ Histórico compartilhado
- ✅ Visualização hierárquica

### 4. **Identificação Visual**
- 🔧 Badge "REPARO" em OSs de reparo
- 🔗 Link para OS principal
- 📊 Contador de reparos na OS principal
- 💰 Custo total acumulado

---

## 🗄️ Estrutura do Banco de Dados

### Campos Adicionados em `prostoral_work_orders`:

```sql
is_repair BOOLEAN DEFAULT FALSE
  -- Indica se esta OS é um reparo

parent_order_id UUID REFERENCES prostoral_work_orders(id)
  -- ID da OS original que está sendo reparada

repair_type VARCHAR(50)
  -- Tipo: 'warranty', 'billable', 'goodwill'

repair_reason TEXT
  -- Motivo do reparo
```

### Views e Funções:

1. **prostoral_work_orders_with_repairs**
   - View com informações agregadas de reparos
   - Mostra quantidade e custo total dos reparos

2. **calculate_order_total_with_repairs(order_id)**
   - Calcula custo total incluindo reparos

3. **get_related_orders(order_id)**
   - Retorna OS principal + todos os reparos

---

## 📡 API Endpoints

### POST `/api/prostoral/orders/:id/repair`
Criar OS de reparo

**Body:**
```json
{
  "repair_type": "warranty|billable|goodwill",
  "repair_reason": "Descrição do motivo",
  "work_description": "Descrição do trabalho de reparo",
  "due_date": "2025-11-01T00:00:00Z",
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "order": { ...OS de reparo criada... },
  "message": "OS de reparo criada com sucesso"
}
```

### GET `/api/prostoral/orders/:id/related`
Buscar OS principal + todos os reparos

**Response:**
```json
{
  "success": true,
  "parent": { ...OS principal... },
  "repairs": [ ...lista de OSs de reparo... ],
  "total_cost": 1250.50,
  "repairs_count": 2
}
```

---

## 🎨 Interface

### 1. **Botão nos Detalhes da OS**
```html
<button id="btn-create-repair">
  <i class="fas fa-tools"></i>
  Criar OS de Reparo
</button>
```

### 2. **Modal de Criação**
Campos:
- Tipo de Reparo (warranty/billable/goodwill)
- Motivo do Reparo (textarea)
- Descrição do Trabalho (opcional)
- Data de Entrega (opcional)
- Prioridade (opcional)

### 3. **Seção de Reparos Vinculados**
Na OS principal, mostrar:
- Lista de todas as OSs de reparo
- Status de cada reparo
- Custos individuais e total
- Links para abrir cada reparo

### 4. **Indicadores Visuais**

**Badge de Reparo:**
```html
<span class="badge badge-repair">
  🔧 REPARO
</span>
```

**Link para OS Principal:**
```html
<div class="parent-order-link">
  <i class="fas fa-link"></i>
  OS Principal: <a href="#" onclick="viewOrder('parent-id')">OS-123</a>
</div>
```

---

## 💼 Casos de Uso

### Caso 1: Reparo em Garantia
1. Cliente retorna com problema em prótese
2. Laboratório abre OS de reparo tipo "Garantia"
3. OS de reparo não tem custo adicional
4. Trabalho é realizado e OS de reparo é finalizada
5. Histórico registrado na OS principal

### Caso 2: Reparo Pago
1. Cliente retorna após período de garantia
2. Laboratório abre OS de reparo tipo "Pago"
3. OS de reparo tem custo definido
4. Custo é somado ao custo total da OS principal
5. Cliente é cobrado pelo reparo

### Caso 3: Cortesia
1. Cliente retorna com problema menor
2. Laboratório decide fazer reparo de cortesia
3. OS de reparo tipo "Cortesia" (sem custo)
4. Gera histórico mas não impacta custos

---

## 📊 Fluxo de Trabalho

```
OS-1234 (Principal)
├── Status: Entregue
├── Custo: €500
│
├── OS-1234-R1 (Reparo 1 - Garantia)
│   ├── Status: Finalizado
│   ├── Custo: €0
│   └── Motivo: Ajuste de oclusão
│
└── OS-1234-R2 (Reparo 2 - Pago)
    ├── Status: Em Produção
    ├── Custo: €150
    └── Motivo: Trinca por uso inadequado

CUSTO TOTAL: €650 (€500 + €0 + €150)
```

---

## 🔒 Regras de Negócio

1. ✅ Não é possível criar reparo de um reparo
2. ✅ OS de reparo herda cliente e paciente da OS principal
3. ✅ Numeração automática sequencial (R1, R2, R3...)
4. ✅ Reparos em garantia/cortesia têm preço €0
5. ✅ Reparos pagos usam preço da OS original por padrão
6. ✅ OS principal não pode ser excluída se tiver reparos
7. ✅ Histórico é registrado em ambas as OSs

---

## 🧪 Como Testar

### 1. Criar OS de Reparo
```bash
# Abrir OS finalizada
# Clicar em "Criar OS de Reparo"
# Preencher formulário:
#   - Tipo: Garantia
#   - Motivo: "Ajuste de cor solicitado pelo paciente"
# Salvar
# Verificar que nova OS foi criada com número OS-XXX-R1
```

### 2. Verificar Vinculação
```bash
# Abrir OS de reparo criada
# Verificar badge "REPARO"
# Verificar link para OS principal
# Clicar no link
# Verificar que OS principal mostra o reparo vinculado
```

### 3. Verificar Custos
```bash
# Adicionar materiais/tempo na OS de reparo
# Verificar que custo é calculado
# Abrir OS principal
# Verificar que custo total inclui o reparo
```

---

## 📁 Arquivos Modificados

1. **database/add-repair-orders.sql**
   - Migração do banco de dados
   - Views e funções

2. **api/prostoral-ordens.js**
   - `createRepairOrder()`
   - `getRelatedOrders()`

3. **api/index.js**
   - Rotas de reparo

4. **public/prostoral.html**
   - Modal de criar reparo
   - Seção de reparos vinculados

5. **public/prostoral-ordens.js**
   - Frontend para criar reparo
   - Exibir reparos vinculados

---

## ✅ Checklist de Implementação

- [x] Migração do banco de dados
- [x] Backend - criar OS de reparo
- [x] Backend - buscar OSs relacionadas
- [x] Rotas da API
- [ ] Frontend - modal de criação
- [ ] Frontend - botão nos detalhes
- [ ] Frontend - seção de reparos
- [ ] Frontend - badges e indicadores
- [ ] Testes

---

## 🚀 Próximos Passos

1. Implementar interface do frontend
2. Adicionar filtros para OSs de reparo
3. Relatórios de reparos por período
4. Estatísticas de reparos (% garantia vs pagos)
5. Notificações automáticas para cliente

---

**Status**: 🟡 Em Implementação  
**Data**: 23/10/2025  
**Versão**: 1.0

