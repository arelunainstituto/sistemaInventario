# Executar a depreciação

## Objetivo
Reduzir o **valor contábil** das unidades de património ao longo do tempo, conforme a **taxa de depreciação anual** definida no item. A depreciação é calculada **por unidade**.

## Quem pode executar
Utilizadores com a permissão **financeira** (`inventory:financial`) — tipicamente **Inventory_Admin** ou gestão.

## Antes de começar
- Os itens de património devem ter uma **taxa de depreciação anual (%)** definida (ver [Cadastrar/editar item](../itens/editar-item.md));
- decida o **ano** a executar.

## Passo a passo
1. Menu **Depreciação**.
2. Informe o **ano a executar**.
   > 📸 [captura: tela de Depreciação com o ano]
3. Execute. O sistema aplica a taxa a cada unidade ativa, reduzindo o **valor contábil**.

## Resultado esperado
- O **valor contábil** de cada unidade diminui conforme a taxa (proporcional ao tempo, quando aplicável — *pro-rata*).
- Gera-se o registo da depreciação; o **valor contábil total** do item é atualizado (visível na ficha).
- Se o valor de uma unidade chegar a **zero**, ela é encerrada/baixada por depreciação.

## Atenção
- A depreciação altera o **valor**, não a **quantidade** nem o estado de uso (exceto quando o valor zera).
- É uma operação **por período** — executar duas vezes o mesmo ano pode depreciar em duplicado; siga a política interna.

## Erros comuns
| Situação | Causa | Solução |
|---|---|---|
| Nada deprecia | Itens sem **taxa** definida | Defina a taxa de depreciação anual no item |
| Valor não bate | Execução repetida ou taxa errada | Reveja a taxa e o histórico de depreciações |

## Como corrigir
Ajustes de valor seguem a política contabilística interna; consulte o responsável financeiro antes de reexecutar.

## Auditoria
Os movimentos de depreciação (anuais/pro-rata) ficam no **Histórico** e refletem-se no **valor contábil** das unidades na ficha do item.

## Tarefas relacionadas
[Dar baixa numa unidade](dar-baixa.md) · [Cadastrar uma aquisição](cadastrar-aquisicao.md) · [Relatórios](../relatorios/relatorios-e-kardex.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Património.
