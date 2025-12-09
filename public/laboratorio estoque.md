# 🧩 Estrutura de Dados – Sistema de Estoque (Laboratório de Prótese)

## ✅ Versão Otimizada - Melhorias Implementadas

### 🎯 Principais Melhorias:
1. ✅ **Integração com sistema existente** - Usa `user_profiles` existente
2. ✅ **Campos de auditoria** - `created_by`, `updated_by`, `deleted_at` (soft delete)
3. ✅ **Validações e constraints** - Garantem integridade dos dados
4. ✅ **Triggers automáticos** - Atualização de estoque e QR Code
5. ✅ **Índices otimizados** - Melhor performance nas buscas
6. ✅ **RLS (Row Level Security)** - Segurança por módulo
7. ✅ **Sistema de alertas** - Nova tabela para notificações
8. ✅ **Views úteis** - Consultas pré-preparadas
9. ✅ **Funções de cálculo** - Valor total de estoque

---

## 📊 Estrutura das Tabelas

### 1. `produtoslaboratorio`
Contém o cadastro base de cada item do estoque.

| Campo | Tipo | Descrição |
|--------|------|------------|  
| `id` | `uuid` (PK) | Identificador único do produto (gerado automaticamente) |
| `qr_code` | `text` UNIQUE | QR Code único (gerado automaticamente pelo trigger a partir do UUID) |
| `codigo_barras` | `text` | Código de barras físico do produto (opcional) |
| `categoria` | `text` NOT NULL | Categoria: resinas, ceras, metais, gesso, silicone, ceramica, acrilico, instrumentos, equipamentos, consumiveis, outros |
| `nome_material` | `text` NOT NULL | Nome comercial ou técnico do material |
| `marca` | `text` | Marca ou fabricante |
| `fornecedor` | `text` | Nome do fornecedor |
| `referencia_lote` | `text` | Referência ou número de lote |
| `unidade_medida` | `text` NOT NULL | Unidade: g, kg, ml, l, un, barra, frasco, caixa, embalagem, metro, outro |
| `localizacao` | `text` | Localização física (gaveta, prateleira, armário, setor) |
| `data_validade` | `date` | Data de validade do produto |
| `data_criacao` | `timestamp` | Data e hora de cadastro |
| `data_atualizacao` | `timestamp` | Data da última atualização (atualizado automaticamente) |
| `ativo` | `boolean` | Se o produto está ativo no sistema |
| `criado_por` | `uuid` FK → `user_profiles.id` | Usuário que criou o registro |
| `atualizado_por` | `uuid` FK → `user_profiles.id` | Usuário que atualizou |
| `descricao` | `text` | Descrição detalhada do produto |
| `observacoes` | `text` | Observações adicionais |
| `deleted_at` | `timestamp` | Data de exclusão (soft delete) |

**Índices:**
- categoria, nome_material, qr_code, codigo_barras, ativo, fornecedor

---

### 2. `estoquelaboratorio`
Controla a quantidade e status de cada produto.

| Campo | Tipo | Descrição |
|--------|------|------------|
| `id` | `uuid` (PK) | Identificador único da linha de estoque |
| `produto_id` | `uuid` (FK → produtoslaboratorio.id) UNIQUE | Relaciona ao produto (um produto = um estoque) |
| `quantidade_atual` | `numeric(10,2)` | Quantidade disponível (≥ 0) |
| `quantidade_minima` | `numeric(10,2)` | Quantidade mínima de segurança |
| `quantidade_maxima` | `numeric(10,2)` | Estoque ideal/máximo |
| `status` | `text` | Status automático: **ok**, **alerta**, **critico**, **vencido**, **vencendo** |
| `ultima_entrada` | `timestamp` | Data da última entrada |
| `ultima_saida` | `timestamp` | Data da última saída |
| `ultima_atualizacao` | `timestamp` | Data da última modificação |
| `localizacao_especifica` | `text` | Localização específica do lote atual |
| `lote_atual` | `text` | Lote em uso atualmente |
| `atualizado_por` | `uuid` FK → `user_profiles.id` | Usuário que atualizou |

**Regras automáticas:**
- Status calculado por trigger considerando:
  - `vencido`: produto com data_validade ultrapassada
  - `vencendo`: faltam menos de 30 dias para vencer
  - `critico`: quantidade_atual = 0
  - `alerta`: quantidade_atual ≤ quantidade_minima
  - `ok`: tudo normal

**Índices:**
- produto_id, status, quantidade_atual

---

### 3. `movimentacoeslaboratorio`
Registra todas as entradas e saídas do estoque.

| Campo | Tipo | Descrição |
|--------|------|------------|
| `id` | `uuid` (PK) | Identificador único da movimentação |
| `produto_id` | `uuid` (FK → produtoslaboratorio.id) | Produto movimentado |
| `tipo_movimento` | `text` | **entrada**, **saida**, **ajuste**, **perda**, **transferencia** |
| `quantidade` | `numeric(10,2)` | Quantidade movimentada (> 0) |
| `quantidade_anterior` | `numeric(10,2)` | Saldo antes da movimentação (calculado automaticamente) |
| `quantidade_nova` | `numeric(10,2)` | Saldo após a movimentação (calculado automaticamente) |
| `responsavel_id` | `uuid` (FK → user_profiles.id) | ID do usuário responsável |
| `responsavel_nome` | `text` | Nome do responsável (desnormalizado para histórico) |
| `caso_clinico` | `text` | Número do caso/OS |
| `paciente` | `text` | Nome do paciente (opcional) |
| `setor` | `text` | Setor do laboratório |
| `motivo` | `text` | Motivo da movimentação |
| `observacoes` | `text` | Comentários adicionais |
| `numero_pedido` | `text` | Número do pedido (se for entrada) |
| `fornecedor` | `text` | Fornecedor (se for entrada) |
| `preco_unitario` | `numeric(10,2)` | Preço unitário (se for entrada) |
| `preco_total` | `numeric(10,2)` | Preço total (se for entrada) |
| `data_movimento` | `timestamp` | Data e hora da movimentação |
| `criado_por` | `uuid` FK → `user_profiles.id` | Usuário que criou o registro |
| `deleted_at` | `timestamp` | Data de exclusão (soft delete) |

**Trigger automático:**
- Ao inserir uma movimentação, o trigger atualiza automaticamente o `estoquelaboratorio`
- Calcula `quantidade_anterior` e `quantidade_nova`
- Atualiza `ultima_entrada` ou `ultima_saida`

**Índices:**
- produto_id, tipo_movimento, responsavel_id, data_movimento, caso_clinico

---

### 4. `custoslaboratorio`
Gerencia preços e informações de compra.

| Campo | Tipo | Descrição |
|--------|------|------------|
| `id` | `uuid` (PK) | Identificador do registro de custo |
| `produto_id` | `uuid` (FK → produtoslaboratorio.id) | Produto relacionado |
| `preco_unitario` | `numeric(10,2)` | Preço unitário em euros (€) |
| `quantidade_comprada` | `numeric(10,2)` | Quantidade comprada |
| `custo_total` | `numeric(10,2)` GENERATED | Calculado: preco_unitario × quantidade_comprada |
| `data_compra` | `date` | Data da compra |
| `data_validade` | `date` | Data de validade do lote |
| `fornecedor` | `text` | Nome do fornecedor |
| `numero_pedido` | `text` | Número do pedido (PO ou interno) |
| `numero_nota_fiscal` | `text` | Número da nota fiscal |
| `lote` | `text` | Número do lote |
| `moeda` | `text` | Moeda (EUR, USD, BRL, GBP) |
| `ativo` | `boolean` | Se é o custo atual/válido |
| `data_criacao` | `timestamp` | Data de criação do registro |
| `criado_por` | `uuid` FK → `user_profiles.id` | Usuário que registrou |
| `deleted_at` | `timestamp` | Data de exclusão (soft delete) |
| `dias_alerta_validade` | `integer` | Dias antes do vencimento para alertar (padrão: 30) |

**Índices:**
- produto_id, data_compra, fornecedor, data_validade

---

### 5. `alertaslaboratorio` ⭐ (NOVA)
Sistema de alertas e notificações.

| Campo | Tipo | Descrição |
|--------|------|------------|
| `id` | `uuid` (PK) | Identificador único |
| `produto_id` | `uuid` (FK → produtoslaboratorio.id) | Produto relacionado |
| `tipo_alerta` | `text` | **estoque_minimo**, **estoque_critico**, **vencimento_proximo**, **vencido**, **sem_estoque**, **outro** |
| `mensagem` | `text` | Mensagem do alerta |
| `prioridade` | `text` | **baixa**, **media**, **alta**, **urgente** |
| `visualizado` | `boolean` | Se foi visualizado |
| `resolvido` | `boolean` | Se foi resolvido |
| `data_alerta` | `timestamp` | Data/hora da criação do alerta |
| `data_visualizado` | `timestamp` | Quando foi visualizado |
| `data_resolvido` | `timestamp` | Quando foi resolvido |
| `visualizado_por` | `uuid` FK → `user_profiles.id` | Quem visualizou |
| `resolvido_por` | `uuid` FK → `user_profiles.id` | Quem resolveu |
| `observacoes` | `text` | Observações sobre a resolução |

**Alertas automáticos criados por triggers:**
- Estoque abaixo do mínimo → prioridade média
- Estoque zerado → prioridade urgente
- Produto vencendo (30 dias) → prioridade alta
- Produto vencido → prioridade urgente

**Índices:**
- produto_id, tipo_alerta, resolvido, prioridade

---

## 🔄 Triggers Automáticos

### 1. **gerar_qr_code()**
- **Quando:** BEFORE INSERT em `produtoslaboratorio`
- **O que faz:** Gera QR Code automaticamente a partir do UUID se não fornecido

### 2. **atualizar_data_atualizacao()**
- **Quando:** BEFORE UPDATE em `produtoslaboratorio`
- **O que faz:** Atualiza `data_atualizacao` automaticamente

### 3. **atualizar_estoque_apos_movimentacao()**
- **Quando:** BEFORE INSERT em `movimentacoeslaboratorio`
- **O que faz:**
  - Busca quantidade atual do estoque
  - Calcula nova quantidade baseada no tipo de movimento
  - Atualiza `quantidade_anterior` e `quantidade_nova` na movimentação
  - Atualiza `estoquelaboratorio` com nova quantidade
  - Atualiza `ultima_entrada` ou `ultima_saida`
  - Previne estoque negativo

### 4. **atualizar_status_estoque()**
- **Quando:** BEFORE INSERT OR UPDATE em `estoquelaboratorio`
- **O que faz:**
  - Verifica data de validade do produto
  - Calcula status apropriado (ok, alerta, critico, vencido, vencendo)
  - Cria alertas automáticos quando necessário

---

## 📊 Views Úteis

### 1. **vw_produtos_estoque**
Consolidação de produtos com informações de estoque.

```sql
SELECT * FROM vw_produtos_estoque 
WHERE status IN ('alerta', 'critico')
ORDER BY status DESC, nome_material;
```

### 2. **vw_alertas_ativos**
Alertas não resolvidos ordenados por prioridade.

```sql
SELECT * FROM vw_alertas_ativos;
```

### 3. **vw_movimentacoes_detalhadas**
Histórico completo de movimentações com detalhes.

```sql
SELECT * FROM vw_movimentacoes_detalhadas
WHERE data_movimento >= CURRENT_DATE - INTERVAL '30 days';
```

---

## 🔧 Funções Úteis

### 1. **calcular_valor_estoque()**
Calcula o valor total do estoque baseado no preço médio de compra.

```sql
-- Valor total de todo o estoque
SELECT * FROM calcular_valor_estoque();

-- Valor de um produto específico
SELECT * FROM calcular_valor_estoque('uuid-do-produto');
```

---

## 🔒 Segurança (RLS)

Todas as tabelas têm **Row Level Security (RLS)** habilitado:

- ✅ Usuários autenticados podem **ler** todos os dados
- ✅ Inserção/atualização controlada por políticas (a definir)
- ✅ Soft delete em vez de exclusão física
- ✅ Auditoria completa (quem criou, quem atualizou)

---

## 🧠 Lógica de Integração

### ✅ QR Code e Código de Barras
- Cada produto possui um **QR Code único** gerado automaticamente a partir do UUID
- O **código de barras** físico é opcional e pode ser usado para leitura
- Ambos podem ser usados para **entrada/saída** via leitura óptica
- Suporte para leitura por câmera (celular/tablet)

### ✅ Rastreabilidade Completa
- **Todas** as movimentações são registradas com:
  - Data e hora exata
  - Responsável (ID + nome)
  - Caso clínico / OS
  - Saldo anterior e novo
  - Motivo e observações
- Permite auditoria completa de qualquer produto

### ✅ Alertas Inteligentes
- Sistema automático de alertas baseado em:
  - Estoque mínimo
  - Estoque zerado
  - Vencimento próximo (30 dias)
  - Produto vencido
- Priorização automática (urgente, alta, média, baixa)

### ✅ Integração com Sistema Existente
- Usa a tabela `user_profiles` já existente
- Compatível com sistema de módulos atual
- Pronto para adicionar permissões específicas

---

## 📁 Arquivos Criados

1. **`database/laboratorio-schema.sql`** - Schema completo SQL pronto para executar
2. **`public/laboratorio estoque.md`** - Esta documentação

---

## 🚀 Próximos Passos

1. ✅ **Revisar e aprovar** a estrutura proposta
2. ⏳ **Executar o SQL** no Supabase para criar as tabelas
3. ⏳ **Testar triggers** e validações
4. ⏳ **Criar API endpoints** no backend
5. ⏳ **Desenvolver interface frontend** para:
   - Cadastro de produtos
   - Controle de estoque
   - Registro de movimentações
   - Leitura de QR Code / Código de Barras
   - Dashboard com alertas
   - Relatórios e gráficos

---

## 💡 Sugestões Adicionais

### Possíveis melhorias futuras:
- 📸 Upload de fotos dos produtos
- 📱 App mobile para leitura de QR Code
- 📊 Dashboard com gráficos de consumo
- 📧 Notificações por email para alertas críticos
- 🔄 Integração com sistema de ordens de serviço
- 📋 Relatórios customizáveis (consumo por período, por responsável, por caso clínico)
- 🏷️ Etiquetas térmicas com QR Code para impressão

---

**Documentação criada em:** 20/10/2025  
**Última atualização:** 20/10/2025
