# Registar uma saída

## Objetivo
Registar o **consumo** de materiais, reduzindo o **stock**. Uma saída pode ter **vários itens** (várias linhas) num único registo.

## Quem pode executar
Utilizadores com a permissão **saída** (`inventory:exit`).

## Antes de começar
Os itens devem ter stock (ou o **modo seeding** deve estar ativo, se for necessário sair em negativo durante a carga inicial).

## Passo a passo
1. Menu **Consumo › Saída** → **Nova saída**.
2. (Opcional) **Justificação** — aplica-se a todas as linhas.
3. **Linhas** — **Adicionar linha** para cada item:
   - **Item** (busca) e **Localização** de origem;
   - **Qtd**; ao lado aparece a **disponibilidade** ("disp X") na localização;
   - **Lote** — se houver stock em lote, aparece um seletor com sugestão **FEFO** (🟢 = validade mais próxima). Deixe em **FEFO automático** para o sistema escolher, ou selecione um lote específico.
   > 📸 [captura: linhas da saída com disponibilidade e FEFO]
4. Clique em **Registar saída**.

## Resultado esperado
- O **stock** de cada item diminui na localização/lote indicados (FEFO por defeito).
- Gera-se um **movimento de saída** por linha, no **Histórico** e no **Kardex**.

## Atenção
- **Abaixo do mínimo:** se a saída deixar o stock no/abaixo do mínimo, o sistema **pede confirmação** ("continuar?"). Confirme para prosseguir.
- **Modo seeding:** com o modo ativo, a saída é permitida mesmo **sem stock** (deixa o saldo negativo). Fora do seeding, uma saída sem stock é **bloqueada**.
- A saída é **atómica**: se uma linha falhar, **nenhuma** é gravada.
- **Avaria, extravio, perda e quebra** não se lançam aqui — são feitas em **[Ajustes](../ajustes/corrigir-quantidade.md)** (fluxo administrativo).

## Erros comuns
| Mensagem | Causa | Solução |
|---|---|---|
| "Stock insuficiente (disponível: …, solicitado: …) — RN05" | Sem stock e seeding desligado | Reduza a quantidade, dê entrada primeiro, ou ative o seeding (Admin) |
| "Item X controla lote (RN03): nenhum lote disponível na localização" | Item controla lote e não há lote em stock | Dê entrada com lote; em seeding, a saída segue sem lote |
| Aviso "abaixo do mínimo" | A saída cruza o stock mínimo | Confirme se estiver correto |

## Como corrigir
Saída lançada a mais/errada: um **Admin** pode **inativar o movimento** (gera estorno) ou faça um **[Ajuste](../ajustes/corrigir-quantidade.md)**.

## Auditoria
Movimentos de saída ficam no **Histórico** e no **Kardex** do item.

## Tarefas relacionadas
[Registar uma entrada](registrar-entrada.md) · [Transferir materiais](transferir-materiais.md) · [Corrigir quantidades](../ajustes/corrigir-quantidade.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
