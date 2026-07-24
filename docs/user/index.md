# Manual do utilizador — Inventory

Guia prático das tarefas do módulo de Inventário. Cada página segue o mesmo formato:
**Objetivo → Quem pode → Antes de começar → Passo a passo → Resultado → Atenção → Erros comuns → Como corrigir → Auditoria**.

> 📸 As capturas de tela estão marcadas como `> 📸 [captura: …]`. Ver [como anexar capturas](#como-anexar-as-capturas) no fim desta página.

## Comece por aqui
- [Primeiros passos](primeiros-passos.md) — entrar, o Dashboard e a navegação.
- [Perfis e permissões](perfis-e-permissoes.md) — quem pode fazer o quê.
- [Glossário](glossario.md) — stock, lote, FEFO, custo médio, património, seeding…

## Itens (cadastro)
- [Cadastrar um item](itens/cadastrar-item.md)
- [Editar um item](itens/editar-item.md)
- [Consultar a ficha de um item](itens/consultar-ficha.md)

## Consumo
- [Registar uma entrada](consumo/registrar-entrada.md)
- [Registar uma saída](consumo/registrar-saida.md)
- [Transferir materiais entre localizações](consumo/transferir-materiais.md)
- [Controlar lotes e validade (FEFO)](consumo/controlar-lotes.md)

## Património
- [Cadastrar uma aquisição](patrimonio/cadastrar-aquisicao.md)
- [Movimentar um equipamento](patrimonio/movimentar-equipamento.md)
- [Atribuir a um colaborador](patrimonio/atribuir-colaborador.md)
- [Dar baixa numa unidade](patrimonio/dar-baixa.md)
- [Executar a depreciação](patrimonio/executar-depreciacao.md)

## Operações e apoio
- [Executar o inventário físico](inventario-fisico/executar-contagem.md)
- [Corrigir quantidades (Ajustes)](ajustes/corrigir-quantidade.md)
- [Imprimir etiqueta QR](qr-code/imprimir-etiqueta.md) · [Ler um QR](qr-code/ler-qr.md)
- [Relatórios, Kardex e Histórico](relatorios/relatorios-e-kardex.md)

## Cadastros auxiliares
- [Localizações](cadastros/localizacoes.md) · [Categorias](cadastros/categorias.md) · [Fornecedores](cadastros/fornecedores.md) · [Fabricantes](cadastros/fabricantes.md) · [Unidades de medida](cadastros/unidades-medida.md)

## Quando algo dá errado
- [Erros comuns e soluções](resolucao-de-problemas/erros-comuns.md)

---

### Como anexar as capturas
Onde aparecer `> 📸 [captura: descrição]`, substitua pela imagem:
1. Tire o print da tela indicada (destacando o campo/botão/aviso mencionado).
2. Guarde em `docs/user/_img/<pasta-da-tarefa>/<nome>.png` (ex.: `docs/user/_img/itens/cadastrar-macro.png`).
3. Troque o marcador por: `![descrição](../_img/itens/cadastrar-macro.png)` (ajuste o caminho relativo à página).
4. Anote no rodapé "Controle" a versão em que a captura foi tirada — a interface muda.

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
