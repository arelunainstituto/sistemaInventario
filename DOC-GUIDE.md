Analisei o repositório `arelunainstituto/sistemaInventario`, com foco no módulo `public/inventory`. A base documental já é superior à de muitos projetos internos, mas precisa ser reorganizada para funcionar como documentação de produto — e não apenas como memória das implementações realizadas.

## 1. Diagnóstico da documentação atual

### Pontos positivos

O projeto já possui:

* README com início rápido, tecnologias, variáveis de ambiente e links para documentos;
* backend do inventário separado em rotas por domínio, como itens, entradas, saídas, transferências, património, relatórios e inventário físico;
* changelog baseado em versionamento semântico e com indicação de migrações;
* documentação acessível dentro do próprio sistema;
* descrição razoavelmente detalhada de regras de negócio complexas, especialmente no módulo patrimonial.

O router do inventário está bem dividido por responsabilidade, o que facilita criar documentação modular por domínio.

O `CHANGELOG.md` também já possui uma política útil de versionamento, categorias de alteração e obrigação de indicar migrações e referências aos ficheiros alterados.

### Principal problema

Atualmente, a documentação está organizada sobretudo pelo histórico do desenvolvimento:

* `CORRECAO_FINAL...`
* `RESUMO_IMPLEMENTADO...`
* `SOLUCAO_COMPLETA...`
* `AJUSTE...`
* `EXECUTAR_CORRECAO...`

Esses documentos são úteis durante uma implementação, mas não são uma boa porta de entrada para alguém que precisa compreender o sistema seis meses depois.

Também há sinais de inconsistência documental:

* o README informa “73 documentações”;
* o índice informa 85 documentos;
* o índice foi atualizado em 24 de outubro de 2025;
* o changelog contém versões e alterações de julho de 2026.

Outro risco é a duplicação de fontes. A página `docs-patrimonio.html` contém uma cópia embutida do Markdown e informa que ela deve ser “mantida em sincronia” com outro ficheiro. Isso depende de atualização manual e inevitavelmente tende a gerar versões divergentes.

Por fim, o projeto possui `supertest` como dependência de desenvolvimento, mas o comando `npm test` ainda termina com “Error: no test specified”. Isso deve aparecer claramente na documentação técnica como dívida existente, e não como se houvesse uma suíte de testes disponível.

## 2. Separar a documentação por público

A recomendação mais importante é manter duas experiências documentais distintas.

### Documentação técnica

Destinada a:

* novos programadores;
* responsáveis por manutenção;
* DevOps;
* arquitetos;
* responsáveis por suporte técnico;
* pessoas que precisam alterar regras de negócio ou banco de dados.

Ela responde perguntas como:

* Como executar o projeto?
* Como os componentes se relacionam?
* Onde determinada regra está implementada?
* Qual tabela é afetada?
* Que migração preciso aplicar?
* Qual endpoint devo utilizar?
* Quais permissões são verificadas?
* Como diagnosticar um erro?
* Como publicar uma alteração?

### Documentação operacional

Destinada a:

* utilizadores administrativos;
* responsáveis de estoque;
* equipa do laboratório;
* responsáveis por património;
* gestores;
* auditores;
* suporte funcional.

Ela responde perguntas como:

* Como cadastrar um item?
* Como dar entrada em materiais?
* Como transferir um equipamento?
* Como corrigir uma quantidade?
* O que significa “abaixo do mínimo”?
* Quando utilizar ajuste ou transferência?
* Como dar baixa num património?
* Como executar o inventário físico?
* Como interpretar um relatório?
* O que fazer quando aparece determinado erro?

Não se deve mostrar ao utilizador operacional nomes como `inv_serial_units`, `fn_inv_consume_batch`, RLS ou endpoints, salvo quando forem necessários para suporte avançado.

## 3. Usar o modelo Diátaxis

Uma prática consolidada é organizar a documentação em quatro categorias:

1. **Tutoriais:** ensinam alguém que está começando.
2. **Guias práticos:** mostram como realizar uma tarefa concreta.
3. **Referência:** descrevem contratos, parâmetros, tabelas e configurações.
4. **Explicações:** apresentam conceitos, decisões e regras de negócio.

Esse modelo evita misturar numa mesma página um procedimento de utilização, o modelo de dados, endpoints e instruções de migração. ([diataxis.fr][1])

Aplicado ao Inventário:

| Categoria    | Exemplo                                                        |
| ------------ | -------------------------------------------------------------- |
| Tutorial     | Configurar o ambiente local e registrar a primeira entrada     |
| Guia prático | Como transferir vários materiais entre localizações            |
| Referência   | Contrato do endpoint `POST /api/inventory/transfers/batch`     |
| Explicação   | Por que Consumo e Património possuem ciclos de vida diferentes |

O atual documento de Património mistura todas essas categorias. Ele contém explicação conceitual, procedimentos de utilização, estrutura das tabelas, endpoints, migrações e testes ponta a ponta.

O conteúdo é bom. O problema é apenas a organização.

## 4. Estrutura recomendada no repositório

Sugiro substituir gradualmente a pasta `documentacao/` por uma estrutura como esta:

```text
docs/
├── index.md
│
├── user/
│   ├── index.md
│   ├── primeiros-passos.md
│   ├── perfis-e-permissoes.md
│   ├── glossario.md
│   │
│   ├── itens/
│   │   ├── cadastrar-item.md
│   │   ├── editar-item.md
│   │   └── consultar-ficha.md
│   │
│   ├── consumo/
│   │   ├── registrar-entrada.md
│   │   ├── registrar-saida.md
│   │   ├── transferir-materiais.md
│   │   └── controlar-lotes.md
│   │
│   ├── patrimonio/
│   │   ├── cadastrar-aquisicao.md
│   │   ├── movimentar-equipamento.md
│   │   ├── atribuir-colaborador.md
│   │   ├── dar-baixa.md
│   │   └── executar-depreciacao.md
│   │
│   ├── inventario-fisico/
│   ├── relatorios/
│   ├── qr-code/
│   ├── cadastros/
│   └── resolucao-de-problemas/
│
├── developer/
│   ├── index.md
│   ├── getting-started.md
│   ├── contributing.md
│   │
│   ├── architecture/
│   │   ├── system-context.md
│   │   ├── containers.md
│   │   ├── modules.md
│   │   ├── authentication.md
│   │   └── permissions.md
│   │
│   ├── domain/
│   │   ├── inventory-overview.md
│   │   ├── consumo.md
│   │   ├── patrimonio.md
│   │   ├── lotes-fefo.md
│   │   ├── custo-medio.md
│   │   └── depreciacao.md
│   │
│   ├── api/
│   │   ├── openapi.yaml
│   │   ├── authentication.md
│   │   ├── errors.md
│   │   └── pagination.md
│   │
│   ├── database/
│   │   ├── overview.md
│   │   ├── tables.md
│   │   ├── functions.md
│   │   ├── migrations.md
│   │   └── rollback.md
│   │
│   ├── operations/
│   │   ├── environment-variables.md
│   │   ├── deployment.md
│   │   ├── backup-restore.md
│   │   ├── logging.md
│   │   └── incident-runbook.md
│   │
│   ├── testing/
│   │   ├── strategy.md
│   │   ├── local-tests.md
│   │   └── inventory-e2e.md
│   │
│   └── decisions/
│       ├── index.md
│       └── adr-0001-*.md
│
└── archive/
    └── implementation-history/
```

Os documentos de correções antigas não precisam ser apagados. Eles podem ser movidos para `docs/archive/implementation-history`, ficando fora da navegação principal.

## 5. Documentação arquitetural

Para o sistema, eu usaria os níveis mais úteis do modelo C4:

### Diagrama de contexto

Mostra:

* utilizador do ERP;
* sistema de inventário;
* módulo de RH;
* Supabase;
* Vercel;
* sistemas externos que possam consumir QR ou inventário.

### Diagrama de containers

Mostra:

* frontend estático em `public/`;
* API Express em `api/`;
* Supabase Auth;
* PostgreSQL;
* Supabase Storage;
* Supabase Realtime;
* módulo de RH;
* eventuais integrações.

### Componentes do módulo Inventário

Pode mostrar:

* itens e cadastros;
* estoque de consumo;
* património;
* movimentações;
* inventário físico;
* relatórios;
* auditoria;
* importação.

O C4 utiliza níveis progressivos de detalhe e recomenda, para a maioria das equipas, começar apenas pelo contexto e pelos containers. Diagramas de componentes só devem ser criados quando realmente ajudarem. ([C4 model][2])

Os diagramas devem possuir título, escopo, legenda, tecnologias e relações identificadas. ([C4 model][3])

## 6. Documentar a API com OpenAPI

O módulo possui muitos endpoints separados por domínio:

```text
/api/inventory/items
/api/inventory/entries
/api/inventory/exits
/api/inventory/transfers
/api/inventory/patrimony
/api/inventory/inventory-sessions
/api/inventory/reports
/api/inventory/access-log
...
```

Esses contratos não deveriam existir apenas dentro dos ficheiros JavaScript.

Crie um `docs/developer/api/openapi.yaml` contendo:

* método e caminho;
* autenticação;
* permissão necessária;
* parâmetros;
* corpo da requisição;
* resposta de sucesso;
* códigos de erro;
* exemplos;
* regras de idempotência;
* paginação e filtros;
* indicação de operação atómica;
* possíveis respostas `409`.

OpenAPI é um padrão independente de linguagem para descrever APIs HTTP, permitindo que pessoas e ferramentas compreendam o serviço sem precisar analisar diretamente o código-fonte. ([OpenAPI Initiative Publications][4])

## 7. Registrar decisões arquiteturais

O changelog informa o que mudou, mas não necessariamente por que uma solução foi escolhida.

Para isso, crie ADRs — Architecture Decision Records.

Exemplos relevantes para este projeto:

```text
ADR-0001 — Utilizar Supabase como banco e autenticação
ADR-0002 — Separar Consumo e Património por macro_category
ADR-0003 — Utilizar movimentos imutáveis para auditoria
ADR-0004 — Implementar FEFO para consumo por lote
ADR-0005 — Executar transferências em transação atómica
ADR-0006 — Controlar património por unidade e número de série
ADR-0007 — Manter frontend em JavaScript sem framework
ADR-0008 — Utilizar QR permanente por lote ou série
```

Cada ADR deve conter:

```text
Título
Status: proposto | aceite | substituído | depreciado
Contexto
Problema
Alternativas consideradas
Decisão
Consequências positivas
Consequências negativas
Referências
```

Um ADR registra uma decisão arquitetural individual, sua justificativa, alternativas e consequências. O conjunto dos ADRs forma o histórico decisório do sistema. ([Architectural Decision Records][5])

## 8. Estrutura da documentação do utilizador

A navegação atual do sistema já fornece praticamente o índice do manual operacional:

* Dashboard;
* Itens;
* Consumo: Entrada e Saída;
* Património: Entrada, Movimentação e Saída;
* Transferências;
* Ajustes;
* Inventário Físico;
* Depreciação;
* Relatórios;
* Kardex;
* Histórico;
* Log de Acesso;
* QR Code;
* Cadastros auxiliares.

Cada página operacional deve usar um formato padronizado.

```text
# Como registrar uma saída de consumo

## Objetivo
Explicar quando e como registrar o consumo de materiais.

## Quem pode executar
Perfis e permissões necessárias.

## Antes de começar
Cadastros e informações que precisam existir.

## Passo a passo
1. Acesse...
2. Escolha...
3. Informe...
4. Confirme...

## Resultado esperado
O que será alterado no estoque e no histórico.

## Atenção
Consequências, operações irreversíveis e validações.

## Erros comuns
Mensagem apresentada, causa provável e solução.

## Como corrigir
Ajuste, estorno ou procedimento autorizado.

## Auditoria
Onde consultar quem fez a operação e quando.

## Tarefas relacionadas
Links para entradas, transferências e Kardex.

## Controle
Versão do sistema: 1.18+
Última validação: AAAA-MM-DD
Responsável: equipa/setor
```

## 9. Regras específicas para o manual operacional

### Documentar por tarefa, não por botão

Melhor:

> Como transferir um material para outra unidade

Pior:

> Tela de Transferências

### Explicar consequências

Por exemplo:

* uma saída reduz o estoque;
* uma transferência gera movimentos de origem e destino;
* uma baixa patrimonial impede nova movimentação;
* um ajuste deve ser utilizado apenas para correção;
* uma depreciação altera o valor contabilístico;
* uma sessão de inventário físico pode produzir ajustes.

### Mostrar o resultado esperado

Depois de cada procedimento, informar exatamente onde o utilizador poderá verificar o resultado.

### Usar capturas de tela anotadas

Evitar imagens sem contexto. Cada imagem deve destacar:

* campo;
* botão;
* filtro;
* aviso;
* resultado.

As capturas devem informar a versão em que foram verificadas, porque a interface muda.

### Manter consistência linguística

O módulo está identificado como `pt-PT`. Portanto, o manual deve manter a terminologia utilizada pela interface, por exemplo “stock”, “localização”, “património” e “registo”, sem alternar aleatoriamente entre português brasileiro e português europeu.

## 10. Documentação como parte do desenvolvimento

A documentação deve seguir o mesmo fluxo do código:

1. o programador altera o sistema;
2. atualiza testes;
3. atualiza documentação técnica;
4. atualiza manual do utilizador, quando houver impacto operacional;
5. atualiza OpenAPI, se houver alteração de endpoint;
6. inclui migração e rollback, quando aplicável;
7. atualiza changelog;
8. abre o pull request.

Crie um template de pull request contendo:

```text
## O que mudou?

## Por que mudou?

## Como foi testado?

## Impacto no banco de dados
- [ ] Não possui
- [ ] Requer migração
- [ ] Possui rollback

## Impacto na API
- [ ] Não possui
- [ ] OpenAPI atualizado

## Impacto no utilizador
- [ ] Não possui
- [ ] Manual atualizado
- [ ] Capturas de tela atualizadas

## Segurança e permissões

## Checklist
- [ ] Testes executados
- [ ] Documentação atualizada
- [ ] Changelog atualizado
```

Templates de PR, guidelines, responsáveis e verificações automatizadas ajudam a padronizar contribuições e tornam a revisão mais previsível. ([GitHub Docs][6])

## 11. Fonte única da documentação

Para o documento de Património, não mantenha:

```text
documentacao/INVENTARIO_PATRIMONIO.md
```

e uma segunda cópia dentro de:

```text
public/inventory/docs-patrimonio.html
```

Use apenas um Markdown como fonte e:

* gere a página HTML durante o build; ou
* carregue o Markdown pela aplicação; ou
* publique o mesmo conteúdo num site interno de documentação.

A regra deve ser:

> Um conteúdo, uma fonte canónica, múltiplas formas de apresentação.

## 12. Prioridades recomendadas

### Prioridade 1 — reorganização

* criar `docs/user` e `docs/developer`;
* transformar o índice numa navegação curta;
* mover documentos históricos para arquivo;
* eliminar documentos duplicados;
* indicar claramente quais documentos são fontes canónicas.

### Prioridade 2 — documentação técnica essencial

Criar primeiro:

1. configuração local;
2. visão arquitetural;
3. modelo de domínio;
4. autenticação e permissões;
5. estrutura do banco;
6. migrações;
7. referência da API;
8. deployment;
9. troubleshooting;
10. estratégia de testes.

### Prioridade 3 — manual operacional

Começar pelas tarefas mais frequentes:

1. cadastrar item;
2. registrar entrada;
3. registrar saída;
4. realizar transferência;
5. cadastrar e movimentar património;
6. executar inventário físico;
7. utilizar QR Code;
8. consultar histórico e Kardex;
9. emitir relatórios;
10. corrigir erros comuns.

### Prioridade 4 — governança

* documentação obrigatória nos PRs;
* validação automática de links;
* lint de Markdown;
* validação do OpenAPI;
* responsável documental por módulo;
* revisão periódica;
* campo “última versão validada”;
* criação de testes automatizados reais.

A melhor estrutura para este projeto não é aumentar o número de documentos. É reduzir duplicidades, separar públicos, definir fontes canónicas e permitir que qualquer pessoa chegue à resposta correta em poucos cliques.

[1]: https://diataxis.fr/?utm_source=chatgpt.com "Diátaxis"
[2]: https://c4model.com/diagrams?utm_source=chatgpt.com "Diagrams | C4 model"
[3]: https://c4model.com/diagrams/notation?utm_source=chatgpt.com "Notation | C4 model"
[4]: https://spec.openapis.org/oas/v3.0.4.html?utm_source=chatgpt.com "OpenAPI Specification v3.0.4"
[5]: https://adr.github.io/?utm_source=chatgpt.com "Architectural Decision Records (ADRs) | Architectural Decision Records"
[6]: https://docs.github.com/en/pull-requests/reference/managing-and-standardizing-pull-requests?utm_source=chatgpt.com "Managing and standardizing pull requests - GitHub Docs"
