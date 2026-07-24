# Glossário

Termos usados no Inventory (interface em pt-PT).

- **Stock** — quantidade de um material de **consumo** disponível numa localização. Património **não tem stock** (controla-se por unidade).
- **Localização / sublocal** — o local onde o stock existe (um sublocal dentro de uma unidade, ex.: *Palácio de Cristal · Estoque Central*).
- **Macro-categoria** — separa o catálogo em **Consumo** (com stock/lote) e **Património** (por número de série).
- **Lote** — agrupamento do material recebido, com **número de lote** e (opcional) **validade**.
- **Validade** — data de expiração de um lote. Opcional.
- **FEFO** (*First Expired, First Out*) — regra que faz sair **primeiro o lote que vence mais cedo** (🟢 na tela).
- **Controla lote** — opção do item de consumo: se **ligada**, o lote é **obrigatório** na entrada; se **desligada**, o lote é **opcional** (o campo continua existindo).
- **Número de série** — identificador único de uma **unidade** de património (1 série = 1 ativo). Pode ser gerado automaticamente como `<código>-NN`.
- **Custo Médio (CMP)** — média ponderada dos custos de entrada de um item; base do **valor** de inventário. Recalculado a cada entrada; nunca fica negativo.
- **Stock mínimo / máximo / reposição** — parâmetros do item usados para o alerta **"abaixo do mínimo"** (linha em vermelho).
- **Movimento** — todo evento de stock: entrada, saída, transferência (2 movimentos), ajuste, baixa, depreciação. Movimentos são **imutáveis** (correções são novos movimentos).
- **Kardex** — extrato cronológico de um item, com o **saldo acumulado** linha a linha.
- **Ajuste** — correção administrativa de saldo (sobra, falta, avaria, extravio, perda, quebra). Restrito a **Admin**.
- **Transferência** — mover stock de uma **localização** para outra (não altera o total nem o custo).
- **Movimentação (património)** — deslocar uma **unidade** por localização e/ou colaborador.
- **Baixa (património)** — encerrar definitivamente uma unidade (**irreversível**).
- **Depreciação** — redução do **valor contábil** de uma unidade ao longo do tempo (por taxa anual).
- **Valor contábil** — valor atual de uma unidade de património (aquisição menos depreciação).
- **Modo seeding** — estado temporário (carga inicial) que **permite stock negativo**; deve ser **desligado** depois. Nele, o custo médio nunca fica negativo.
- **Inventário físico** — sessão de **contagem** por localização que, ao validar, **gera ajustes** das diferenças.
- **QR Code** — código impresso na etiqueta que, ao ser lido, abre o **item / lote / unidade**. Permanente por lote/série.
- **Colaborador** — pessoa responsável por uma unidade de património. Vem do módulo **RH**.
- **Inventory_Admin** — perfil com acesso às operações sensíveis (ajustes, inativações, etc.).

## Tarefas relacionadas
[Primeiros passos](primeiros-passos.md) · [Perfis e permissões](perfis-e-permissoes.md) · [Erros comuns](resolucao-de-problemas/erros-comuns.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
