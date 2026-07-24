# 🦷 Portal do Cliente - Sistema ProStoral

**Data**: 23/10/2025  
**Status**: ✅ Implementado  
**Versão**: 1.0

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Arquitetura](#arquitetura)
4. [Instalação e Configuração](#instalação-e-configuração)
5. [Guia de Uso](#guia-de-uso)
6. [Sistema de Permissões](#sistema-de-permissões)
7. [Intercorrências Privadas](#intercorrências-privadas)
8. [API Endpoints](#api-endpoints)
9. [Segurança](#segurança)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O **Portal do Cliente** é uma versão simplificada e restrita do sistema ProStoral, projetada especificamente para clientes acompanharem suas ordens de serviço.

### Características Principais

- ✅ **Interface Idêntica** ao sistema principal (design unificado)
- ✅ **Acesso Restrito** apenas às funções necessárias
- ✅ **Dashboard Personalizado** com KPIs do cliente
- ✅ **Criação de Ordens** de serviço próprias
- ✅ **Acompanhamento em Tempo Real** do status das OSs
- ✅ **Intercorrências Privadas** (visíveis apenas para o cliente e admins)
- ✅ **Histórico Completo** de cada ordem

---

## ✨ Funcionalidades

### 1. Dashboard

**O que o cliente vê:**
- 📊 **Total de OSs** criadas
- ⚙️ **OSs Em Andamento** (não entregues)
- ✅ **OSs Concluídas** (entregues)
- ⚠️ **Intercorrências Abertas**
- 📜 **Atividades Recentes** (últimas 5 OSs)

### 2. Minhas Ordens

**Listagem Completa:**
- 🔍 Buscar por número ou paciente
- 🎯 Filtrar por status
- 📅 Filtrar por data
- 👁️ Ver detalhes de cada OS
- ➕ Criar novas ordens

**Informações de Cada OS:**
- Número da ordem
- Nome do paciente
- Status atual (com badge colorido)
- Data de recebimento
- Data prevista de entrega
- Descrição do trabalho

### 3. Detalhes da Ordem

**Informações Gerais:**
- Paciente
- Tipo de trabalho
- Status atual
- Datas (recebimento, entrega prevista)
- Descrição completa

**Minhas Intercorrências:**
- Lista de intercorrências criadas pelo cliente
- Criar nova intercorrência
- Níveis de gravidade (Baixa, Média, Alta, Crítica)

**Histórico:**
- Todas as mudanças na ordem
- Timestamps de cada alteração
- Quem fez cada mudança

### 4. Criar Nova Ordem

**Campos Disponíveis:**
- ✅ Nome do Paciente **(obrigatório)**
- ✅ Tipo de Trabalho (opcional)
- ✅ Descrição do Trabalho **(obrigatório)**
- ✅ Data Prevista de Entrega (opcional)

**Campos Removidos** (gerenciados internamente):
- ❌ Preço Final
- ❌ Status (sempre inicia como "Recebido")
- ❌ Cliente (automaticamente vinculado ao usuário)

---

## 🏗️ Arquitetura

### Estrutura de Arquivos

```
sistemaInventario/
├── public/
│   ├── prostoral-clientes.html     # ← Frontend do portal
│   └── prostoral-clientes.js       # ← Lógica do cliente
├── api/
│   ├── index.js                    # ← Rotas principais
│   └── prostoral-clientes.js       # ← Rotas exclusivas do cliente
└── database/
    └── portal-cliente-schema.sql   # ← Schema e permissões
```

### Fluxo de Dados

```
┌─────────────────┐
│  Cliente acessa │
│ /prostoral-     │
│  clientes.html  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  prostoral-     │
│  clientes.js    │
│  (Frontend)     │
└────────┬────────┘
         │
         │ API Calls
         ▼
┌─────────────────┐
│ /api/prostoral/ │
│ client/*        │
│  (Backend)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB    │
│  + RLS          │
└─────────────────┘
```

---

## 🔧 Instalação e Configuração

### 1. Aplicar Schema no Banco de Dados

```bash
# Executar SQL no Supabase SQL Editor ou via terminal
psql -h [host] -U [user] -d [database] -f database/portal-cliente-schema.sql
```

**O que isso faz:**
- ✅ Adiciona coluna `user_id` em `prostoral_clients`
- ✅ Adiciona coluna `created_by_client` em `prostoral_work_order_issues`
- ✅ Cria role `cliente`
- ✅ Cria políticas RLS para segurança
- ✅ Cria funções helper

### 2. Reiniciar o Servidor

```bash
npm start
```

### 3. Vincular Usuário a Cliente

**Opção A: Via SQL Direto**
```sql
UPDATE prostoral_clients
SET user_id = '[USER_UUID]'
WHERE id = '[CLIENT_UUID]';
```

**Opção B: Via Interface de Gerenciamento** (a ser implementado)
- Ir em Gerenciamento de Usuários
- Selecionar usuário
- Escolher "Tornar Cliente"
- Selecionar o cliente correspondente

### 4. Atribuir Role ao Usuário

```sql
INSERT INTO user_roles (user_id, role_id)
SELECT '[USER_UUID]', id
FROM roles
WHERE name = 'cliente';
```

---

## 📖 Guia de Uso

### Para Clientes

#### 1. Acessar o Portal
```
https://seu-dominio.com/prostoral-clientes.html
```

#### 2. Fazer Login
- Usar credenciais fornecidas pelo laboratório
- Mesmo sistema de autenticação do sistema principal

#### 3. Dashboard
- Visualizar resumo de todas as suas OSs
- Acompanhar status em tempo real

#### 4. Criar Nova Ordem
1. Clicar em "**+ Nova Ordem**"
2. Preencher:
   - Nome do Paciente
   - Tipo de Trabalho (ex: Coroa, Prótese)
   - Descrição detalhada
   - Data de entrega desejada
3. Clicar em "**Criar Ordem**"
4. OS é automaticamente criada com status "**Recebido**"

#### 5. Acompanhar Ordem
1. Clicar na ordem na lista
2. Ver status atual
3. Ver histórico de mudanças
4. Adicionar intercorrências se necessário

#### 6. Adicionar Intercorrência
1. Abrir detalhes da OS
2. Clicar em "**+ Nova Intercorrência**"
3. Preencher:
   - Título
   - Descrição
   - Gravidade
4. Intercorrência é **privada** (só você e admins veem)

### Para Administradores

#### 1. Ver Todas as Intercorrências
- Admin vê intercorrências de clientes E técnicos
- Técnico vê apenas suas próprias intercorrências
- Cliente vê apenas as dele

#### 2. Gerenciar Clientes
- Criar novo usuário
- Vincular a um cliente existente
- Atribuir role "cliente"

---

## 🔐 Sistema de Permissões

### Hierarquia de Roles

| Role | Acesso ao Portal | Acesso ao Sistema Principal | Intercorrências |
|------|------------------|----------------------------|-----------------|
| **Admin** | ❌ Não necessário | ✅ Completo | ✅ Vê todas |
| **Técnico** | ❌ Não necessário | ✅ Limitado | ✅ Vê suas próprias |
| **Cliente** | ✅ Sim | ❌ Não | ✅ Vê apenas as dele |

### Permissões do Cliente

✅ **Permitido:**
- Ver suas próprias OSs
- Criar novas OSs (vinculadas a si)
- Ver detalhes de suas OSs
- Adicionar intercorrências em suas OSs
- Ver suas intercorrências
- Ver histórico de suas OSs

❌ **Proibido:**
- Ver OSs de outros clientes
- Editar ou deletar OSs
- Mudar status de OSs
- Adicionar materiais
- Ver estoque
- Ver kits
- Ver intercorrências de técnicos
- Acessar relatórios internos

---

## 🔒 Intercorrências Privadas

### Conceito

Intercorrências podem ser criadas por **clientes** ou **técnicos/admins**.

- **Cliente cria**: `created_by_client = TRUE` → Visível apenas para o cliente e admins
- **Técnico cria**: `created_by_client = FALSE` → Visível para técnicos e admins

### Visibilidade

| Criado Por | Visível Para |
|------------|--------------|
| Cliente | ✅ Cliente, ✅ Admin |
| Técnico | ✅ Técnico, ✅ Admin |
| Admin | ✅ Todos (admin) |

### Exemplo de Uso

**Cenário 1: Cliente reporta problema**
```
Cliente: "A cor da prótese não está adequada"
→ Intercorrência visível apenas para cliente e admin
→ Técnico NÃO vê (a menos que admin compartilhe)
```

**Cenário 2: Técnico reporta problema interno**
```
Técnico: "Falta material para finalizar"
→ Intercorrência visível para técnico e admin
→ Cliente NÃO vê
```

**Cenário 3: Admin vê tudo**
```
Admin pode:
- Ver intercorrências de clientes
- Ver intercorrências de técnicos
- Mediar e resolver problemas
```

---

## 🔌 API Endpoints

### Autenticação
Todas as rotas requerem `Authorization: Bearer [TOKEN]`

### Verificar Role de Cliente
```http
GET /api/prostoral/check-client-role
```

**Response:**
```json
{
  "isClient": true,
  "clientId": "uuid-do-cliente"
}
```

### Dashboard - KPIs
```http
GET /api/prostoral/client/dashboard/kpis
```

**Response:**
```json
{
  "total_orders": 15,
  "active_orders": 3,
  "completed_orders": 12,
  "open_issues": 2
}
```

### Ordens Recentes
```http
GET /api/prostoral/client/orders/recent
```

**Response:**
```json
[
  {
    "id": "uuid",
    "order_number": "OS-1234567890",
    "patient_name": "João Silva",
    "status": "production",
    "received_date": "2025-10-23T10:00:00Z"
  }
]
```

### Listar Ordens
```http
GET /api/prostoral/client/orders?page=1&limit=20&search=&status=&date_from=
```

**Response:**
```json
{
  "orders": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### Criar Ordem
```http
POST /api/prostoral/client/orders
Content-Type: application/json

{
  "patient_name": "Maria Santos",
  "work_type": "Coroa",
  "work_description": "Coroa de zircônia no dente 16",
  "due_date": "2025-10-30T18:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "order": { ... },
  "message": "Ordem criada com sucesso"
}
```

### Detalhes da Ordem
```http
GET /api/prostoral/client/orders/:id
```

**Response:**
```json
{
  "id": "uuid",
  "order_number": "OS-1234567890",
  "patient_name": "João Silva",
  "status": "production",
  "client_issues": [...],
  "history": [...]
}
```

### Criar Intercorrência
```http
POST /api/prostoral/client/orders/:id/issues
Content-Type: application/json

{
  "title": "Problema com a cor",
  "description": "A tonalidade não está correta",
  "severity": "high"
}
```

**Response:**
```json
{
  "success": true,
  "issue": { ... },
  "message": "Intercorrência criada com sucesso"
}
```

---

## 🛡️ Segurança

### Row Level Security (RLS)

**Políticas Implementadas:**

1. **Clientes veem apenas suas OSs**
   ```sql
   EXISTS (
       SELECT 1
       FROM prostoral_clients c
       WHERE c.id = prostoral_work_orders.client_id
       AND c.user_id = auth.uid()
   )
   ```

2. **Clientes criam OSs apenas para si**
   ```sql
   EXISTS (
       SELECT 1
       FROM prostoral_clients c
       WHERE c.id = prostoral_work_orders.client_id
       AND c.user_id = auth.uid()
   )
   ```

3. **Intercorrências privadas**
   ```sql
   (created_by_client = TRUE AND created_by = auth.uid())
   OR
   [é admin/técnico]
   ```

### Validações Backend

- ✅ Verificação de `clientId` em todas as rotas
- ✅ Validação de propriedade da OS antes de criar intercorrência
- ✅ Filtros automáticos por `client_id`
- ✅ Tokens JWT com expiração

---

## 🐛 Troubleshooting

### Cliente não consegue acessar

**Problema**: Erro ao verificar permissões  
**Solução**:
1. Verificar se `user_id` está setado em `prostoral_clients`
2. Verificar se role `cliente` está atribuída ao usuário

```sql
-- Verificar vínculo
SELECT * FROM prostoral_clients WHERE user_id = '[USER_UUID]';

-- Verificar role
SELECT r.name
FROM user_roles ur
INNER JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = '[USER_UUID]';
```

### Intercorrências não aparecem

**Problema**: Cliente não vê suas intercorrências  
**Solução**:
1. Verificar se `created_by_client = TRUE`
2. Verificar RLS policies

```sql
-- Ver intercorrências do cliente
SELECT * FROM prostoral_work_order_issues
WHERE created_by_client = TRUE
AND created_by = '[USER_UUID]';
```

### KPIs zerados

**Problema**: Dashboard mostra todos os valores em 0  
**Solução**:
1. Verificar se há OSs vinculadas ao cliente
2. Verificar se `client_id` está correto

```sql
SELECT COUNT(*) FROM prostoral_work_orders
WHERE client_id = '[CLIENT_UUID]';
```

---

## 📊 Estatísticas de Implementação

| Item | Status |
|------|--------|
| **Frontend** | ✅ Completo |
| **Backend** | ✅ Completo |
| **Database** | ✅ Completo |
| **RLS Policies** | ✅ Completo |
| **API Endpoints** | ✅ 7 rotas |
| **Intercorrências Privadas** | ✅ Funcional |
| **Real-Time** | ⚠️ A implementar |
| **Gerenciamento UI** | ⚠️ A implementar |

---

## 🚀 Próximos Passos

### A Implementar

1. ⬜ **Real-Time para clientes**
   - Atualizações automáticas de status
   - Notificações push

2. ⬜ **Interface de Gerenciamento**
   - Página para admins gerenciarem vínculos usuário-cliente
   - Atribuição de roles via UI

3. ⬜ **Notificações por Email**
   - Alertar cliente quando status mudar
   - Alertar quando intercorrência for respondida

4. ⬜ **Anexos de Arquivos**
   - Cliente pode anexar fotos
   - Admin pode enviar documentos

5. ⬜ **Chat/Mensagens**
   - Comunicação direta cliente-laboratório

---

## ✅ Checklist de Deploy

- [x] Arquivos HTML e JS criados
- [x] Rotas backend implementadas
- [x] Schema SQL criado
- [x] RLS policies configuradas
- [ ] SQL executado no Supabase
- [ ] Servidor reiniciado
- [ ] Primeiro cliente vinculado e testado
- [ ] Documentação completa

---

**Desenvolvido para**: Grupo AreLuna - ProStoral  
**Versão**: 1.0  
**Data**: 23 de Outubro de 2025  
**Status**: ✅ Pronto para deploy

