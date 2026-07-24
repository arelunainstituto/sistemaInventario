# 📋 Guia de Implementação - Sistema de Histórico de Alterações

## 🎯 Objetivo

Implementar um sistema completo de rastreamento automático de todas as alterações feitas nas Ordens de Serviço (OS), incluindo:

- ✅ Alterações de status
- ✅ Modificações de campos (cliente, paciente, descrição, preço, etc.)
- ✅ Adição/remoção de materiais
- ✅ Registro de tempo (início, pausa, retomada, conclusão)
- ✅ Criação e atualização de intercorrências
- ✅ Confirmação pelo cliente

## 📦 Arquivos Criados/Modificados

### Criados:
1. **`database/work-orders-history.sql`** - Schema completo do sistema de histórico
2. **`GUIA_IMPLEMENTACAO_HISTORICO.md`** - Este guia

### Modificados:
1. **`public/prostoral-ordens.js`** - Frontend melhorado para exibir histórico
2. **`api/prostoral-ordens.js`** - Backend atualizado para incluir informações do usuário

## 🚀 Passo a Passo de Implementação

### Passo 1: Aplicar o Schema do Banco de Dados

Execute o arquivo SQL no Supabase SQL Editor:

```bash
# Copie o conteúdo de: database/work-orders-history.sql
# Cole no Supabase SQL Editor
# Execute o script
```

**O que o script faz:**

1. **Expande a tabela de histórico** com novos campos:
   - `change_type` - tipo de alteração
   - `field_name` - campo alterado
   - `old_value` / `new_value` - valores antigo e novo
   - `description` - descrição legível da alteração

2. **Cria funções de log** para cada tipo de alteração:
   - `log_work_order_status_change()` - mudanças de status
   - `log_work_order_changes()` - alterações gerais
   - `log_material_added()` - adição de materiais
   - `log_material_removed()` - remoção de materiais
   - `log_time_tracking_changes()` - tracking de tempo
   - `log_issue_changes()` - intercorrências
   - `log_work_order_creation()` - criação de ordem

3. **Cria triggers automáticos** que executam essas funções

4. **Cria uma view formatada** (`v_work_order_history`) para consultas facilitadas

### Passo 2: Verificar Permissões RLS

Certifique-se de que as policies RLS estão configuradas para a tabela de histórico:

```sql
-- Verificar se existe policy para leitura
SELECT * FROM pg_policies 
WHERE tablename = 'prostoral_work_order_status_history';

-- Se não existir, criar:
CREATE POLICY "Users can view history of their tenant orders"
ON prostoral_work_order_status_history
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM prostoral_work_orders wo
        INNER JOIN user_profiles up ON up.tenant_id = wo.tenant_id
        WHERE wo.id = work_order_id
        AND up.user_id = auth.uid()
    )
);
```

### Passo 3: Testar o Sistema

Após aplicar o schema, teste cada funcionalidade:

#### Teste 1: Alteração de Status
```sql
-- Criar uma OS de teste
INSERT INTO prostoral_work_orders (
    order_number, 
    client_id, 
    patient_name, 
    work_description, 
    status,
    tenant_id,
    created_by
) VALUES (
    'OS-TEST-001',
    'uuid-do-cliente',
    'Paciente Teste',
    'Teste de histórico',
    'received',
    'uuid-do-tenant',
    auth.uid()
);

-- Alterar o status
UPDATE prostoral_work_orders
SET status = 'design'
WHERE order_number = 'OS-TEST-001';

-- Verificar histórico
SELECT * FROM v_work_order_history
WHERE order_number = 'OS-TEST-001'
ORDER BY changed_at DESC;
```

#### Teste 2: Adicionar Material
```javascript
// No frontend, adicione um material a uma OS
// O histórico deve registrar automaticamente
```

#### Teste 3: Time Tracking
```javascript
// No frontend, inicie um trabalho
// Pause, retome e finalize
// Cada ação deve gerar um registro no histórico
```

### Passo 4: Deploy das Alterações Frontend

Faça commit e push das alterações:

```bash
git add public/prostoral-ordens.js
git add api/prostoral-ordens.js
git add database/work-orders-history.sql
git add GUIA_IMPLEMENTACAO_HISTORICO.md
git commit -m "feat: Implementar sistema completo de histórico de alterações"
git push origin desenvolvimento
```

### Passo 5: Verificar na Interface

1. Acesse o sistema ProStoral
2. Abra uma Ordem de Serviço existente
3. Visualize a seção "Histórico de Alterações"
4. Faça algumas modificações:
   - Altere o status
   - Adicione um material
   - Inicie um trabalho
5. Recarregue os detalhes da OS
6. Verifique se todas as alterações foram registradas

## 📊 Tipos de Alterações Registradas

### 1. Status Change (Mudança de Status)
- **Ícone**: 🔄
- **Cor**: Azul
- **Registra**: Status antigo → Status novo

### 2. Material Added (Material Adicionado)
- **Ícone**: ➕
- **Cor**: Verde
- **Registra**: Nome, quantidade, custo, origem (kit ou manual)

### 3. Material Removed (Material Removido)
- **Ícone**: ➖
- **Cor**: Vermelho
- **Registra**: Nome, quantidade, custo

### 4. Time Tracking Started (Trabalho Iniciado)
- **Ícone**: ▶️
- **Cor**: Verde Esmeralda
- **Registra**: Etapa, técnico, taxa horária

### 5. Time Tracking Paused (Trabalho Pausado)
- **Ícone**: ⏸️
- **Cor**: Amarelo
- **Registra**: Etapa, tempo decorrido

### 6. Time Tracking Resumed (Trabalho Retomado)
- **Ícone**: ▶️
- **Cor**: Verde Esmeralda
- **Registra**: Etapa

### 7. Time Tracking Finished (Trabalho Concluído)
- **Ícone**: ✅
- **Cor**: Verde
- **Registra**: Etapa, duração total, custo de mão de obra

### 8. Issue Created (Intercorrência Criada)
- **Ícone**: ⚠️
- **Cor**: Laranja
- **Registra**: Título, gravidade, tipo

### 9. Issue Updated (Intercorrência Atualizada)
- **Ícone**: 📝
- **Cor**: Âmbar
- **Registra**: Mudanças de status, respostas

### 10. Order Updated (Ordem Atualizada)
- **Ícone**: ✏️
- **Cor**: Índigo
- **Registra**: Campo alterado, valor antigo → novo

### 11. Client Confirmed (Confirmação do Cliente)
- **Ícone**: ✔️
- **Cor**: Teal
- **Registra**: Data/hora da confirmação

## 🎨 Visualização no Frontend

O histórico é exibido com:

### Estrutura Visual
- **Barra lateral colorida** indicando o tipo de alteração
- **Ícone** representativo da ação
- **Badge** com o tipo de alteração
- **Descrição** clara e legível
- **Data/hora** e usuário que fez a alteração
- **Metadados** expandidos com detalhes relevantes

### Exemplo de Exibição

```
┃ 🔄  Status alterado de "Recebido" para "Design"           [Status]
┃     22/10/2025, 14:30:25 • usuario@email.com
┃
┃ ➕  Material adicionado: Cerâmica VITA VM 9 (Qtd: 1 g)    [Material +]
┃     22/10/2025, 14:35:10 • tecnico@email.com
┃     ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
┃     Item: Cerâmica VITA VM 9  |  Qtd: 1 g  |  Custo: 2,50€
┃
┃ ▶️  Trabalho iniciado - Etapa: design                      [Início]
┃     22/10/2025, 14:40:00 • tecnico@email.com
┃     ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
┃     Etapa: Design  |  Taxa: 15,00€/h
```

## 🔧 Manutenção e Monitoramento

### Consultas Úteis

#### Ver todo o histórico de uma OS
```sql
SELECT * FROM v_work_order_history
WHERE work_order_id = 'uuid-da-ordem'
ORDER BY changed_at DESC;
```

#### Contar alterações por tipo
```sql
SELECT 
    change_type,
    COUNT(*) as total,
    COUNT(DISTINCT work_order_id) as ordens_afetadas
FROM prostoral_work_order_status_history
GROUP BY change_type
ORDER BY total DESC;
```

#### Ver alterações recentes (últimas 24h)
```sql
SELECT 
    wo.order_number,
    h.change_type,
    h.description,
    h.changed_at,
    u.email as changed_by
FROM v_work_order_history h
LEFT JOIN prostoral_work_orders wo ON wo.id = h.work_order_id
LEFT JOIN auth.users u ON u.id = h.changed_by
WHERE h.changed_at >= NOW() - INTERVAL '24 hours'
ORDER BY h.changed_at DESC;
```

#### Ver histórico de um usuário específico
```sql
SELECT 
    wo.order_number,
    h.change_type,
    h.description,
    h.changed_at
FROM prostoral_work_order_status_history h
LEFT JOIN prostoral_work_orders wo ON wo.id = h.work_order_id
WHERE h.changed_by = 'uuid-do-usuario'
ORDER BY h.changed_at DESC
LIMIT 50;
```

## 🐛 Troubleshooting

### Problema: Histórico não está sendo registrado

**Soluções:**
1. Verifique se os triggers estão ativos:
   ```sql
   SELECT * FROM pg_trigger 
   WHERE tgname LIKE 'trigger_log%';
   ```

2. Verifique se as funções existem:
   ```sql
   SELECT proname FROM pg_proc 
   WHERE proname LIKE 'log_%';
   ```

3. Verifique logs de erros no Supabase

### Problema: Erro "auth.uid() is null"

**Solução:**
Certifique-se de que as operações estão sendo feitas com um usuário autenticado. As funções usam `auth.uid()` que requer autenticação.

### Problema: Histórico não aparece no frontend

**Soluções:**
1. Verifique as políticas RLS
2. Verifique se o backend está retornando o histórico:
   ```javascript
   console.log('History:', order.history);
   ```
3. Verifique o console do navegador por erros

## 📈 Melhorias Futuras

### Sugestões de Expansão:

1. **Exportar histórico para PDF**
   - Gerar relatório completo de uma OS com todo o histórico

2. **Filtros de histórico**
   - Por tipo de alteração
   - Por período
   - Por usuário

3. **Notificações**
   - Email quando houver alterações críticas
   - Notificações em tempo real via WebSocket

4. **Auditoria avançada**
   - Dashboard de atividades
   - Gráficos de alterações por período
   - Relatório de produtividade por técnico

5. **Reversão de alterações**
   - Permitir desfazer certas alterações
   - Sistema de "rollback" para casos específicos

## ✅ Checklist de Implementação

- [ ] Schema aplicado no banco de dados
- [ ] Triggers criados e ativos
- [ ] Policies RLS configuradas
- [ ] Frontend atualizado e testado
- [ ] Backend atualizado e testado
- [ ] Testes realizados em todas as funcionalidades
- [ ] Deploy feito no ambiente de desenvolvimento
- [ ] Validação com usuários
- [ ] Deploy em produção
- [ ] Documentação do usuário criada
- [ ] Treinamento da equipe realizado

## 📞 Suporte

Se encontrar problemas durante a implementação:

1. Verifique os logs do Supabase
2. Verifique o console do navegador
3. Revise este guia
4. Consulte a documentação do Supabase sobre triggers e RLS

---

**Versão:** 1.0  
**Data:** 22/10/2025  
**Autor:** Sistema de Inventário ProStoral

