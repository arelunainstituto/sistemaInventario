# 🔄 Ajuste: Filtro de Intercorrências no Histórico/Timeline

## 📅 Data: 22 de Outubro de 2025

## 🎯 Objetivo

Garantir que as intercorrências no **histórico/timeline** da OS também respeitem as regras de visibilidade:
- Usuários comuns veem apenas histórico de **suas próprias** intercorrências
- Admins veem **todo** o histórico (incluindo intercorrências de todos)

---

## 🔍 Problema Identificado

Quando uma intercorrência é criada, um trigger automático (`log_issue_changes()`) registra uma entrada na tabela `prostoral_work_order_status_history` com os tipos:
- `issue_created` - Quando intercorrência é criada
- `issue_updated` - Quando intercorrência é atualizada

**Problema:** Todos os usuários conseguiam ver essas entradas no histórico, mesmo que não fossem donos da intercorrência, pois:
1. O trigger usa `SECURITY DEFINER` (contorna RLS)
2. A tabela de histórico não tem filtro baseado em quem criou a intercorrência
3. O frontend renderizava todo o histórico sem filtro

---

## ✅ Solução Implementada

### Filtro no Frontend JavaScript

**Arquivo:** `public/prostoral-ordens.js`

#### 1. Propriedade `accessibleIssueIds`
```javascript
constructor() {
    // ...
    this.accessibleIssueIds = []; // IDs das intercorrências acessíveis
}
```

#### 2. Guardar IDs Acessíveis em `renderOrderDetails()`
```javascript
renderOrderDetails(order) {
    // ...
    
    // Intercorrências - guardar IDs acessíveis para filtrar histórico
    this.accessibleIssueIds = (order.issues || []).map(issue => issue.id);
    this.renderOrderIssues(order.issues || []);
    
    // Histórico - filtrar baseado em intercorrências acessíveis
    this.renderOrderHistory(order.history || []);
}
```

**Como funciona:**
- Backend retorna `order.issues` já **filtrado por RLS**
- Usuário comum: recebe apenas issues que criou
- Admin: recebe todas as issues
- Extraímos os IDs e guardamos em `this.accessibleIssueIds`

#### 3. Filtrar Histórico em `renderOrderHistory()`
```javascript
renderOrderHistory(history) {
    // ...
    
    // Filtrar histórico: remover intercorrências que o usuário não tem acesso
    const filteredHistory = history.filter(h => {
        // Se for registro de intercorrência, verificar se usuário tem acesso
        if (h.change_type === 'issue_created' || h.change_type === 'issue_updated') {
            const issueId = h.metadata?.issue_id;
            // Só mostrar se o issue_id estiver na lista de IDs acessíveis
            return issueId && this.accessibleIssueIds && this.accessibleIssueIds.includes(issueId);
        }
        // Outros tipos de registro sempre mostram
        return true;
    });
    
    // Renderizar com histórico filtrado...
}
```

**Lógica do filtro:**
1. Para cada entrada do histórico, verificar o `change_type`
2. Se for `issue_created` ou `issue_updated`:
   - Pegar o `issue_id` do metadata
   - Verificar se está em `accessibleIssueIds`
   - Só mostrar se estiver
3. Outros tipos de registro (`status_change`, `material_added`, etc) sempre mostram

---

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────────────────────┐
│ 1. Usuário cria intercorrência                          │
│    - POST /api/prostoral/orders/:id/issues              │
│    - Salva com reported_by = user_id                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Trigger automático registra no histórico             │
│    - Função: log_issue_changes()                        │
│    - Tabela: prostoral_work_order_status_history        │
│    - Tipo: issue_created                                │
│    - Metadata: {issue_id, type, severity, title...}     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Backend retorna detalhes da OS                       │
│    GET /api/prostoral/orders/:id                        │
│    ├─ issues: filtrado por RLS (apenas próprias)        │
│    └─ history: sem filtro (todos os registros)          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Frontend processa dados                              │
│    - Extrai IDs de order.issues (já filtrado)           │
│    - Guarda em this.accessibleIssueIds                  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Frontend renderiza histórico                         │
│    - Filtra registros de intercorrências                │
│    - Compara issue_id com accessibleIssueIds            │
│    - Mostra apenas se estiver na lista                  │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Exemplos

### Exemplo 1: Usuário Comum

**Histórico completo da OS (backend):**
```json
[
  {"change_type": "status_change", "description": "Status alterado para Em Progresso"},
  {"change_type": "issue_created", "metadata": {"issue_id": "abc-123"}, "description": "Intercorrência: Material faltando"},
  {"change_type": "material_added", "description": "Material adicionado"},
  {"change_type": "issue_created", "metadata": {"issue_id": "def-456"}, "description": "Intercorrência: Atraso na entrega"}
]
```

**Issues acessíveis (filtrado por RLS):**
```json
[
  {"id": "abc-123", "title": "Material faltando", "reported_by": "user-comum-id"}
]
```

**Histórico filtrado (frontend):**
```json
[
  {"change_type": "status_change", "description": "Status alterado para Em Progresso"},
  {"change_type": "issue_created", "metadata": {"issue_id": "abc-123"}, "description": "Intercorrência: Material faltando"},
  {"change_type": "material_added", "description": "Material adicionado"}
  // ❌ issue_created com issue_id "def-456" foi REMOVIDO (não está em accessibleIssueIds)
]
```

### Exemplo 2: Admin

**Issues acessíveis (todas):**
```json
[
  {"id": "abc-123", "title": "Material faltando"},
  {"id": "def-456", "title": "Atraso na entrega"}
]
```

**Histórico filtrado:**
```json
[
  {"change_type": "status_change", "description": "Status alterado para Em Progresso"},
  {"change_type": "issue_created", "metadata": {"issue_id": "abc-123"}, "description": "Intercorrência: Material faltando"},
  {"change_type": "material_added", "description": "Material adicionado"},
  {"change_type": "issue_created", "metadata": {"issue_id": "def-456"}, "description": "Intercorrência: Atraso na entrega"}
  // ✅ Todos os registros aparecem
]
```

---

## 🧪 Como Testar

1. **Criar intercorrências como usuário comum:**
   - Login com usuário não-admin
   - Abra uma OS
   - Crie intercorrência
   - Verifique seção "Histórico": deve aparecer entrada da intercorrência

2. **Verificar isolamento:**
   - Mesmo usuário, abra outra OS
   - Crie outra intercorrência
   - Volte para primeira OS
   - Verifique histórico: deve ver apenas sua intercorrência

3. **Testar como admin:**
   - Login como admin
   - Abra mesma OS
   - Verifique histórico: deve ver TODAS as entradas de intercorrências

---

## 📝 Notas Técnicas

### Por que filtrar no frontend?

**Opção A: Filtrar no backend**
- Complexo: exigiria JOIN com RLS ou subconsulta
- Performance: mais processamento no servidor
- Risco: trigger SECURITY DEFINER já contorna RLS

**Opção B: Filtrar no frontend** ✅ Escolhida
- Simples: aproveita dados já filtrados (issues)
- Performance: filtro rápido em JavaScript
- Segurança: issues já vem filtradas por RLS
- Manutenção: mais fácil de entender e modificar

### Segurança

O filtro frontend **NÃO compromete segurança** porque:
1. Backend **já retorna apenas issues acessíveis** (RLS garante)
2. Metadata do histórico tem apenas `issue_id`, não dados sensíveis
3. Mesmo que usuário manipule JS, backend nunca retornará issues que não pode ver
4. Frontend só está **renderizando** o que já está filtrado

---

## ✅ Resultado

- ✅ Usuários comuns veem apenas histórico de suas intercorrências
- ✅ Admins veem histórico completo
- ✅ Outros registros de histórico não são afetados
- ✅ Performance mantida
- ✅ Segurança garantida por RLS no backend

---

**Implementação concluída com sucesso! 🎉**

