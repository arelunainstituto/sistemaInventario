# Cadastrar uma aquisição (entrada de património)

## Objetivo
Registar a **aquisição** de bens de **património**, criando **uma unidade por número de série**. Cada unidade passa a ser um ativo controlado individualmente (com localização, colaborador, valor e depreciação próprios).

## Quem pode executar
Utilizadores com a permissão **entrada** (`inventory:entry`).

## Antes de começar
- O **item de património** deve existir (ver [Cadastrar um item](../itens/cadastrar-item.md), tipo **Património**);
- tenha a **localização inicial** e, se aplicável, o **colaborador** responsável (colaboradores vêm do módulo **RH**) e o **documento** de aquisição.

## Passo a passo
1. Menu **Património › Entrada** → **Nova entrada**.
2. Cabeçalho:
   - **Produto patrimonial** (busca — só itens de património);
   - **Localização inicial** e, opcionalmente, **Colaborador**, **Fornecedor** e **Documento de aquisição**.
3. **Unidades (números de série)** — **Adicionar unidade** para cada equipamento:
   - **Número de série** — pode **deixar em branco**: o sistema gera automaticamente **`<código do item>-NN`** (ex.: `2000123-01`, `2000123-02`, …). Ou informe a série real.
   - **Data de aquisição** e **Valor** (por unidade).
   > 📸 [captura: unidades com nº de série auto e valor por unidade]
4. Clique em **Cadastrar unidades**.

## Resultado esperado
- Cada unidade é criada com estado **em uso**, na localização (e colaborador) indicados.
- O **valor contábil** de cada unidade começa igual ao valor de aquisição (base da depreciação).
- Gera-se um **movimento de entrada** por unidade; os números de série criados aparecem na confirmação e na lista.

## Atenção
- O número de série é **único por item**. Se informar um já existente para o mesmo item, o sistema recusa.
- **Valor e data são por unidade** — não no cabeçalho.
- Pode misturar: informar a série real em algumas unidades e deixar outras em branco (auto).

## Erros comuns
| Mensagem | Causa | Solução |
|---|---|---|
| "Número(s) de série já cadastrado(s) para este item: …" | Série repetida | Use outra série ou deixe em branco (auto) |
| "'X' não é patrimonial — use Consumo › Entrada" | O produto escolhido é de consumo | Consumo entra por **[Entrada de consumo](../consumo/registrar-entrada.md)** |

## Como corrigir
Erro numa unidade recém-criada: um **Admin** pode inativar o movimento; ou faça a **[baixa](dar-baixa.md)** da unidade errada.

## Auditoria
Cada unidade e movimento de entrada ficam no **Histórico**; a lista de **Património › Entrada** mostra todas as unidades cadastradas.

## Tarefas relacionadas
[Movimentar um equipamento](movimentar-equipamento.md) · [Executar a depreciação](executar-depreciacao.md) · [Cadastrar um item](../itens/cadastrar-item.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Património.
