# Atribuir uma unidade a um colaborador

## Objetivo
Definir ou trocar o **colaborador responsável** por uma unidade de património (quem detém/usa o equipamento).

## Quem pode executar
Utilizadores com a permissão **transferência** (`inventory:transfer`).

## Antes de começar
- A unidade deve estar **ativa**;
- o **colaborador** deve existir no módulo **RH** (a lista de colaboradores vem de lá — `rh_employees`).

## Passo a passo
A atribuição é feita **na movimentação** da unidade:
1. Menu **Património › Movimentação** → **Nova movimentação**.
2. Escolha a **unidade**.
3. No **Colaborador de destino**, selecione o novo responsável (pode manter a localização).
   > 📸 [captura: campo Colaborador de destino]
4. Justifique (recomendado) e confirme.

> Também é possível definir o colaborador logo na **[aquisição](cadastrar-aquisicao.md)** (campo "Colaborador" do cabeçalho).

## Resultado esperado
A unidade passa a ter o **colaborador atual** atualizado; a ficha do item (unidades) mostra o responsável.

## Atenção
- Se o colaborador estiver **inativo** no RH, ainda assim o responsável **atual** da unidade é preservado — o sistema não o remove sozinho.
- Trocar o colaborador é uma **movimentação** (fica no histórico).

## Erros comuns
| Situação | Causa | Solução |
|---|---|---|
| O colaborador não aparece na lista | Não existe/está inativo no RH | Cadastre/ative o colaborador no módulo **RH** |

## Como corrigir
Atribuição errada: faça nova **movimentação** com o colaborador correto.

## Auditoria
A troca de responsável fica registada como movimentação no **Histórico**.

## Tarefas relacionadas
[Movimentar um equipamento](movimentar-equipamento.md) · [Cadastrar uma aquisição](cadastrar-aquisicao.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Património.
