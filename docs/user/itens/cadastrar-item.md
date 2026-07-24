# Cadastrar um item

## Objetivo
Criar um novo item no catálogo do inventário. Existem dois tipos, que se comportam de forma diferente:
- **Consumo** — materiais que entram, saem e têm saldo de stock (ex.: implantes, descartáveis). Podem controlar **lote/validade**.
- **Património** — bens controlados **unidade a unidade** por **número de série** (ex.: equipamentos). Não têm saldo de stock; têm depreciação.

## Quem pode executar
Utilizadores com a permissão **criar item** (`inventory:create_item`). As permissões são concedidas pelo módulo de **Utilizadores/RH**.

## Antes de começar
Tenha cadastrados (ou crie na hora, pelos atalhos):
- **Categoria** do item (só é possível escolher categorias **finais/folha** — ver [Categorias](../cadastros/categorias.md));
- **Unidade de medida** de compra;
- opcionalmente **Fornecedor** padrão e **Fabricante**.

## Passo a passo
1. Menu lateral → **Itens** → botão **Novo item**.
2. Escolha o **tipo**: **Consumo** ou **Património**.
   > 📸 [captura: escolha do tipo Consumo/Património]
3. Preencha a **Identificação**:
   - **Nome** (obrigatório) e Descrição;
   - **Categoria** — comece a digitar para buscar; só aparecem as categorias **finais** (uma categoria-pai não é selecionável);
   - **Fabricante** — selecione da lista (busca); se não existir, clique no **+** ao lado para cadastrar sem sair da tela;
   - Ref. fabricante, Código de barras;
   - **Fornecedor padrão** (opcional).
   - O **Código interno** (ex.: `1000123` para consumo, `2000123` para património) e o **QR Code** são gerados **automaticamente**.
4. **Unidades e conversão** — informe a **UM de compra** (obrigatória) e, se aplicável, a UM de consumo e o fator de conversão.
5. **(Consumo) Controle de lote** — a caixa **"Este item controla lote / validade"** vem marcada:
   - **Marcada** → o nº de lote passa a ser **obrigatório** na entrada e a saída usa **FEFO** (validade mais próxima primeiro).
   - **Desmarcada** → o lote fica **opcional** (o campo continua existindo); útil para materiais sem rastreio de lote. Ver [Controlar lotes](../consumo/controlar-lotes.md).
6. **(Consumo) Parâmetros de stock** — Stock mínimo, máximo e tempo de reposição (usados para os alertas de "abaixo do mínimo").
7. **(Património) Dados patrimoniais** — informe a **taxa de depreciação anual (%)**. O nº de património é gerado automaticamente; **valor e data de aquisição são por unidade**, informados depois em **Património › Entrada**.
8. **Imagem** (opcional) — anexe uma foto do item.
9. Clique em **Criar item**.

## Resultado esperado
O item passa a aparecer na lista de **Itens**, com o código interno gerado. A coluna **Stock** mostra o saldo atual (0 para um item novo). A ficha do item já traz o **QR Code** e, no património, a galeria de **anexos**.

## Atenção
- O **tipo (Consumo/Património)** não pode ser alterado depois de criado.
- **Património tem anexos (fotos)** — até **6** por item, adicionados **depois de salvar** (na edição da ficha).
- A categoria escolhida deve ser **final**: se você precisa de uma categoria que hoje tem subcategorias, crie/escolha a subcategoria correta.

## Erros comuns
| Mensagem | Causa | Solução |
|---|---|---|
| "A categoria selecionada possui subcategorias — escolha uma categoria folha." | Escolheu uma categoria-pai | Escolha a subcategoria final (indentada) |
| "base_uom_id é obrigatório" / não deixa salvar | Faltou a UM de compra | Preencha a **UM de compra** |
| Fabricante não aparece na lista | Ainda não foi cadastrado | Use o **+** ao lado do campo para criar |

## Como corrigir
Depois de criado, use **[Editar um item](editar-item.md)** para ajustar campos (nome, categoria, controle de lote, stock mínimo, etc.).

## Auditoria
A criação e edições ficam registadas com o utilizador e o momento — consultáveis no **Log de Acesso**.

## Tarefas relacionadas
[Editar um item](editar-item.md) · [Consultar a ficha](consultar-ficha.md) · [Categorias](../cadastros/categorias.md) · [Fabricantes](../cadastros/fabricantes.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
