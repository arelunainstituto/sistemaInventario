# Perfis e permissões

## Objetivo
Explicar **quem pode fazer o quê** no Inventory. As permissões e perfis **não são geridos dentro do Inventory** — vêm do módulo de **Utilizadores/RH** do ERP. Aqui explicamos o que cada permissão libera.

## De onde vêm as permissões (dependência do RH)
Cada utilizador recebe, no módulo de **RH/Utilizadores**, um conjunto de **permissões do inventário** e, quando aplicável, o perfil **Inventory_Admin**. O Inventory apenas **verifica** essas permissões em cada ação. Os **colaboradores** do património (responsáveis por equipamentos) também vêm do RH.

## Permissões do Inventory
| Permissão | O que libera |
|---|---|
| **read** | Consultar itens, fichas, stock, relatórios, Kardex, histórico |
| **entry** | Registar **entradas** (consumo e aquisição de património) |
| **exit** | Registar **saídas** de consumo e **baixas** de património |
| **transfer** | **Transferências** de consumo e **movimentações** de património |
| **create_item** | Criar itens e cadastros (fornecedores, fabricantes…) |
| **update_item** | Editar itens e cadastros |
| **inventory_session** | Abrir e validar **sessões de inventário físico** |
| **reports** | Aceder aos **relatórios** |
| **financial** | Executar **depreciação** (operações de valor) |

## Perfil Inventory_Admin (e Admin)
Além das permissões acima, o perfil **Inventory_Admin** é exigido para operações sensíveis:
- **Ajustes** de quantidade (a tela é restrita a Admin);
- ajustes **acima de 5%** do saldo ou que deixem o saldo **negativo**;
- **inativar** entradas/movimentos (gera estornos);
- ligar/desligar o **modo seeding** (feito por SQL, por quem administra a base).

## Papéis típicos (exemplos)
| Papel | Permissões sugeridas |
|---|---|
| **Operador de stock** | read, entry, exit, transfer |
| **Responsável de cadastros** | + create_item, update_item |
| **Responsável de inventário** | + inventory_session, reports |
| **Gestão/Património** | + financial |
| **Inventory_Admin** | tudo + ajustes e inativações |

## Atenção
- Se uma ação for recusada com **"Role insuficiente"**, o utilizador não tem a permissão — ajuste o perfil no **módulo de RH/Utilizadores**.
- **Sessão expirada** ("Token inválido") não é falta de permissão — basta refazer login (ou usar **Continuar conectado** no aviso de expiração).

## Tarefas relacionadas
[Primeiros passos](primeiros-passos.md) · [Corrigir quantidades (Ajustes)](ajustes/corrigir-quantidade.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário + RH.
