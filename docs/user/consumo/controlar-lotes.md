# Controlar lotes e validade (FEFO)

## Objetivo
Entender o que é "controlar lote", como funciona a validade e o **FEFO**, e quando ligar ou desligar esse controlo num item.

## Conceitos
- **Lote** — um agrupamento do material recebido, normalmente com um **número de lote** e uma **validade**.
- **FEFO** (*First Expired, First Out*) — nas saídas e transferências, o sistema sugere **primeiro o lote que vence mais cedo** (marcado com 🟢).
- **Controla lote** — uma opção do item (só consumo):
  - **Ligado** → o **nº de lote é obrigatório** na entrada; a saída usa FEFO.
  - **Desligado** → o lote é **opcional** (o campo continua a existir): a entrada pode registar lote ou não; a saída ainda usa **FEFO se houver stock em lote**, senão abate direto do saldo.

## Como ligar/desligar
1. **Itens** → **Editar** o item → secção **Controle de lote**.
2. Marque/desmarque **"Este item controla lote / validade"** → **Salvar**.
   > 📸 [captura: caixa "Este item controla lote / validade"]

> Pode desligar o controlo **mesmo que o item já tenha lotes lançados** — os lotes **não são apagados** e o stock em lote **continua consumível** por FEFO. Apenas deixa de ser **obrigatório** informar o lote nas próximas entradas.

## Como o lote entra e sai
- **Entrada** — informe **Lote** e **Validade** na linha. Se o item controla lote, é obrigatório; senão, opcional.
- **Saída / Transferência** — deixe em **"FEFO automático"** para o sistema escolher o lote de validade mais próxima, ou selecione um lote específico no seletor.

## Atenção
- A **validade** é sempre **opcional** (há materiais sem validade). Sem validade, o lote entra por último na ordem FEFO.
- **Modo seeding:** se um item controla lote mas está com saldo zero/negativo, a saída em seeding segue **sem lote** (regulariza depois).

## Erros comuns
| Mensagem | Causa | Solução |
|---|---|---|
| "controla lote — número de lote é obrigatório (RN03)" | Entrada de item que controla lote, sem lote | Preencha o lote (ou desligue o controlo, se fizer sentido) |
| "nenhum lote disponível na localização" | Saída de item que controla lote, sem lote em stock | Dê entrada com lote; em seeding a saída segue sem lote |

## Tarefas relacionadas
[Cadastrar um item](../itens/cadastrar-item.md) · [Registar uma entrada](registrar-entrada.md) · [Registar uma saída](registrar-saida.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
