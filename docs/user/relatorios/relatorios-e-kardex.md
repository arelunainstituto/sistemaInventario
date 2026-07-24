# Relatórios, Kardex e Histórico

## Objetivo
Consultar e interpretar as visões de acompanhamento do inventário: **Relatórios** (situação/valor), **Kardex** (saldo cronológico por item), **Histórico** (todos os movimentos) e **Log de Acesso** (quem fez o quê).

## Quem pode executar
- **Relatórios**: permissão de **relatórios** (`inventory:reports`).
- **Kardex / Histórico / Log**: acesso de **leitura** (`inventory:read`).

## As quatro visões

### Relatórios
Menu **Relatórios** — visões consolidadas: stock atual por localização, itens **abaixo do mínimo**, valor de inventário (com base no **custo médio**), lotes a vencer, etc. Use os **filtros** (localização, categoria, datas) e exporte quando disponível.
> 📸 [captura: tela de Relatórios com filtros]

### Kardex
Menu **Kardex** — o **extrato de um item**: cada entrada, saída, transferência e ajuste em ordem cronológica, com o **saldo acumulado** linha a linha. Ideal para explicar "por que o saldo está assim".
- Filtre por **item** e, se quiser, por **localização** (saldo por local) ou global.

### Histórico
Menu **Histórico** — **todos os movimentos** do inventário (entradas, saídas, transferências, ajustes, baixas), com filtros por tipo, item, datas. Cada movimento é **imutável** (não se edita; correções são novos movimentos).

### Log de Acesso
Menu **Log de Acesso** — trilha de **quem acedeu/alterou o quê e quando** (auditoria de ações no módulo).

## Como interpretar
- **Abaixo do mínimo** = saldo atual ≤ stock mínimo do item (na lista de Itens aparece em **vermelho**). Sinal para **repor**.
- **Custo Médio (CMP)** = média ponderada dos custos de entrada; base do **valor** de inventário.
- **Saldo negativo** = movimentado em **modo seeding**; regulariza com entrada/ajuste.
- **Δ / diferença** (em ajustes/inventário) = contado − esperado.

## Atenção
- Os relatórios refletem o estado **no momento da consulta**; para uma "foto" histórica de um item, use o **Kardex**.
- Movimentos **estornados/inativados** aparecem marcados (não somem) — a auditoria é preservada.

## Erros comuns
| Situação | Causa | Solução |
|---|---|---|
| Valor de inventário "estranho" | CMP afetado por saldo negativo (seeding) | Regularize os saldos; o CMP volta ao normal |
| Relatório vazio | Filtros muito restritos | Amplie o intervalo de datas/localização |

## Tarefas relacionadas
[Consultar a ficha](../itens/consultar-ficha.md) · [Corrigir quantidades](../ajustes/corrigir-quantidade.md) · [Inventário físico](../inventario-fisico/executar-contagem.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
