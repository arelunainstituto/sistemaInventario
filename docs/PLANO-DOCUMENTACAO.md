# Plano de Documentação — Módulo INVENTORY

> Roadmap da documentação do módulo **Inventory** do ERP Grupo AreLuna, seguindo o
> [DOC-GUIDE.md](../DOC-GUIDE.md): separação por público, modelo **Diátaxis**, documentar
> **por tarefa**, **fonte canónica única**, terminologia **pt-PT** consistente.
>
> Estado do sistema no momento do plano: **v1.18.0-beta-03** (CHANGELOG de 30/05/2026 a 22/07/2026).
> Escopo: **apenas o módulo Inventory**. Outros módulos aparecem **só como dependência**
> (ex.: permissões/perfis e colaboradores vêm do módulo **HR** — `rh_employees`, `requirePermission`).

---

## 0. Princípios (resumo do DOC-GUIDE)

1. **Dois públicos, duas experiências:** `docs/user` (operacional) e `docs/developer` (técnica).
2. **Diátaxis:** cada página é *tutorial*, *guia prático*, *referência* ou *explicação* — não misturar.
3. **Por tarefa, não por tela:** "Como transferir materiais entre localizações", não "Tela de Transferências".
4. **Sempre mostrar consequência + resultado esperado + como corrigir + onde auditar.**
5. **Fonte canónica única:** um conteúdo, uma fonte Markdown, várias apresentações.
6. **pt-PT** consistente ("stock", "localização", "património", "registo", "utilizador").
7. **Controle de versão por página:** "Versão do sistema" + "Última validação" + responsável.
8. **Não expor internals ao utilizador** (nomes de tabela, funções SQL, endpoints) — só em suporte avançado.

## Faseamento

- **Fase 1 — `docs/user` (FOCO AGORA):** entrega final voltada aos **utilizadores**.
- **Fase 2 — `docs/developer` (depois):** arquitetura + **regras de negócio** da refatoração, para manutenção.

---

## 1. Estrutura de pastas (alvo)

```text
docs/
├── index.md                      # porta de entrada: escolha user vs developer
├── PLANO-DOCUMENTACAO.md         # este arquivo (roadmap)
│
├── user/                         # FASE 1
│   ├── index.md
│   ├── primeiros-passos.md
│   ├── perfis-e-permissoes.md    # depende do HR (permissões/roles)
│   ├── glossario.md
│   ├── itens/
│   ├── consumo/
│   ├── patrimonio/
│   ├── inventario-fisico/
│   ├── ajustes/
│   ├── qr-code/
│   ├── relatorios/
│   ├── cadastros/
│   └── resolucao-de-problemas/
│
├── developer/                    # FASE 2
│   ├── index.md
│   ├── getting-started.md
│   ├── architecture/  (C4: context, containers, modules, auth, permissions)
│   ├── domain/        (regras de negócio RNxx, consumo, patrimonio, lotes-fefo, cmp, depreciacao, seeding)
│   ├── api/           (openapi.yaml, errors, pagination)
│   ├── database/      (tables, functions, migrations, rollback)
│   ├── operations/    (env, deploy, backup, seeding-toggle, logging, runbook)
│   ├── testing/       (strategy — registrar a dívida "no test specified")
│   └── decisions/     (ADRs)
│
└── archive/
    └── implementation-history/   # move os docs históricos (CORRECAO_*, RESUMO_*, GUIA_*…)
```

**Higiene inicial (antes de escrever):**
- Mover para `docs/archive/implementation-history/` os documentos históricos de `documentacao/` (CORRECAO_*, RESUMO_*, SOLUCAO_*, AJUSTE_*, EXECUTAR_*), **inclusive os de outros módulos** (laboratório, portal cliente, OS, kits, técnicos) — ficam fora da navegação principal, sem apagar.
- **Fonte canónica do Património:** hoje há `documentacao/INVENTARIO_PATRIMONIO.md` **e** uma cópia embutida em `public/inventory/docs-patrimonio.html`. Decidir a fonte única (o Markdown em `docs/`) e fazer a página do sistema **carregar** esse Markdown em vez de duplicar. (Item de governança; não bloqueia a Fase 1.)

---

## 2. FASE 1 — `docs/user` (mapa completo)

Cada página segue o **formato padrão** (ver §4). Marcação Diátaxis entre colchetes.

### Raiz
- `index.md` — o que é o Inventory, como navegar o manual, links para as tarefas frequentes. [explicação/nav]
- `primeiros-passos.md` — entrar no sistema, o Dashboard, a barra lateral, a busca global. [tutorial]
- `perfis-e-permissoes.md` — o que cada perfil pode fazer. **Dependência do HR:** as permissões (`read`, `entry`, `exit`, `transfer`, `create_item`, `update_item`, `reports`, `financial`, `inventory_session`) e o perfil **Inventory_Admin** são concedidos pelo módulo de RH/Utilizadores. [referência]
- `glossario.md` — stock, localização, sublocal, lote, **validade/FEFO**, **CMP (custo médio)**, macro-categoria (**Consumo × Património**), número de série, **modo seeding**, mínimo/reposição, ajuste, kardex, movimento. [explicação]

### itens/
- `cadastrar-item.md` — criar item **Consumo** ou **Património**; categoria (**só folha**), unidade de medida, fornecedor padrão, **fabricante** (cadastro próprio), **controla lote (opcional)**, imagem; no património: taxa de depreciação e **anexos/fotos (até 6)**. [guia]
- `editar-item.md` — editar; **ligar/desligar "controla lote" mesmo com lotes lançados** (passou a ser opcional). [guia]
- `consultar-ficha.md` — ficha do item: stock por localização, unidades (série), anexos, **etiqueta QR**. [guia]

### consumo/
- `registrar-entrada.md` — entrada com documento (fatura), fornecedor e **várias linhas**; **lote opcional** por linha (obrigatório só se o item controla); efeito no stock e no **CMP**. [guia]
- `registrar-saida.md` — saída de **vários itens** numa vez (multi-linha); **FEFO** automático por validade; confirmação "**abaixo do mínimo**"; comportamento em **modo seeding** (saldo negativo). [guia]
- `transferir-materiais.md` — transferir **vários itens** de uma **origem** para um **destino** (multi-item, atómico; gera 2 movimentos por linha). [guia]
- `controlar-lotes.md` — o que é controlar lote, **FEFO/validade**, lote **opcional**; quando faz sentido ligar/desligar. [explicação]

### patrimonio/
- `cadastrar-aquisicao.md` — entrada por **número de série** (1..N unidades), **auto-geração `<código>-NN`** quando vazio, valor/data de aquisição **por unidade**, fornecedor, documento. [guia]
- `movimentar-equipamento.md` — mover unidade por **localização e/ou colaborador** (origem→destino). [guia]
- `atribuir-colaborador.md` — associar/trocar o colaborador responsável (colaboradores vêm do **HR**). [guia]
- `dar-baixa.md` — baixa de unidade (**irreversível**: impede nova movimentação). [guia]
- `executar-depreciacao.md` — depreciação **por unidade** (anual/pro-rata); efeito no **valor contábil**. [guia]

### inventario-fisico/
- `executar-contagem.md` — abrir sessão por sublocal, contar (com a **busca por nome/código/lote**), **salvar contagens**, **validar e gerar ajustes**, cancelar. [guia]

### ajustes/
- `corrigir-quantidade.md` — ajuste **positivo/negativo** (só **Admin**); **avaria/extravio/perda/quebra** entram por aqui (fluxo administrativo). Quando usar **ajuste × transferência × saída**. [guia + explicação]

### qr-code/
- `imprimir-etiqueta.md` — imprimir etiqueta **por lote/número de série** (o sistema pergunta qual); tamanhos **P/M/G**; ajuste do driver **Brother QL-810W (62 mm contínuo)**. [guia]
- `ler-qr.md` — ler o QR (câmera/leitor) e o que ele abre. [guia]

### relatorios/
- `relatorios-e-kardex.md` — relatórios de stock/valor, **Kardex** (saldo cronológico), **Histórico** de movimentos, **Log de Acesso**. [guia + referência]

### cadastros/
- `localizacoes.md`, `categorias.md` (hierarquia, **folha**), `fornecedores.md`, `fabricantes.md`, `unidades-medida.md`. [guia]

### resolucao-de-problemas/
- `erros-comuns.md` — mensagem → causa → solução. Cobrir: "**Stock insuficiente (RN05)**", "**controla lote (RN03): nenhum lote disponível**", "**abaixo do mínimo**", "**modo seeding ativo**", "documento já registado", limite de anexos, categoria não-folha. [guia]

**Ordem de execução (mais frequentes primeiro):**
1. cadastrar-item → 2. registrar-entrada → 3. registrar-saida → 4. transferir-materiais →
5. patrimonio (aquisição/movimentação/baixa) → 6. inventario-fisico → 7. qr-code →
8. relatorios/kardex → 9. cadastros → 10. erros-comuns → 11. perfis-e-permissoes + glossário + primeiros-passos.

---

## 3. Mudanças "no meio do caminho" que a doc DEVE refletir (estado atual, não o original)

Extraídas do CHANGELOG — a documentação descreve o comportamento **atual**:

- **Controle de lote virou OPCIONAL** (1.14.0 / 1.18.0-b01): "não controla lote" apenas tira a obrigatoriedade; o campo continua e a saída faz **FEFO se houver lote**. Pode desligar mesmo com lotes lançados.
- **Modo seeding** (stock negativo temporário) — 1.13.1 / 1.15.1 / 1.17.1: entradas/saídas com saldo negativo; **CMP nunca negativo**; ligar/desligar via flag.
- **Saída multi-linha** (1.16.0) e **Transferência multi-item** (1.18.0-b02) — atómicas.
- **Nº de série automático** `<código>-NN` (1.14.0).
- **Fabricante como entidade** própria (1.14.0) e **anexos/fotos no património** até 6 (1.15.0).
- **Categoria só folha** selecionável, em cascata (1.14.0).
- **QR por lote/série** + picker + **etiqueta P/M/G** (1.17.0).
- **Ajustes** absorveram avaria/extravio/perda/quebra (fluxo administrativo).
- **Coluna "Stock"** (saldo atual) e **busca no Inventário Físico** (1.16.0 / 1.18.0-b03).
- **Renovação de sessão** e **Enter não salva** (UX, 1.15.0) — citar em *primeiros-passos*.

---

## 4. Formato padrão de cada página do utilizador (do DOC-GUIDE §8)

```md
# Como [tarefa]
## Objetivo
## Quem pode executar        (perfis/permissões — dependência HR)
## Antes de começar          (cadastros/pré-requisitos)
## Passo a passo             (1,2,3… com o que preencher)
## Resultado esperado        (o que muda no stock/histórico e onde ver)
## Atenção                   (irreversível, validações, consequências)
## Erros comuns              (mensagem → causa → solução)
## Como corrigir             (ajuste/estorno/procedimento)
## Auditoria                 (quem fez, quando — Histórico/Log/Kardex)
## Tarefas relacionadas      (links)
## Controle: versão 1.18+ · última validação AAAA-MM-DD · responsável
```

---

## 5. FASE 2 — `docs/developer` (esboço, para depois)

- **architecture/** — C4 (contexto: utilizador, Inventory, **HR**, Supabase, Vercel, leitores de QR/PDV futuro; containers: frontend estático, API Express, Supabase Auth/PostgreSQL/Storage; modules do inventário), **authentication** (Supabase JWT, recuperação, troca a cada 30 dias), **permissions** (`requirePermission('inventory', …)` + roles do HR).
- **domain/** — **regras de negócio** consolidadas (RN03 lote, RN04 FEFO, RN05 não-negativo/seeding, RN06 CMP, RN07 movimentos imutáveis, §16 mínimo), consumo × património, lotes-fefo, **custo-médio (CMP)**, depreciação por unidade, seeding.
- **api/** — `openapi.yaml` de `/api/inventory/*` (items, entries, exits, exits/batch, transfers, transfers/batch, patrimony, inventory-sessions, reports, scan, qr, drafts…), com auth, permissão, corpo, 409/atomicidade.
- **database/** — tabelas (`inv_*`), funções (`fn_inv_*`), **migrações** (numeradas `10`→`123`, aplicadas manualmente no Supabase) e rollback.
- **operations/** — variáveis de ambiente, deploy (Vercel), backup/restore, **toggle do seeding**, logging, runbook de incidentes.
- **testing/** — estratégia; **registrar a dívida**: `npm test` ainda retorna "no test specified" (há `supertest` como devDep, sem suíte real).
- **decisions/** — ADRs: Supabase; macro_category (Consumo×Património); movimentos imutáveis; FEFO; transferência atómica; património por série; frontend sem framework; **QR permanente por lote/série**; **lote opcional**; **modo seeding**.

---

## 6. Governança (Prioridade 4 do guia)

- Documentação obrigatória no PR (template do §10 do guia), com checklist de migração/API/manual.
- `docs/index.md` = navegação curta (não um índice de 85 itens).
- Fonte canónica marcada em cada doc; validação de links e lint de Markdown quando houver CI.
- Campo "última versão validada" por página; revisão periódica.

---

## 7. Próximos passos (proposta de execução)

1. **Aprovar este plano** (estrutura + escopo user-first).
2. **Higiene:** criar `docs/`, mover históricos para `docs/archive/`, criar `docs/index.md` + `docs/user/index.md`.
3. **Fase 1:** escrever as páginas de `docs/user` na ordem de frequência (§2), em pt-PT, refletindo o estado **v1.18+** e as mudanças do §3.
4. Entregar a Fase 1 (manual do utilizador) e revisar.
5. **Fase 2:** `docs/developer` (arquitetura + regras de negócio + API/DB/ADRs).

> Este plano é um documento vivo: ao aprovar, começamos pela `docs/user`.
