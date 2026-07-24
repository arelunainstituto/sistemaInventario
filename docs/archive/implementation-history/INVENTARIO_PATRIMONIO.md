# Inventário · Módulo Patrimônio

Como funciona o controle de **itens de patrimônio** (equipamentos duradouros:
notebooks, mobiliário, informática) no sistema de inventário.

> **Resumo:** consumo é controlado por **quantidade/lote**; patrimônio é
> controlado por **unidade individual (número de série)**. Cada bem físico é
> rastreado um a um — onde está, com quem está, quanto vale e em que estado.

---

## 1. Conceito central: Produto (modelo) × Unidade (número de série)

- **Produto / item** = o *modelo* (ex.: "Macbook Air v2025"). É cadastrado em
  **Itens** com `Tipo de cadastro = Patrimônio`, sua **Categoria > Subcategoria**
  (ex.: MacBooks > Macbook Air) e a **taxa de depreciação anual** do modelo.
- **Unidade** = cada *exemplar físico*, identificado pelo **número de série**
  (ex.: `31346546-22`). Um mesmo produto tem N unidades, cada uma com:
  - localização atual e colaborador responsável (opcional);
  - valor e data de aquisição **próprios**;
  - valor contábil (depreciação) **próprio**;
  - estado: `em uso`, `inativo` ou `baixado`.

A tabela no banco que guarda as unidades é a **`inv_serial_units`**.

---

## 2. Onde fica na interface

Na barra lateral, as operações são separadas em dois "módulos" por tipo:

```
Consumo
  › Entrada        (recepção com documento fiscal, por quantidade/lote)
  › Saída          (consumo de stock)
Patrimônio
  › Entrada        (aquisição: cadastra unidades por número de série)
  › Movimentação   (reatribui origem → destino: localização e/ou colaborador)
  › Saída          (baixa de uma unidade com motivo)
Depreciação        (execução anual — corre por unidade)
```

Cada tela de Patrimônio tem o **mesmo layout** da equivalente de Consumo
(lista de registos + botão "Novo…" que abre um modal). O que muda é só a lógica.

> **Importante (segurança):** a separação por tela é só conveniência. A regra
> real é no servidor: cada endpoint valida o `macro_category` do item. Itens de
> patrimônio são **rejeitados** nas telas de consumo (entrada/saída/transferência)
> e vice-versa — mudar a URL ou o pedido não contorna isso.

---

## 3. Ciclo de vida de uma unidade

### 3.1 Entrada (aquisição) — `Patrimônio › Entrada`
Escolhe-se o **produto patrimonial**, a **localização inicial** (e, opcional, o
**colaborador** e o **fornecedor**), e cadastram-se **uma ou mais unidades**,
cada uma com seu **número de série**, **data** e **valor de aquisição**.

- Cria uma linha em `inv_serial_units` por número de série.
- O **valor contábil** (`book_value`) começa igual ao valor de aquisição.
- Registra um movimento `entrada` por unidade (trilha de auditoria).
- Número de série é **único por produto** — não dá para repetir o mesmo NS no
  mesmo modelo.

### 3.2 Movimentação — `Patrimônio › Movimentação`
Reatribui uma unidade de uma **origem** (localização/colaborador atuais) para um
**destino** (nova localização **e/ou** novo colaborador).

- Exemplo: `Dep. de Tecnologia` → `Dep. de Vendas` com o colaborador *Felipe*;
  ou `Home Office` com o colaborador *Igor*.
- Atualiza `current_location_id` / `current_holder_id` da unidade e grava um
  movimento (`transferencia_saida`, subtype `movimentacao_patrimonial`) com
  origem e destino (local + colaborador).
- Unidades **baixadas** não podem ser movimentadas.

### 3.3 Saída / baixa — `Patrimônio › Saída`
Dá **baixa** de uma unidade, com um **motivo** obrigatório
(ex.: "Queima do CPU. Fora da Garantia").

- Marca a unidade como `baixado`, grava `write_off_reason` e `write_off_date`.
- Registra um movimento `saida` (subtype `baixa`).
- A unidade some das telas de Movimentação e Saída.

### 3.4 Depreciação — `Depreciação`
Execução **anual** (uma vez por ano; também automática em 1/jan às 04h00).
Corre **por unidade**:

- A **taxa** vem do item (modelo); o **valor/data de aquisição** e o **valor
  contábil** vêm da unidade.
- Cálculo *pro rata* no ano de aquisição (proporcional aos meses restantes) e
  cheio nos anos seguintes.
- Reduz o `book_value` da unidade. Quando chega a **zero**, a unidade é
  **baixada** automaticamente (aparece também no histórico de Baixas).
- Grava um movimento `depreciacao` por unidade.

---

## 4. Diferenças em relação ao Consumo

| Aspecto | Consumo | Patrimônio |
|---|---|---|
| Unidade de controle | quantidade / lote | **unidade individual (nº de série)** |
| "Stock" | `inv_stock` (qtd por local/lote) | `inv_serial_units` (1 linha por unidade) |
| Cadastro do item | mín/máx, lead time, fator de conversão | **só taxa de depreciação** (sem mín/máx/lead/conversão) |
| Aquisição | documento fiscal + linhas | **por unidade** (NS, data, valor) |
| Destino de movimento | localização | localização **e/ou colaborador** |
| Saída | consumo de stock | **baixa com motivo** |
| Depreciação | — | **por unidade** (book_value) |

Por isso, na **ficha do item** patrimonial: o painel "Stock por localização" dá
lugar a **"Unidades (números de série)"** (NS, localização, colaborador, valor de
aquisição, **valor contábil**, estado), e o Kardex de stock **não se aplica** a
patrimônio (use o histórico de unidades / movimentos).

---

## 5. Modelo de dados (resumo)

**`inv_serial_units`** — a unidade física:
`item_id` (→ produto), `serial_number`, `acquisition_date`, `acquisition_value`,
`book_value` (valor contábil), `supplier_id`, `current_location_id` (→ localização),
`current_holder_id` (→ `rh_employees`, o colaborador), `status`
(`em_uso`/`inativo`/`baixado`), `write_off_reason`, `write_off_date`.

**`inv_movements`** — trilha de auditoria (imutável). Para patrimônio, ganhou
`serial_unit_id`, `from_employee_id` e `to_employee_id`. Tipos/subtipos usados:
`entrada`/`aquisicao_patrimonial`, `transferencia_saida`/`movimentacao_patrimonial`,
`saida`/`baixa`, `depreciacao`/`anual` (ou `baixa` na depreciação total).

**Colaboradores**: vêm do módulo **RH** (`rh_employees`), via endpoint
`GET /api/inventory/employees` (lista enxuta, sob permissão de inventário).

**Localizações**: `inv_units` (unidade/instalação) → `inv_locations` (sala/zona),
exibidas como `Unidade · Localização`.

---

## 6. Regras importantes

- **NS único por produto** (`UNIQUE(item_id, serial_number)`).
- **Unidade baixada** não pode ser movimentada nem baixada de novo.
- **Concorrência**: movimentação e baixa têm guarda otimista — se a unidade já
  foi alterada por outra operação, a segunda recebe erro (409) em vez de gravar
  um registro defasado.
- **Fronteira de macro no servidor**: consumo e patrimônio não se misturam nos
  endpoints (validação por `macro_category` / `serial_unit_id`).

---

## 7. Migrações de banco (aplicar em ordem, no Supabase)

O módulo de patrimônio depende de duas migrações manuais:

1. **`database/inventory-refactor/110-patrimonio-serie.sql`**
   — cria `inv_serial_units` e adiciona `serial_unit_id`/`from_employee_id`/
   `to_employee_id` a `inv_movements`.
2. **`database/inventory-refactor/111-patrimonio-depreciacao-unidade.sql`**
   — adiciona `book_value` à unidade e reescreve `fn_inv_run_depreciation` para
   correr por unidade.

> Sem aplicar as duas, as telas e endpoints de patrimônio (e o histórico de
> Saídas de consumo, que passou a filtrar `serial_unit_id`) não funcionam.

---

## 8. Roteiro de teste ponta a ponta

1. Aplicar as migrações 110 e 111.
2. Em **Itens**, criar um produto `Patrimônio` (categoria/subcategoria + taxa).
3. **Patrimônio › Entrada**: cadastrar 2–3 unidades (NS, data, valor).
4. **Patrimônio › Movimentação**: mover uma unidade para outra localização +
   colaborador. Conferir origem/destino no histórico.
5. **Patrimônio › Saída**: dar baixa de uma unidade com motivo.
6. **Depreciação**: rodar um ano e conferir a redução do valor contábil das
   unidades (e baixa automática se zerar) na ficha do item.
