# Localizações

## Objetivo
Cadastrar os **locais** onde o stock existe. Uma localização é um **sublocal** dentro de uma **unidade** (ex.: *Palácio de Cristal · Estoque Central*). Toda entrada, saída e transferência acontece numa localização.

## Quem pode executar
Utilizadores com permissão de **editar item/cadastros** (`inventory:update_item`).

## Passo a passo
1. Menu **Cadastros › Localizações**.
2. **Nova** → informe a **unidade**, o **nome** do sublocal e os indicadores de fluxo:
   - **Permite envio** (pode ser **origem** de saídas/transferências);
   - **Permite receção** (pode ser **destino** de entradas/transferências).
   > 📸 [captura: cadastro de localização com envio/receção]
3. Salve.

## Atenção
- Se uma localização **não permite envio**, ela não aparece como origem em saídas/transferências; **não permite receção** → não aparece como destino.
- A localização é usada em todo o inventário — evite apagar uma com stock/movimentos.

## Tarefas relacionadas
[Transferir materiais](../consumo/transferir-materiais.md) · [Inventário físico](../inventario-fisico/executar-contagem.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
