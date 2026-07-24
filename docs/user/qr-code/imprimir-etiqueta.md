# Imprimir uma etiqueta QR

## Objetivo
Imprimir a etiqueta com **QR Code** de um item. O QR pode ser **por lote** (consumo que controla lote) ou **por número de série** (património) — assim, ao ler, o sistema sabe exatamente **qual lote/unidade**.

## Quem pode executar
Utilizadores com acesso de **leitura** (`inventory:read`).

## Antes de começar
- Impressora **Brother QL-810W** com o rolo **DK-2205 (62 mm contínuo)**;
- o item deve ter o lote/série a etiquetar (ou, para consumo sem lote, imprime-se a etiqueta do **item**).

## Passo a passo
1. Em **Itens** (lista ou ficha), clique em **Etiqueta QR**.
2. O sistema **pergunta qual** imprimir:
   - **Consumo com lote** → escolha o **lote**;
   - **Património** → escolha a **unidade (número de série)**;
   - **Consumo sem lote** → vai direto à etiqueta do **item**.
   > 📸 [captura: seletor "escolha o lote / a unidade"]
3. Na tela da etiqueta, escolha o **tamanho do QR**: **P (50%)**, **M (75%)** ou **G (100%)** — a largura é sempre 62 mm.
4. Clique em **Imprimir**.

## Resultado esperado
Sai **uma etiqueta** com o nome do item, o QR, o código interno e a identificação do lote/série. A impressora corta automaticamente no comprimento do conteúdo.

## Atenção — configuração da impressora (importante)
Se a etiqueta sair **quebrada em várias páginas**, o problema é o **formato do papel no driver**:
- No driver da **QL-810W** → **Preferências de impressão** → **Formato do papel**: selecione **“62 mm” (contínuo)**, **não** “62 mm × 29 mm” (die-cut).
- No diálogo do navegador → **Margens: Nenhuma** e **Cabeçalhos/rodapés: desativados**.
- Mantenha **“Cortar em cada 1 etiqueta”** ligado.

## Erros comuns
| Situação | Causa | Solução |
|---|---|---|
| Etiqueta em 3 páginas | Driver em die-cut "62 × 29 mm" | Trocar para **62 mm contínuo** (ver acima) |
| QR muito grande/pequeno | Tamanho P/M/G | Ajuste para M ou G |
| "Etiqueta do item" em vez de lote | Item de consumo **sem** controlo de lote | Esperado — só lote/série têm QR próprio |

## Como corrigir
Reimprimir com o tamanho/rolo corretos. O QR de um lote/série é **permanente** — reimprimir gera o mesmo código.

## Auditoria
A geração de etiquetas fica registada no **Log de Acesso** (pedido do QR do item).

## Tarefas relacionadas
[Ler um QR](ler-qr.md) · [Consultar a ficha](../itens/consultar-ficha.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
