# Ler um QR Code

## Objetivo
Ler a etiqueta QR de um item/lote/unidade para abrir rapidamente a informação correspondente.

## Quem pode executar
Utilizadores com acesso de **leitura** (`inventory:read`).

## Antes de começar
Tenha a etiqueta impressa (ver [Imprimir uma etiqueta QR](imprimir-etiqueta.md)) e um dispositivo com câmera ou um leitor de QR.

## Passo a passo
1. Menu **Ler QR Code** (ou aponte a câmera do telemóvel para a etiqueta).
2. O QR abre a **ficha do item**; se for um QR de **lote** ou **série**, a ficha mostra um aviso **"Etiqueta lida: Lote X / Série Y"** e **realça a linha** correspondente.
   > 📸 [captura: ficha aberta por QR com a linha do lote realçada]

## Resultado esperado
Você chega diretamente ao item e ao **lote/unidade** específico da etiqueta, sem procurar na lista.

## Atenção
- Etiquetas de **item** antigas continuam a funcionar (abrem o item).
- O mesmo QR será, no futuro, lido no **PDV** para dar baixa — por isso o código é **permanente** por lote/série.

## Erros comuns
| Situação | Causa | Solução |
|---|---|---|
| "QR Code não encontrado" | Código inválido ou item removido | Confira a etiqueta; reimprima se necessário |
| Abre o item mas não realça lote | Etiqueta é do **item** (não de lote/série) | Normal para consumo sem lote |

## Tarefas relacionadas
[Imprimir uma etiqueta QR](imprimir-etiqueta.md) · [Consultar a ficha](../itens/consultar-ficha.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
