# Categorias

## Objetivo
Organizar os itens numa **árvore de categorias**, separada por macro-categoria (**Consumo** e **Património**). As categorias ajudam a filtrar e organizar o catálogo.

## Quem pode executar
Utilizadores com permissão de **editar item/cadastros** (`inventory:update_item`).

## Passo a passo
1. Menu **Cadastros › Categorias** — a árvore aparece separada em **Consumo** e **Património**.
2. Para criar: escolha o **macro** e a **categoria-pai** (ou raiz) → **Adicionar** → nome.
3. Pode criar **subcategorias** (níveis): Consumo até 2 níveis; Património mais profundo.
   > 📸 [captura: árvore de categorias com pai/filha]

## Atenção — regra importante
- No **item**, só se pode escolher uma categoria **final (folha)** — ou seja, **sem subcategorias**. Uma categoria-pai serve só para organizar; não é selecionável no item.
- Se transformar uma categoria-folha (com itens) numa categoria-pai (criando uma subcategoria), os itens já ligados continuam válidos, mas novas seleções passam a ser só nas folhas.
- Não é possível apagar uma categoria com **subcategorias** ou com **itens** associados.

## Erros comuns
| Mensagem (no item) | Causa | Solução |
|---|---|---|
| "A categoria selecionada possui subcategorias — escolha uma categoria folha." | Escolheu uma categoria-pai | Crie/escolha a subcategoria final |

## Tarefas relacionadas
[Cadastrar um item](../itens/cadastrar-item.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
