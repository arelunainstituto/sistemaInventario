# Guia de Verificação - Módulo RH

Este guia ajudará você a validar a implementação do novo Módulo de Recursos Humanos.

## 1. Configuração do Banco de Dados (Crítico)

Antes de iniciar, certifique-se de ter executado os scripts SQL no Supabase:
1.  **Tabelas**: `database/rh-schema.sql`
2.  **Permissões**: `database/rh-permissions.sql`
3.  **Atribuição de Role**: Siga as instruções em `database/README.md` para dar permissão de `rh_manager` ao seu usuário.

## 2. Iniciar o Servidor

Se o servidor não estiver rodando, inicie-o:

```bash
npm run dev
```

## 3. Acessar o Módulo

1.  Abra o navegador em `http://localhost:3000/hr.html` (ou a porta configurada).
2.  **Login**: Se não estiver logado, você será redirecionado para o login. Entre com o usuário que recebeu a permissão.

## 4. Testar Funcionalidades

### Dashboard
- [ ] Verifique se os KPIs (cards no topo) estão carregando (mesmo que zerados).
- [ ] Verifique se o gráfico de departamentos aparece.

### Funcionários
- [ ] Clique na aba "Funcionários".     
- [ ] Clique em "Novo Funcionário".
- [ ] Preencha o formulário e salve.
- [ ] Verifique se o funcionário aparece na lista.
- [ ] Tente editar o funcionário criado.

### Folha de Pagamento
- [ ] Vá para a aba "Folha de Pagamento".
- [ ] Clique em "Processar Folha".
- [ ] Selecione o funcionário criado e preencha os valores.
- [ ] Salve e verifique se aparece na lista como "Rascunho".
- [ ] Tente finalizar a folha (ícone de check).

### Documentos
- [ ] Vá para a aba "Documentos".
- [ ] Selecione o funcionário na lista lateral.
- [ ] Faça upload de um arquivo (ex: PDF ou imagem).
- [ ] Verifique se o documento aparece na lista.

### Férias e Ausências
- [ ] Vá para a aba "Férias e Ausências".
- [ ] Solicite uma nova ausência (ex: Férias).
- [ ] Verifique se aparece na lista com status "Pendente".
- [ ] Como gerente, tente aprovar a solicitação.

### Avaliações
- [ ] Vá para a aba "Avaliações".
- [ ] Crie uma nova avaliação para o funcionário.
- [ ] Verifique se a nota geral é calculada.

## Solução de Problemas

- **Erro 403/Forbidden**: Verifique se seu usuário tem a role `rh_manager` ou `Admin` na tabela `user_roles`.
- **Erro 500**: Verifique os logs do terminal onde o `npm run dev` está rodando.
- **Dados não aparecem**: Verifique se as tabelas foram criadas corretamente no Supabase.
