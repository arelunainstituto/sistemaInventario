# Unidades de medida

## Objetivo
Cadastrar as **unidades de medida (UM)** usadas nos itens — de **compra** e de **consumo** (ex.: caixa, unidade, ampola, mL).

## Quem pode executar
- **Consultar**: leitura (`inventory:read`).
- **Criar/editar**: `inventory:create_item` / `inventory:update_item`.

## Passo a passo
1. Menu **Cadastros › Unidades de medida** → **Nova** (ou edite).
2. Preencha o **código** (ex.: `UN`, `CX`, `ML`) e o **nome**.
   > 📸 [captura: cadastro de unidade de medida]
3. Salve.

## Como se usa no item
- **UM de compra** — como o material é adquirido/recebido (ex.: caixa).
- **UM de consumo** — como é consumido (ex.: unidade).
- **Fator de conversão** — quantas unidades de consumo há numa de compra (ex.: 1 caixa = 100 unidades → 100). Hoje as entradas operam direto na unidade de consumo.

## Atenção
- Evite apagar uma UM em uso por itens.

## Tarefas relacionadas
[Cadastrar um item](../itens/cadastrar-item.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
