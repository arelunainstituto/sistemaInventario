# Erros comuns e soluções

Referência rápida das mensagens mais frequentes do Inventory: o que significam e como resolver.

## Stock e saídas
| Mensagem | Significado | Solução |
|---|---|---|
| **"Stock insuficiente (disponível: …, solicitado: …) — RN05"** | Sem stock suficiente e o **modo seeding** está desligado | Reduza a quantidade, dê **entrada** primeiro, ou (Admin) ative o seeding para permitir negativo |
| **"Modo seeding ativo: stock negativo permitido"** (aviso) | Fase de carga inicial: saídas podem deixar o saldo **negativo** | Normal durante a carga; **desligue** o seeding quando terminar (Admin) |
| Saldo **negativo** na ficha/relatório | Movimentado em seeding | Regularize com **entrada** ou **ajuste** |
| Aviso **"abaixo do mínimo"** ao sair | A saída cruza o **stock mínimo** | Confirme se estiver correto; reponha o material |

## Lotes
| Mensagem | Significado | Solução |
|---|---|---|
| **"Item X controla lote — número de lote é obrigatório (RN03)"** | Entrada de item que controla lote, sem lote | Informe o **Lote**; ou desligue o controlo de lote no item |
| **"controla lote (RN03): nenhum lote disponível na localização"** | Saída de item que controla lote, sem lote em stock | Dê **entrada** com lote; em seeding a saída segue sem lote |

## Itens e categorias
| Mensagem | Significado | Solução |
|---|---|---|
| **"A categoria selecionada possui subcategorias — escolha uma categoria folha."** | A categoria escolhida é **pai** | Escolha a subcategoria **final** |
| **"Campo 'cmp' só pode ser alterado por Inventory_Admin…"** | Tentou editar o **custo médio** à mão | O CMP é gerido pelas **entradas** |

## Entradas / documentos
| Mensagem | Significado | Solução |
|---|---|---|
| **"Documento já registado para este fornecedor"** | Nº de documento repetido para o fornecedor | Confira duplicidade; use outro número |
| A entrada falha inteira | Uma linha tem erro (entradas são **atómicas**) | Corrija a linha indicada e registe de novo |
| **"new row … violates check constraint 'inv_items_cmp_check'"** | (Corrigido na 1.17.1) custo médio ia ficar negativo | Aplicar a migração **121**; depois, reenviar a entrada |

## Ajustes / permissões
| Mensagem | Significado | Solução |
|---|---|---|
| **"Ajuste > 5% do stock atual requer perfil Inventory_Admin (RF06)"** | Ajuste grande por não-Admin | Peça a um **Admin** |
| **"Ajuste resultaria em stock negativo — requer Inventory_Admin (RN05)"** | Saldo final negativo | Só Admin (com dupla confirmação) |
| **"Role insuficiente" / "Token inválido"** | Sem permissão ou sessão expirada | Verifique o perfil (RH); refaça login |

## Património
| Mensagem | Significado | Solução |
|---|---|---|
| **"Número(s) de série já cadastrado(s) para este item"** | Série repetida na aquisição | Use outra série ou deixe em branco (auto) |
| A unidade não aparece para movimentar/baixar | Está **baixada**/inativa | Só unidades ativas; verifique o estado |

## Etiqueta QR
| Situação | Significado | Solução |
|---|---|---|
| Etiqueta sai em **3 páginas** | Driver da impressora em **die-cut 62×29 mm** | Trocar para **62 mm contínuo**; margens **Nenhuma**; cabeçalhos/rodapés **off** (ver [Imprimir etiqueta](../qr-code/imprimir-etiqueta.md)) |

## Sessão / login
| Situação | Significado | Solução |
|---|---|---|
| Aviso **"Sua sessão vai expirar"** | Sessão perto de expirar | Clique em **Continuar conectado** para renovar sem perder o trabalho |
| **Enter** não salvou o registo | Comportamento intencional (evita envio acidental) | Use o **botão** Salvar/Registar |

## Tarefas relacionadas
[Registar uma saída](../consumo/registrar-saida.md) · [Corrigir quantidades](../ajustes/corrigir-quantidade.md) · [Glossário](../glossario.md)

> **Controle:** versão do sistema 1.18+ · última validação 2026-07-22 · responsável: equipa de Inventário.
