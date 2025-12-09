# Configuração do Banco de Dados - Módulo RH

Para que o módulo de Recursos Humanos funcione corretamente, é necessário criar as tabelas e configurar as permissões no banco de dados Supabase.

## Instruções

1. Acesse o painel do seu projeto no [Supabase](https://supabase.com/dashboard).
2. Vá para a seção **SQL Editor** (ícone de terminal na barra lateral).
3. Clique em **New Query**.
4. Copie e cole o conteúdo dos seguintes arquivos, **nesta ordem**:

### 1. Criar Tabelas e RLS
Arquivo: `database/rh-schema.sql`

Este script cria as tabelas necessárias (`rh_absences`, `rh_performance_reviews`, etc.) e configura as políticas de segurança (Row Level Security).

### 2. Configurar Permissões e Roles
Arquivo: `database/rh-permissions.sql`

Este script cria as roles (`rh_manager`, `employee`), define as permissões do módulo e garante que o módulo RH esteja registrado no sistema.

## Verificação

Após executar os scripts, você pode verificar se tudo está correto executando:

```sql
SELECT * FROM modules WHERE code = 'HR';
```

Você deve ver o módulo "Recursos Humanos" listado.

### 3. Atribuir Acesso a um Usuário

Para acessar o módulo, você precisa atribuir a role `rh_manager` ou `Admin` ao seu usuário. Substitua `SEU_EMAIL_AQUI` pelo email do usuário:

```sql
-- 1. Encontrar o ID do usuário
DO $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'SEU_EMAIL_AQUI';
    SELECT id INTO v_role_id FROM roles WHERE name = 'rh_manager';

    IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
        -- 2. Atribuir a role
        INSERT INTO user_roles (user_id, role_id, is_active)
        VALUES (v_user_id, v_role_id, true)
        ON CONFLICT (user_id, role_id) DO NOTHING;
        
        RAISE NOTICE 'Role atribuída com sucesso para %', v_user_id;
    ELSE
        RAISE NOTICE 'Usuário ou Role não encontrados';
    END IF;
END $$;
```
