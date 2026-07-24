# Fabricantes

## Objetivo
Cadastrar os **fabricantes** (marcas) usados nos itens. O fabricante é uma **entidade própria** (não texto livre), o que padroniza o catálogo.

## Quem pode executar
- **Consultar**: leitura (`inventory:read`).
- **Criar/editar**: `inventory:create_item` / `inventory:update_item`.

## Passo a passo
1. Menu **Cadastros › Fabricantes** → **Novo** (ou edite).
2. Preencha: **Nome** (obrigatório), **Website**, **Notas** e **Ativo**.
   > 📸 [captura: cadastro de fabricante]
3. Salve.

> **Atalho:** no cadastro do **item**, o campo **Fabricante** é uma busca; o botão **+** ao lado cria um fabricante novo na hora e já o seleciona.

## Atenção
- O **nome** é único (não pode repetir).
- Não confundir **Fabricante** (a marca) com **Ref. fabricante** (o código/referência do produto no fabricante), que é um campo de texto do item.

## Tarefas relacionadas
[Cadastrar um item](../itens/cadastrar-item.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
