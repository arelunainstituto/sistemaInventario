# 🧪 Guia de Teste - Sistema de Intercorrências

## 📋 Checklist de Testes

### Passo 1: Aplicar SQL no Supabase ✅

1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Cole e execute o conteúdo do arquivo: `database/work-orders-rls.sql`
4. Ou execute apenas a seção 4 (linhas 143-183)

---

### Passo 2: Teste com Usuário Comum

#### 2.1 Criar Intercorrência
- [ ] Login com usuário **não-admin**
- [ ] Acesse módulo Prostoral
- [ ] Abra uma ordem de serviço (clique no ícone 👁️)
- [ ] Na seção "Intercorrências", clique em **"Nova Intercorrência"**
- [ ] Preencha o formulário:
  - Tipo: Técnico
  - Gravidade: Média
  - Título: "Teste de intercorrência"
  - Descrição: "Esta é uma intercorrência de teste"
- [ ] Clique em **"Salvar Intercorrência"**
- [ ] Verifique que aparece mensagem de sucesso
- [ ] Verifique que a intercorrência aparece na lista

#### 2.2 Verificar Visibilidade
- [ ] Ainda logado como usuário comum
- [ ] Acesse **outra** ordem de serviço
- [ ] Clique em "Nova Intercorrência"
- [ ] Crie outra intercorrência nesta OS
- [ ] Volte para a primeira OS
- [ ] ✅ **IMPORTANTE**: Verifique que você vê **APENAS a intercorrência que VOCÊ criou**
- [ ] Não deve aparecer intercorrências criadas por outros usuários

#### 2.3 Verificar Histórico/Timeline ✅ NOVO
- [ ] Ainda logado como usuário comum
- [ ] Na mesma OS, role até a seção **"Histórico de Alterações"**
- [ ] ✅ **IMPORTANTE**: Verifique que aparece **APENAS a entrada de histórico da sua intercorrência**
- [ ] Deve aparecer algo como: "Intercorrência reportada: [título] [gravidade]"
- [ ] Não deve aparecer entradas de intercorrências criadas por outros usuários
- [ ] Outras entradas do histórico (status, materiais, etc) devem aparecer normalmente

---

### Passo 3: Teste com Admin

#### 3.1 Ver Todas as Intercorrências
- [ ] Faça logout do usuário comum
- [ ] Login com usuário **admin**
- [ ] Acesse módulo Prostoral
- [ ] Abra a mesma ordem de serviço do teste anterior
- [ ] ✅ **IMPORTANTE**: Verifique que você vê **TODAS as intercorrências** (não apenas as suas)
- [ ] Deve aparecer as intercorrências criadas pelo usuário comum

#### 3.2 Ver Todo o Histórico ✅ NOVO
- [ ] Ainda como admin, na mesma OS
- [ ] Role até a seção **"Histórico de Alterações"**
- [ ] ✅ **IMPORTANTE**: Verifique que aparecem **TODAS as entradas de intercorrências** no histórico
- [ ] Deve aparecer entradas das intercorrências criadas pelo usuário comum
- [ ] Deve aparecer suas próprias intercorrências (se criou alguma)

#### 3.3 Criar como Admin
- [ ] Ainda como admin, crie uma nova intercorrência
- [ ] Verifique que ela aparece na lista
- [ ] Verifique que aparece no histórico

---

### Passo 4: Teste de Permissões do Dashboard

#### 4.1 Criar Usuário com Acesso Limitado
- [ ] Como admin, acesse "Configurações" → "Gerenciar Usuários"
- [ ] Clique em "Novo Usuário"
- [ ] Preencha os dados:
  - Nome: "Teste Limitado"
  - Email: "teste.limitado@example.com"
  - Senha: "teste123"
  - Marque **apenas** o módulo "Inventário"
  - **NÃO** marque como Admin
- [ ] Salve o usuário

#### 4.2 Testar Acesso Limitado
- [ ] Faça logout do admin
- [ ] Login com "teste.limitado@example.com"
- [ ] Verifique o Dashboard
- [ ] ✅ **IMPORTANTE**: Deve aparecer **APENAS** o card do módulo "Inventário"
- [ ] Não deve aparecer Prostoral, Laboratório, etc.

#### 4.3 Testar Bloqueio de Acesso Direto
- [ ] Ainda logado como usuário limitado
- [ ] Tente acessar diretamente: `https://seu-dominio/prostoral.html`
- [ ] Deve ser bloqueado ou mostrar erro
- [ ] O sistema não deve carregar os dados

---

### Passo 5: Teste de Criação de Admin

#### 5.1 Criar Admin com Acesso Total
- [ ] Faça logout
- [ ] Login como admin original
- [ ] Vá em "Gerenciar Usuários"
- [ ] Crie novo usuário:
  - Nome: "Admin Teste"
  - Email: "admin.teste@example.com"
  - Senha: "admin123"
  - Marque **"Administrador (Acesso Total)"**
- [ ] Salve

#### 5.2 Verificar Acesso Total
- [ ] Faça logout
- [ ] Login com "admin.teste@example.com"
- [ ] Verifique o Dashboard
- [ ] ✅ Deve aparecer **TODOS** os módulos
- [ ] Entre no Prostoral
- [ ] Abra uma OS
- [ ] ✅ Deve ver **TODAS** as intercorrências (de todos os usuários)

---

## ✅ Resultados Esperados

| Cenário | Usuário Comum | Admin |
|---------|---------------|-------|
| Ver próprias intercorrências | ✅ Sim | ✅ Sim |
| Ver intercorrências de outros | ❌ Não | ✅ Sim |
| Ver histórico de próprias intercorrências | ✅ Sim | ✅ Sim |
| Ver histórico de intercorrências de outros | ❌ Não | ✅ Sim |
| Criar intercorrências | ✅ Sim | ✅ Sim |
| Acessar módulos liberados | ✅ Sim | ✅ Todos |
| Acessar módulos bloqueados | ❌ Não | ✅ Todos |
| Gerenciar usuários | ❌ Não | ✅ Sim |

---

## 🐛 Problemas Comuns

### Erro: "Não consegue criar intercorrência"
**Solução**: Verifique se as políticas RLS foram aplicadas corretamente no Supabase.

### Erro: "Vê intercorrências de outros usuários"
**Solução**: Verifique se o usuário realmente não é admin. Confirme na tabela `user_roles`.

### Erro: "Dashboard não mostra módulos"
**Solução**: Verifique se o usuário tem permissões atribuídas na criação.

### Erro: "Pode acessar módulos bloqueados"
**Solução**: Verifique se os endpoints estão protegidos com `requireModuleAccess` ou `requirePermission`.

---

## 📞 Suporte

Se encontrar algum problema:

1. Verifique os logs do navegador (F12 → Console)
2. Verifique os logs do servidor Node.js
3. Verifique as políticas RLS no Supabase
4. Verifique se o SQL foi executado corretamente

---

**Boa sorte nos testes! 🎉**

