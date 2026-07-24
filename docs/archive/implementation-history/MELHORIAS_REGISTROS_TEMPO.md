# 📊 Melhorias nos Registros de Tempo das OS

## 🎯 Objetivo

Mostrar de forma clara e completa:
1. **Tempo Total em Produção** - Desde que apertou "Produção" até "Finalizar"
2. **Tempo Efetivamente Trabalhado** - Soma dos períodos de trabalho registrados

## ✨ O Que Foi Implementado

### 1. **🕐 Tempo Total em Produção** (NOVO!)

Card principal mostrando o tempo desde que a OS entrou em produção:

```
┌─────────────────────────────────────────────┐
│   🕐 TEMPO TOTAL EM PRODUÇÃO                │
│            2d 15h 30min                      │
│                                              │
│ ▶ Iniciado: 20/10/2025, 09:00              │
│ ✓ Finalizado: 23/10/2025, 00:30            │
└─────────────────────────────────────────────┘
```

**Características:**
- ✅ **Verde** quando finalizada
- 🔵 **Azul** quando ainda em andamento
- 📅 Mostra data/hora de início e fim
- ⏱️ Formato automático: dias, horas e minutos

### 2. **👷 Tempo Efetivamente Trabalhado**

Card mostrando apenas o tempo dos registros de trabalho:
- **Tempo Total**: Soma de todos os períodos
- **Quantidade de Períodos**: Número de sessões de trabalho
- **SEM valor monetário** (removido conforme solicitado)

```
┌─────────────────────────────────────────────┐
│   👷 TEMPO EFETIVAMENTE TRABALHADO          │
│            1h 45min                          │
│         3 períodos de trabalho               │
└─────────────────────────────────────────────┘
```

### 3. **Resumo por Fase** 🏗️

Se houver múltiplas fases de trabalho (ex: "production", "design", "finishing"), mostra:
- Nome da fase
- Tempo acumulado nessa fase
- Número de períodos nessa fase

```
POR FASE:
┌─────────────────────────────┐
│ Production    │   1h 30min  │
│ 2 períodos    │             │
└─────────────────────────────┘
┌─────────────────────────────┐
│ Design        │   1h 15min  │
│ 1 período     │             │
└─────────────────────────────┘
```

### 4. **Detalhes de Cada Período** 🔍

Lista completa de todos os períodos de trabalho:
- **Numeração**: 1, 2, 3...
- **Fase/Etapa**: Nome da fase
- **Técnico**: ID do técnico responsável
- **Horários**: Início → Fim (ou "Em andamento" se ainda ativo)
- **Duração**: Minutos trabalhados
- **Custo**: Custo do período

```
DETALHES DOS PERÍODOS:

┃  1  Production
┃    👤 Técnico: ID: 90f62592...
┃    🕐 22/10/2025, 17:49:54 → 22/10/2025, 18:19:54
┃                                        30 min
┃                                        15,00 €

┃  2  Production
┃    👤 Técnico: ID: 90f62592...
┃    🕐 22/10/2025, 18:30:00 → (Em andamento)
┃                                        45 min
┃                                        22,50 €
```

## 📍 Localização

**Arquivo Modificado**: `public/prostoral-ordens.js`
**Função**: `renderOrderTimeTracking(tracking, history, currentStatus)`
**Linhas**: 1069-1240 (aproximadamente)

**Mudanças na Função**:
- Agora recebe `history` e `currentStatus` como parâmetros
- Calcula tempo em produção baseado no histórico de status
- Remove exibição de custos (mantém apenas cálculo interno)

## 🎨 Design Visual

### Card de Tempo em Produção:
- ✅ **Verde** quando finalizada (emerald gradient)
- 🔵 **Azul** quando em andamento (blue gradient)
- 🎯 Borda dupla (2px) destacada
- 📏 Texto maior (4xl) para o tempo principal
- 📅 Ícones indicativos (▶ início, ✓ fim)

### Card de Tempo Trabalhado:
- 💜 Gradiente roxo/rosa (purple-pink gradient)
- 📊 Centralizado e limpo
- 🔢 Sem valores monetários

### Outros:
- ✅ Cards individuais para cada fase
- ✅ Borda colorida esquerda nos detalhes dos períodos
- ✅ Ícones para melhor visualização
- ✅ Cores diferentes para tempo e custo (nos detalhes)
- ✅ Destaque visual para períodos "Em andamento"
- ✅ Modo escuro totalmente suportado

## 📊 Informações Exibidas

### Cálculos Automáticos:
1. **Tempo em Produção**: Diferença entre mudança para "production" e "delivered/cancelled"
2. **Tempo Trabalhado**: Soma de todos os `duration_minutes`
3. **Por Fase**: Agrupamento automático por `stage`
4. **Conversão**: Minutos → Dias, Horas e Minutos

### Formato de Exibição:
- **< 60 min**: "45min"
- **< 24h**: "1h 30min"
- **≥ 24h**: "2d 15h 30min"
- **Custo**: Oculto do resumo (mantido apenas nos detalhes)
- **Data/Hora**: "22/10/2025, 17:49:54"

## 🔄 Como Funciona

1. Quando você abre o modal de detalhes de uma OS
2. O sistema carrega todos os registros de tempo E o histórico da OS
3. A função `renderOrderTimeTracking()` processa os dados:
   - **Busca no histórico** quando a OS mudou para "production"
   - **Busca no histórico** quando foi finalizada ("delivered" ou "cancelled")
   - **Calcula a diferença** entre essas datas = Tempo em Produção
   - **Soma os períodos** de time tracking = Tempo Trabalhado
   - **Agrupa por fase** de trabalho
   - **Formata** datas e valores
   - **Gera o HTML** com os cards
4. Exibe na seção "Registros de Tempo"

### Lógica de Detecção:

```javascript
// Busca quando entrou em produção
productionStart = histórico onde change_type === 'status_change' 
                  && details contém "production"

// Busca quando foi finalizada
deliveredChange = histórico onde change_type === 'status_change' 
                  && details contém "delivered" ou "cancelled"

// Calcula diferença
tempoEmProducao = deliveredChange.data - productionStart.data
```

## ✅ Benefícios

- 🎯 **Tempo Real em Produção**: Veja quanto tempo a OS levou do início ao fim
- ⏱️ **Diferença Clara**: Separa tempo em produção vs. tempo trabalhado
- 📊 **Análise Completa**: Entenda se o tempo trabalhado foi eficiente
- 🏗️ **Por Fase**: Veja onde o tempo foi gasto
- 🎨 **Visual Intuitivo**: Verde quando finalizada, azul quando em andamento
- 📱 **Responsivo**: Funciona em mobile e desktop
- 🌙 **Modo Escuro**: Suporte completo
- 💡 **Sem Custos no Resumo**: Foco no tempo, não no dinheiro

## 🧪 Como Testar

### Cenário 1: OS em Produção (Não Finalizada)
1. Crie uma OS e coloque em "Produção"
2. Abra os detalhes da OS
3. Verifique na seção "Registros de Tempo":
   - ✅ Card **AZUL** "Tempo em Produção (Em andamento)"
   - ✅ Mostra tempo desde que entrou em produção até agora
   - ✅ Mostra data de início
   - ✅ NÃO mostra data de fim

### Cenário 2: OS Finalizada
1. Coloque uma OS em produção
2. Finalize a OS (status "Entregue")
3. Abra os detalhes
4. Verifique:
   - ✅ Card **VERDE** "Tempo Total em Produção"
   - ✅ Mostra tempo total desde início até finalização
   - ✅ Mostra data de início E fim
   - ✅ Tempo é fixo (não muda)

### Cenário 3: Com Registros de Trabalho
1. Inicie trabalho na OS (botão "Iniciar Trabalho")
2. Trabalhe por alguns minutos
3. Finalize o trabalho
4. Verifique:
   - ✅ Card roxo "Tempo Efetivamente Trabalhado"
   - ✅ **SEM** valor monetário no resumo
   - ✅ Lista de períodos detalhada abaixo
   - ✅ Soma dos períodos bate com o total

### Cenário 4: Múltiplas Fases
1. Registre trabalho em diferentes fases (ex: "production", "finishing")
2. Verifique:
   - ✅ Resumo por fase aparece
   - ✅ Soma por fase está correta
   - ✅ Total geral bate

## 📝 Notas Técnicas

- **Agrupamento**: Usa `stage` para agrupar registros
- **Ordenação**: Mantém ordem original dos registros
- **Status**: Detecta períodos "Em andamento"
- **Fallback**: Se não houver registros, mostra mensagem apropriada
- **Escape HTML**: Previne XSS nos nomes de fase

## 🚀 Próximos Passos Possíveis

- [ ] Gráfico de tempo por fase
- [ ] Exportar relatório de tempo em PDF
- [ ] Comparar tempo estimado vs. real
- [ ] Alertas de tempo excedido
- [ ] Filtros por técnico/fase/período

---

**Implementado em**: 23/10/2025
**Arquivo**: `prostoral-ordens.js`
**Status**: ✅ Pronto para uso

