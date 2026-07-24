# Transferir materiais entre localizações

## Objetivo
Mover stock de **consumo** de uma **localização de origem** para uma **localização de destino**, sem alterar o total do inventário. Uma transferência pode mover **vários itens** de uma vez.

## Quem pode executar
Utilizadores com a permissão **transferência** (`inventory:transfer`).

## Antes de começar
As localizações de **origem** e **destino** devem existir e permitir envio/receção. O material deve ter stock na origem (ou o **modo seeding** ativo).

## Passo a passo
1. Menu **Transferências** → **Nova transferência**.
2. Escolha a **Origem** e o **Destino** (uma vez, valem para todas as linhas) e, opcionalmente, uma **Justificação**.
3. **Itens** — **Adicionar linha** para cada material:
   - **Item** (busca), **Qtd**;
   - a **disponibilidade** e o seletor de **Lote (FEFO 🟢)** vêm da **origem** escolhida; deixe em FEFO automático ou escolha um lote.
   > 📸 [captura: transferência multi-item com origem/destino no topo]
4. Clique em **Executar transferência**.

## Resultado esperado
Para **cada linha**, geram-se **dois movimentos**: uma **saída** na origem e uma **entrada** no destino (com o mesmo custo médio). O stock diminui na origem e aumenta no destino.

## Atenção
- **Origem e destino não podem ser iguais.**
- A transferência é **atómica**: se uma linha falhar, **nenhum** item é movido.
- Não altera o **custo médio** do item (o material continua a valer o mesmo, só muda de sítio).

## Erros comuns
| Mensagem | Causa | Solução |
|---|---|---|
| "Localizações origem e destino não podem ser iguais" | Escolheu o mesmo local nos dois | Corrija o destino |
| "Stock insuficiente … RN05" | Sem stock na origem e seeding desligado | Reduza a qtd, dê entrada, ou ative o seeding (Admin) |
| "… é patrimonial — use Património › Movimentação" | Tentou transferir um item de património | Património move-se por **[Movimentação](../patrimonio/movimentar-equipamento.md)** |

## Como corrigir
Transferência errada: faça a **transferência inversa** (destino→origem) ou peça a um Admin para inativar os movimentos.

## Auditoria
As transferências aparecem no histórico da própria tela e no **Kardex** de cada item (2 movimentos por linha).

## Tarefas relacionadas
[Registar uma saída](registrar-saida.md) · [Movimentar um equipamento (património)](../patrimonio/movimentar-equipamento.md) · [Localizações](../cadastros/localizacoes.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
