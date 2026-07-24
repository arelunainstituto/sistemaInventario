# Consultar a ficha de um item

## Objetivo
Ver, num só lugar, tudo sobre um item: dados de cadastro, **saldo por localização**, unidades de série (património), anexos e a **etiqueta QR**.

## Quem pode executar
Qualquer utilizador com acesso de **leitura** ao inventário (`inventory:read`).

## Antes de começar
Nada — basta o item existir.

## Passo a passo
1. **Itens** → clique no ícone de **visualizar** (olho) na linha do item, ou clique no item.
2. Na ficha, consulte:
   - **Identificação** — código, nome, categoria, fabricante, fornecedor padrão, QR (UUID).
   - **(Consumo) Stock por localização** — quanto há em cada localização e lote.
   - **(Consumo) Custo Médio (CMP)** e parâmetros de stock (mínimo/máximo/reposição).
   - **(Património) Unidades** — cada número de série com estado (em uso / inativo / **baixado**), localização e colaborador atuais, valor contábil.
   - **(Património) Anexos (fotos)** — galeria; clique para abrir em tamanho cheio.
   > 📸 [captura: ficha do item com stock por localização]
3. Ações disponíveis na ficha: **Editar**, **Kardex** do item, **Etiqueta QR**, **Histórico**.

## Resultado esperado
Uma visão completa e atualizada do item. A coluna **Stock** da lista e o saldo da ficha refletem as entradas, saídas, transferências e ajustes já lançados.

## Atenção
- Para **património**, não existe "saldo" — o controle é **por unidade** (cada série é 1 ativo).
- O **QR Code** da ficha é do **item**; a etiqueta impressa pode ser por **lote** ou **número de série** (ver [Imprimir etiqueta QR](../qr-code/imprimir-etiqueta.md)).

## Erros comuns
| Situação | Causa | Solução |
|---|---|---|
| Saldo aparece **negativo** | O item foi movimentado em **modo seeding** (permite negativo temporário) | Normal durante a carga inicial; regulariza com as entradas ou um ajuste. Ver [Glossário › seeding](../glossario.md) |
| Stock em vermelho | Saldo **no/abaixo do mínimo** | Repor o material (entrada) |

## Como corrigir
Diferenças de quantidade corrigem-se por [Ajustes](../ajustes/corrigir-quantidade.md) ou pelo [Inventário Físico](../inventario-fisico/executar-contagem.md).

## Auditoria
Use o **Kardex** (saldo cronológico) e o **Histórico** para ver cada movimento do item.

## Tarefas relacionadas
[Editar um item](editar-item.md) · [Relatórios e Kardex](../relatorios/relatorios-e-kardex.md) · [Imprimir etiqueta QR](../qr-code/imprimir-etiqueta.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
