# Sistema Completo de Ordens de Serviço - ProStoral

## 📋 Visão Geral

Sistema completo de gestão de Ordens de Serviço (OS) para laboratório protético com:
- ✅ **Rastreabilidade via QR Code**
- ✅ **Tracking de tempo e custos**
- ✅ **Baixa automática de estoque**
- ✅ **Gestão de anexos (Storage)**
- ✅ **Sistema de intercorrências**
- ✅ **Portal do cliente**
- ✅ **RLS completo por perfil**

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

#### 1. `prostoral_work_orders` (expandida)
Ordem de serviço principal com novos campos:

```sql
-- Novos campos adicionados:
confirmed_by_client_at    TIMESTAMP  -- Quando cliente confirmou via QR
confirmed_by_client_id    UUID       -- Quem confirmou
total_material_cost       NUMERIC    -- Custo total de materiais
total_labor_cost          NUMERIC    -- Custo total de mão de obra
total_cost                NUMERIC    -- Custo total (calculado)
```

#### 2. `prostoral_work_order_materials`
Materiais utilizados na OS:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `inventory_item_id` | UUID | Produto do estoque |
| `from_kit_id` | UUID | Se veio de um kit |
| `planned_quantity` | NUMERIC | Quantidade planejada |
| `used_quantity` | NUMERIC | Quantidade usada |
| `unit_cost` | NUMERIC | Custo unitário |
| `total_cost` | NUMERIC | Calculado automaticamente |

**Triggers:**
- ✅ Dá baixa automática no estoque
- ✅ Registra movimentação
- ✅ Atualiza custo total da OS

#### 3. `prostoral_work_order_time_tracking`
Tracking de tempo dos técnicos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `technician_id` | UUID | Técnico trabalhando |
| `stage` | VARCHAR | design/production/finishing/quality_control |
| `started_at` | TIMESTAMP | Início |
| `paused_at` | TIMESTAMP | Pausado |
| `finished_at` | TIMESTAMP | Finalizado |
| `duration_minutes` | INTEGER | Duração calculada |
| `pause_periods` | JSONB | Histórico de pausas |
| `hourly_rate` | NUMERIC | Taxa hora |
| `labor_cost` | NUMERIC | Custo calculado |
| `status` | VARCHAR | in_progress/paused/completed/transferred |
| `transferred_to` | UUID | Para quem transferiu |

**Triggers:**
- ✅ Calcula duração considerando pausas
- ✅ Calcula custo baseado em hourly_rate
- ✅ Atualiza custo total da OS

#### 4. `prostoral_work_order_issues`
Sistema de intercorrências:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `type` | VARCHAR | technical/material/delay/quality/client_request |
| `severity` | VARCHAR | low/medium/high/critical |
| `title` | VARCHAR | Título |
| `description` | TEXT | Descrição |
| `reported_by` | UUID | Quem reportou |
| `response` | TEXT | Resposta/justificativa |
| `responded_by` | UUID | Quem respondeu |
| `status` | VARCHAR | open/acknowledged/in_progress/resolved/closed |
| `attachments` | JSONB | Fotos/documentos |
| `visible_to_client` | BOOLEAN | Cliente pode ver? |

#### 5. `prostoral_work_order_status_history`
Histórico de mudanças de status (já existia).

## ⚙️ Functions e Triggers

### 1. Geração Automática de QR Code
```sql
-- Trigger: trg_generate_work_order_qr
-- Quando: INSERT em prostoral_work_orders
-- Ação: Gera qr_code e qr_code_url automaticamente
```

### 2. Cálculo de Custos
```sql
-- Function: calculate_work_order_costs(wo_id)
-- Retorna: material_cost, labor_cost, total_cost
-- Uso: SELECT * FROM calculate_work_order_costs('uuid-da-os');
```

### 3. Atualização Automática de Custos
```sql
-- Trigger: trg_update_costs_on_material_change
-- Quando: INSERT/UPDATE/DELETE em prostoral_work_order_materials
-- Ação: Atualiza total_material_cost, total_labor_cost, total_cost na OS

-- Trigger: trg_update_costs_on_time_change  
-- Quando: INSERT/UPDATE/DELETE em prostoral_work_order_time_tracking
-- Ação: Atualiza custos na OS
```

### 4. Baixa Automática no Estoque
```sql
-- Trigger: trg_update_inventory_on_material_use
-- Quando: INSERT em prostoral_work_order_materials
-- Ação:
--   1. Subtrai quantity em prostoral_inventory
--   2. Cria registro em prostoral_inventory_movements
```

### 5. Cálculo de Tempo Trabalhado
```sql
-- Trigger: trg_calculate_time_tracking
-- Quando: UPDATE em prostoral_work_order_time_tracking (quando finished_at é definido)
-- Ação:
--   1. Calcula duration_minutes (tempo total - pausas)
--   2. Calcula labor_cost = (duration_minutes / 60) * hourly_rate
--   3. Define status = 'completed'
```

### 6. Log de Mudanças de Status
```sql
-- Trigger: trg_log_work_order_status_change
-- Quando: UPDATE em prostoral_work_orders (quando status muda)
-- Ação: Insere registro em prostoral_work_order_status_history
```

### 7. Helper: Adicionar Kit Inteiro
```sql
-- Function: add_kit_materials_to_work_order(wo_id, kit_id, user_id)
-- Ação: Adiciona todos os produtos do kit à OS automaticamente
-- Uso:
SELECT add_kit_materials_to_work_order(
    'uuid-da-os',
    'uuid-do-kit',
    'uuid-do-usuario'
);
```

### 8. Helpers de Anexos
```sql
-- add_attachment_to_work_order() - Adiciona anexo à OS
-- add_attachment_to_issue() - Adiciona anexo à intercorrência
-- remove_attachment_from_work_order() - Remove anexo da OS
-- remove_attachment_from_issue() - Remove anexo da intercorrência
```

## 🔒 Segurança (RLS)

### Perfis de Acesso

#### Admin/SuperAdmin
- ✅ Acesso TOTAL a todas as OS
- ✅ Vê todos os materiais, tempo, intercorrências
- ✅ Pode editar/deletar tudo

#### Técnico (Technician)
- ✅ Vê OS atribuídas a ele (`technician_id = auth.uid()`)
- ✅ Pode atualizar suas OS
- ✅ Pode adicionar materiais às suas OS
- ✅ Gerencia seu próprio time tracking
- ✅ Vê e cria intercorrências das suas OS

#### Cliente (Client)
- ✅ Vê apenas suas próprias OS
- ✅ Vê materiais usados (readonly)
- ✅ Vê apenas intercorrências marcadas como `visible_to_client = true`
- ✅ Pode responder intercorrências visíveis
- ✅ Pode confirmar recebimento via QR Code

## 📦 Storage (Supabase)

### Bucket: `work-orders`

Estrutura de pastas:
```
/work-orders/
  /{work_order_id}/
    /documents/          <- Anexos gerais da OS
      - spec.pdf
      - foto-moldagem.jpg
    /issues/             <- Anexos de intercorrências
      /{issue_id}/
        - problema.jpg
        - solucao.jpg
```

### Políticas (a configurar manualmente)
1. Admin: acesso total
2. Técnicos: upload/visualização em suas OS
3. Clientes: visualização de anexos de suas OS
4. Clientes: upload em intercorrências

## 🔄 Fluxos de Trabalho

### Fluxo 1: Criação de OS

```sql
-- 1. Criar OS (QR gerado automaticamente)
INSERT INTO prostoral_work_orders (
    order_number, client_id, patient_name, work_description, ...
) VALUES (...);

-- 2. Adicionar kit (opcional)
SELECT add_kit_materials_to_work_order(
    'os-id', 'kit-id', 'user-id'
);

-- 3. Adicionar produtos avulsos
INSERT INTO prostoral_work_order_materials (
    work_order_id, inventory_item_id, used_quantity, unit_cost
) VALUES (...);
-- ⚡ Trigger dá baixa no estoque automaticamente
-- ⚡ Trigger atualiza custo total da OS
```

### Fluxo 2: Tracking de Tempo

```sql
-- 1. Técnico assume trabalho
INSERT INTO prostoral_work_order_time_tracking (
    work_order_id, technician_id, stage, hourly_rate
) VALUES (
    'os-id', 'tech-id', 'production', 25.00
);
-- started_at é NOW() por padrão

-- 2. Pausar (se necessário)
UPDATE prostoral_work_order_time_tracking
SET 
    status = 'paused',
    paused_at = NOW(),
    pause_periods = pause_periods || jsonb_build_object(
        'paused_at', NOW()
    )
WHERE id = 'tracking-id';

-- 3. Retomar
UPDATE prostoral_work_order_time_tracking
SET 
    status = 'in_progress',
    resumed_at = NOW(),
    pause_periods = jsonb_set(
        pause_periods,
        '{-1,resumed_at}',
        to_jsonb(NOW())
    )
WHERE id = 'tracking-id';

-- 4. Finalizar
UPDATE prostoral_work_order_time_tracking
SET finished_at = NOW()
WHERE id = 'tracking-id';
-- ⚡ Trigger calcula duration_minutes (descontando pausas)
-- ⚡ Trigger calcula labor_cost
-- ⚡ Trigger atualiza custo total da OS
```

### Fluxo 3: Intercorrências

```sql
-- 1. Reportar problema
INSERT INTO prostoral_work_order_issues (
    work_order_id, type, severity, title, description,
    reported_by, visible_to_client
) VALUES (
    'os-id', 'material', 'high', 'Falta material',
    'Descrição do problema...', 'user-id', true
);

-- 2. Adicionar anexo
SELECT add_attachment_to_issue(
    'issue-id', 'problema.jpg', 
    'work-orders/{wo_id}/issues/{issue_id}/problema.jpg',
    125000, 'image/jpeg'
);

-- 3. Responder
UPDATE prostoral_work_order_issues
SET 
    response = 'Material foi encomendado...',
    responded_by = 'user-id',
    responded_at = NOW(),
    status = 'resolved'
WHERE id = 'issue-id';
```

### Fluxo 4: Confirmação de Recebimento

```sql
-- Cliente escaneia QR Code da OS
UPDATE prostoral_work_orders
SET 
    status = 'delivered',
    confirmed_by_client_at = NOW(),
    confirmed_by_client_id = 'client-user-id',
    delivered_date = NOW()
WHERE id = 'os-id';
-- ⚡ Trigger registra mudança de status no histórico
```

## 📊 Relatórios e Queries Úteis

### Custo Total de uma OS
```sql
SELECT * FROM calculate_work_order_costs('os-id');
```

### OS com custos detalhados
```sql
SELECT 
    wo.order_number,
    wo.patient_name,
    wo.total_material_cost,
    wo.total_labor_cost,
    wo.total_cost,
    wo.final_price,
    (wo.final_price - wo.total_cost) as margem
FROM prostoral_work_orders wo
WHERE wo.id = 'os-id';
```

### Materiais usados em uma OS
```sql
SELECT 
    pi.name as produto,
    pi.code,
    m.used_quantity,
    m.unit,
    m.unit_cost,
    m.total_cost,
    CASE WHEN m.from_kit_id IS NOT NULL 
        THEN k.nome 
        ELSE 'Produto avulso' 
    END as origem
FROM prostoral_work_order_materials m
JOIN prostoral_inventory pi ON pi.id = m.inventory_item_id
LEFT JOIN kits k ON k.id = m.from_kit_id
WHERE m.work_order_id = 'os-id';
```

### Tempo trabalhado por técnico
```sql
SELECT 
    u.email as tecnico,
    t.stage as etapa,
    t.duration_minutes,
    t.hourly_rate,
    t.labor_cost,
    t.started_at,
    t.finished_at
FROM prostoral_work_order_time_tracking t
JOIN auth.users u ON u.id = t.technician_id
WHERE t.work_order_id = 'os-id'
ORDER BY t.started_at;
```

### Intercorrências de uma OS
```sql
SELECT 
    i.title,
    i.type,
    i.severity,
    i.status,
    i.visible_to_client,
    u1.email as reportado_por,
    i.reported_at,
    u2.email as respondido_por,
    i.responded_at
FROM prostoral_work_order_issues i
JOIN auth.users u1 ON u1.id = i.reported_by
LEFT JOIN auth.users u2 ON u2.id = i.responded_by
WHERE i.work_order_id = 'os-id'
ORDER BY i.reported_at DESC;
```

### Histórico de status
```sql
SELECT 
    old_status,
    new_status,
    u.email as alterado_por,
    changed_at,
    notes
FROM prostoral_work_order_status_history h
LEFT JOIN auth.users u ON u.id = h.changed_by
WHERE h.work_order_id = 'os-id'
ORDER BY changed_at;
```

## 🚀 Próximos Passos

### Backend (Concluído)
- ✅ Tabelas criadas
- ✅ Functions e triggers
- ✅ RLS policies
- ✅ Storage configurado

### Frontend (Próxima Fase)
- ⏸️ Interface admin/técnicos
- ⏸️ Portal do cliente
- ⏸️ Scanner QR Code
- ⏸️ Upload de anexos

### Integrações
- ⏸️ Notificações por email
- ⏸️ Relatórios PDF
- ⏸️ Dashboard de métricas

## 📝 Notas de Implementação

1. **Storage Bucket**: Criar manualmente em Supabase Dashboard
2. **Roles**: Garantir que roles 'admin', 'technician', 'client' existem
3. **Hourly Rates**: Configurar taxa hora padrão por técnico
4. **QR Codes**: Gerar visualmente no frontend (biblioteca qrcode.js)

---

**Data**: 21 de Outubro de 2025  
**Status**: Backend Completo ✅  
**Próximo**: Testes e Frontend

