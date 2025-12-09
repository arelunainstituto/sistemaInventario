# Implementação: Intercorrências e Permissões

## 📅 Data: 22 de Outubro de 2025

## ✅ Implementações Realizadas

### 1. Políticas RLS de Intercorrências ✅

**Arquivo modificado:** `database/work-orders-rls.sql`

**Alterações:**
- Removidas políticas antigas que permitiam técnicos verem intercorrências de suas OS
- Implementadas novas políticas onde:
  - ✅ **Admins veem TODAS as intercorrências** (verificando role na tabela user_roles)
  - ✅ **Usuários comuns veem APENAS suas próprias intercorrências** (reported_by = auth.uid())
  - ✅ Usuários podem criar intercorrências (INSERT)
  - ✅ Usuários podem atualizar apenas suas próprias intercorrências (UPDATE)

**Políticas criadas:**
```sql
-- Admin see all issues (acesso total)
-- Users see only their own issues (SELECT - apenas próprias)
-- Users create their own issues (INSERT)
-- Users update their own issues (UPDATE - apenas próprias)
```

---

### 2. Interface de Intercorrências ✅

**Arquivo modificado:** `public/prostoral.html`

**Adições:**

#### 2.1 Botão "Nova Intercorrência"
- Adicionado na seção de Intercorrências dos detalhes da OS
- Localização: Linha ~1620
- Estilo: Botão laranja com ícone de +

#### 2.2 Modal de Intercorrência
- Modal completo para criar intercorrências
- Campos:
  - **Tipo** (select): Técnico, Material, Atraso, Qualidade, Solicitação do Cliente, Outro
  - **Gravidade** (select): Baixa, Média, Alta, Crítica
  - **Título** (text): Máximo 255 caracteres
  - **Descrição** (textarea): Campo obrigatório
- Mensagem informativa: Indica que apenas o criador e admins verão
- Design responsivo com tema dark mode

---

### 3. Funções JavaScript ✅

**Arquivo modificado:** `public/prostoral-ordens.js`

**Funções implementadas:**

#### 3.1 `showAddIssueModal()`
- Abre o modal de intercorrência
- Limpa todos os campos do formulário
- Define gravidade padrão como "média"

#### 3.2 `saveIssue()`
- Valida campos obrigatórios
- Faz POST para `/api/prostoral/orders/:id/issues`
- Envia dados: type, severity, title, description
- Define `visible_to_client: false` por padrão
- Recarrega detalhes da OS após sucesso

#### 3.3 `renderOrderIssues()` - Atualizada
- Melhorado para mostrar tipo da intercorrência
- Adiciona formatação de tipo usando `formatIssueType()`
- Layout com espaçamento entre cards

#### 3.4 `renderOrderHistory()` - Atualizada ✅ NOVO
- **Filtra intercorrências no histórico/linha do tempo**
- Remove registros do tipo `issue_created` e `issue_updated` se o usuário não tem acesso à intercorrência
- Compara `issue_id` do metadata com lista de IDs acessíveis
- Usuários comuns veem apenas histórico de suas intercorrências
- Admins veem histórico completo (todas as intercorrências)

#### 3.5 `formatIssueType()`
- Nova função formatter
- Traduz tipos de intercorrências para português

#### 3.6 Propriedade `accessibleIssueIds` ✅ NOVO
- Array que guarda IDs das intercorrências acessíveis ao usuário
- Preenchido em `renderOrderDetails()` a partir das issues retornadas (já filtradas por RLS)
- Usado para filtrar histórico

#### 3.7 Event Listeners
- Adicionados em `setupModalCloseButtons()` para modal de intercorrência
- Adicionados em `setupDetailsActionButtons()` para:
  - Botão "Nova Intercorrência" (`btn-show-add-issue`)
  - Botão "Salvar Intercorrência" (`btn-confirm-add-issue`)

---

### 4. Sistema de Permissões - Verificado ✅

**Status:** Sistema já estava funcionando corretamente!

#### 4.1 Dashboard (`public/dashboard.html`)
- ✅ Carrega módulos via `/api/modules/available`
- ✅ Respeita permissões do usuário
- ✅ Renderiza apenas módulos acessíveis
- ✅ Mostra mensagem se usuário não tem acesso a nenhum módulo

#### 4.2 Backend (`api/index.js`)
- ✅ Endpoint `/api/modules/available` usa RPC `get_user_accessible_modules`
- ✅ Endpoint `/api/user` retorna roles e permissions corretamente
- ✅ Endpoint `/api/auth/me` usa middleware `getCurrentUser`

#### 4.3 Middleware (`api/middleware/auth.js`)
- ✅ `authenticateToken` adiciona roles e permissions ao req.user
- ✅ `getCurrentUser` retorna dados completos do usuário
- ✅ `requireModuleAccess` verifica acesso a módulos específicos
- ✅ `requirePermission` verifica permissões específicas
- ✅ `requireAdmin` verifica se usuário é admin

#### 4.4 Gerenciamento de Usuários (`public/user-management.html` e `.js`)
- ✅ Apenas admins podem acessar
- ✅ Permite criar usuários com permissões específicas
- ✅ Permite definir usuário como admin (acesso total)
- ✅ Permite ativar/desativar usuários
- ✅ Mostra badges de roles e módulos

---

## 🔄 Fluxo de Intercorrências

### Como Funciona:

1. **Usuário acessa OS**
   - Entra nos detalhes de uma ordem de serviço
   - Visualiza seção de "Intercorrências"

2. **Criar Intercorrência**
   - Clica em "Nova Intercorrência"
   - Preenche formulário (tipo, gravidade, título, descrição)
   - Clica em "Salvar"
   - Sistema registra com `reported_by = user_id`
   - Trigger automático cria entrada no histórico

3. **Visualização na Seção Intercorrências (RLS aplica filtro)**
   - **Se usuário é ADMIN**: Vê TODAS as intercorrências de todas as OS
   - **Se usuário NÃO é admin**: Vê APENAS as intercorrências que ELE criou
   - Backend filtra automaticamente via Row Level Security

4. **Visualização no Histórico/Timeline ✅ NOVO**
   - Intercorrências aparecem também no histórico da OS
   - **Frontend filtra** registros de intercorrências no histórico
   - Usuário comum: Vê apenas entradas de histórico de suas intercorrências
   - Admin: Vê todas as entradas de histórico (todas as intercorrências)
   - **Como funciona:**
     1. Backend retorna intercorrências filtradas por RLS
     2. Frontend guarda IDs das intercorrências acessíveis
     3. Ao renderizar histórico, filtra registros do tipo `issue_created` e `issue_updated`
     4. Só mostra se `issue_id` está na lista de IDs acessíveis

---

## 🗄️ Banco de Dados

### Tabela: `prostoral_work_order_issues`

**Campos principais:**
- `id` - UUID
- `work_order_id` - Referência à OS
- `type` - Tipo da intercorrência
- `severity` - Gravidade
- `title` - Título
- `description` - Descrição
- `reported_by` - UUID do usuário que reportou (usado no RLS!)
- `reported_at` - Data/hora do reporte
- `status` - Status (open, acknowledged, in_progress, resolved, closed)
- `visible_to_client` - Se cliente pode ver (padrão: false)

---

## 📋 Para Aplicar as Mudanças

### 1. Atualizar Políticas RLS no Supabase
```bash
# Executar no SQL Editor do Supabase
# Conteúdo do arquivo: database/work-orders-rls.sql
# Ou executar apenas a seção 4 (POLÍTICAS PARA prostoral_work_order_issues)
```

### 2. Arquivos já atualizados no código:
- ✅ `public/prostoral.html`
- ✅ `public/prostoral-ordens.js`
- ✅ `database/work-orders-rls.sql`

### 3. Não é necessário:
- ❌ Backend já tem endpoints de intercorrências funcionando
- ❌ Sistema de permissões já está funcional
- ❌ Gerenciamento de usuários já está funcional

---

## 🧪 Como Testar

### 1. Teste como Usuário Comum
```
1. Login com usuário não-admin
2. Acesse uma OS no Prostoral
3. Clique em "Nova Intercorrência"
4. Preencha e salve
5. Verifique que aparece na lista
6. Acesse outra OS
7. Crie intercorrência na outra OS
8. Volte para primeira OS
9. Verifique que só vê suas próprias intercorrências
```

### 2. Teste como Admin
```
1. Login com usuário admin
2. Acesse mesmas OS
3. Verifique que vê TODAS as intercorrências (de todos os usuários)
```

### 3. Teste Permissões de Dashboard
```
1. Crie usuário com acesso limitado (ex: só Inventário)
2. Login com esse usuário
3. Verifique que dashboard mostra apenas módulo Inventário
4. Tente acessar /prostoral.html diretamente
5. Deve ser bloqueado ou não funcionar
```

---

## ⚠️ Notas Importantes

### RLS (Row Level Security)
- As políticas RLS são aplicadas **automaticamente** pelo Supabase
- Não é necessário filtrar no código JavaScript ou backend
- O banco de dados já filtra os registros baseado em `auth.uid()`

### Permissões vs Módulos
- **Permissões**: Granulares por ação (inventory:read, inventory:create, etc)
- **Módulos**: Agrupamento visual no dashboard
- Sistema usa ambos em conjunto
- Admins têm acesso total a tudo

### Campos Automáticos
- `reported_by` é preenchido automaticamente no backend com `req.user.id`
- Frontend não envia esse campo
- RLS verifica esse campo para filtrar

---

## 📊 Resumo de Arquivos Modificados

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `database/work-orders-rls.sql` | SQL | Novas políticas RLS |
| `public/prostoral.html` | HTML | Botão + Modal |
| `public/prostoral-ordens.js` | JavaScript | 5 funções + event listeners |

**Total:** 3 arquivos modificados

---

## ✨ Funcionalidades Adicionadas

1. ✅ Botão "Nova Intercorrência" nos detalhes da OS
2. ✅ Modal para criar intercorrências
3. ✅ Validação de campos obrigatórios
4. ✅ Integração com API existente
5. ✅ Visibilidade filtrada por usuário na seção de intercorrências (RLS)
6. ✅ **Visibilidade filtrada no histórico/timeline** (filtro frontend)
7. ✅ Admins veem tudo (intercorrências e histórico completo)
8. ✅ Sistema de permissões verificado e funcional
9. ✅ Dashboard respeita permissões
10. ✅ Gerenciamento de usuários funcional

---

## 🔜 Próximos Passos (Opcional)

Melhorias futuras que podem ser implementadas:

1. **Notificações**: Alertar admins quando intercorrências críticas são criadas
2. **Responder**: Permitir admins responderem intercorrências (já existe campo `response`)
3. **Anexos**: Upload de fotos/documentos (estrutura JSONB já existe)
4. **Status**: Workflow de status (open → in_progress → resolved)
5. **Filtros**: Filtrar intercorrências por tipo/gravidade
6. **Exportação**: Relatório de intercorrências

---

**Implementação concluída com sucesso! 🎉**

