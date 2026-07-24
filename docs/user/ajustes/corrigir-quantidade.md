# Corrigir quantidades (Ajustes)

## Objetivo
Corrigir o saldo de um item quando a realidade não bate com o sistema — por **sobra**, **falta**, **avaria**, **extravio**, **perda** ou **quebra**. Ajuste é um **fluxo administrativo** de correção.

## Quem pode executar
Apenas **Inventory_Admin** (a tela de Ajustes é restrita a Admin). Isto evita mau uso: operadores fazem consumo/transferência; correções passam por Admin.

## Antes de começar
Saiba **qual item, localização, lote** e o **motivo** do ajuste. Para ajustes grandes (> 5% do saldo) é exigido perfil de Admin.

## Passo a passo
1. Menu **Ajustes**.
2. Escolha o **item**, a **localização** (e **lote**, se aplicável).
3. Escolha o **sentido**:
   - **Positivo** (entrada de acerto / sobra);
   - **Negativo** (perda) — informe o **motivo** (avaria, extravio, perda, quebra…).
4. Informe a **quantidade** e a **justificação** (obrigatória).
   - Se o saldo final ficar **negativo**, é necessário ser Admin e confirmar (dupla confirmação).
   > 📸 [captura: tela de Ajustes com sentido e motivo]
5. Confirme.

## Resultado esperado
O saldo do item é corrigido na localização/lote; gera-se um **movimento de ajuste** (com motivo e justificação) no **Histórico**/**Kardex**.

## Atenção
- Ajuste é para **correção**, não para operação normal: consumo é **[Saída](../consumo/registrar-saida.md)**; mudança de local é **[Transferência](../consumo/transferir-materiais.md)**.
- **Avaria/extravio/perda/quebra** de consumo lançam-se **aqui** (não na saída normal).
- Ajustes acima de um limiar (> 5% do saldo) exigem **Admin**.

## Erros comuns
| Mensagem | Causa | Solução |
|---|---|---|
| "Ajuste > 5% do stock atual requer perfil Inventory_Admin (RF06)" | Ajuste grande por não-Admin | Peça a um Admin |
| "Ajuste resultaria em stock negativo — requer Inventory_Admin (RN05)" | Saldo final negativo | Só Admin com confirmação; ou reveja a quantidade |
| Justificação vazia | Campo obrigatório | Preencha o motivo |

## Como corrigir
Um ajuste errado corrige-se com **outro ajuste** no sentido oposto (os movimentos são imutáveis).

## Auditoria
Todos os ajustes ficam no **Histórico** e no **Kardex**, com motivo, justificação, utilizador e momento.

## Tarefas relacionadas
[Inventário físico](../inventario-fisico/executar-contagem.md) · [Registar uma saída](../consumo/registrar-saida.md) · [Relatórios e Kardex](../relatorios/relatorios-e-kardex.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário (Admin).
