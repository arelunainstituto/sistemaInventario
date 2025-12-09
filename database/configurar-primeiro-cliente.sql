-- =====================================================
-- CONFIGURAR PRIMEIRO CLIENTE - Portal do Cliente
-- Data: 23/10/2025
-- =====================================================

-- PASSO 1: Ver usuários disponíveis
-- Execute este SQL primeiro para ver os usuários
SELECT 
    id AS user_id,
    email,
    raw_user_meta_data->>'full_name' AS nome,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- PASSO 2: Ver clientes existentes
-- Execute este SQL para ver os clientes
SELECT 
    id AS client_id,
    name AS nome_cliente,
    email,
    phone,
    user_id,
    created_at
FROM prostoral_clients
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- OPÇÃO A: VINCULAR USUÁRIO A CLIENTE EXISTENTE
-- =====================================================

-- 1. Copie o user_id do usuário (PASSO 1)
-- 2. Copie o client_id do cliente (PASSO 2)
-- 3. Execute o UPDATE abaixo substituindo os valores

/*
UPDATE prostoral_clients
SET user_id = 'COLE_AQUI_O_USER_ID'  -- ID do usuário da tabela auth.users
WHERE id = 'COLE_AQUI_O_CLIENT_ID';   -- ID do cliente que você quer vincular

-- Exemplo real:
-- UPDATE prostoral_clients
-- SET user_id = 'a1b2c3d4-1234-5678-90ab-cdef12345678'
-- WHERE id = 'e5f6g7h8-8765-4321-90ab-ba0987654321';
*/

-- =====================================================
-- OPÇÃO B: CRIAR NOVO CLIENTE JÁ VINCULADO
-- =====================================================

-- 1. Copie o user_id do usuário (PASSO 1)
-- 2. Execute o INSERT abaixo substituindo os valores

/*
INSERT INTO prostoral_clients (
    name,
    email,
    phone,
    address,
    user_id,
    created_at,
    updated_at
)
VALUES (
    'Nome do Cliente Teste',              -- Nome do cliente
    'cliente@email.com',                  -- Email
    '+351 123 456 789',                   -- Telefone (opcional)
    'Rua Exemplo, 123, Lisboa',           -- Endereço (opcional)
    'COLE_AQUI_O_USER_ID',                -- ID do usuário (da tabela auth.users)
    NOW(),
    NOW()
);
*/

-- =====================================================
-- PASSO 3: VERIFICAR SE FUNCIONOU
-- =====================================================

-- Execute este SQL para confirmar o vínculo
SELECT 
    u.id AS user_id,
    u.email AS usuario_email,
    c.id AS client_id,
    c.name AS cliente_nome,
    c.email AS cliente_email,
    c.phone AS cliente_telefone,
    c.user_id AS vinculado_com_user_id,
    CASE 
        WHEN c.user_id IS NOT NULL THEN '✅ VINCULADO'
        ELSE '❌ NÃO VINCULADO'
    END AS status_vinculo
FROM prostoral_clients c
LEFT JOIN auth.users u ON c.user_id = u.id
ORDER BY c.created_at DESC;

-- =====================================================
-- PASSO 4: TESTAR ACESSO
-- =====================================================

-- Depois de executar os passos acima:
-- 1. Faça logout do sistema
-- 2. Faça login com o usuário vinculado ao cliente
-- 3. Acesse: http://localhost:3002/prostoral-clientes.html
-- 4. Você deve ver o dashboard do cliente! 🎉

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================

-- Se ainda aparecer "Acesso negado", verifique:

-- 1. O user_id está correto?
SELECT c.*, u.email 
FROM prostoral_clients c
LEFT JOIN auth.users u ON c.user_id = u.id
WHERE c.user_id IS NOT NULL;

-- 2. O usuário logado é o mesmo vinculado?
-- Execute no console do navegador (F12):
-- const user = await window.authManager.supabase.auth.getUser();
-- console.log('User ID:', user.data.user?.id);

-- 3. O RLS está habilitado?
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('prostoral_work_orders', 'prostoral_clients', 'prostoral_work_order_issues');

-- =====================================================
-- EXEMPLO COMPLETO (SUBSTITUA OS VALORES)
-- =====================================================

/*
-- 1. Criar cliente e vincular ao usuário em um único comando
WITH user_info AS (
    SELECT id FROM auth.users WHERE email = 'seu.email@aqui.com' LIMIT 1
)
INSERT INTO prostoral_clients (
    name,
    email,
    phone,
    address,
    user_id,
    created_at,
    updated_at
)
SELECT
    'João Silva',                    -- Nome
    'joao@email.com',                -- Email
    '+351 912 345 678',              -- Telefone
    'Lisboa, Portugal',              -- Endereço
    id,                              -- user_id do usuário
    NOW(),
    NOW()
FROM user_info;

-- 2. Verificar
SELECT 
    c.name AS cliente,
    c.email AS cliente_email,
    u.email AS usuario_email,
    '✅ Pronto para acessar portal!' AS status
FROM prostoral_clients c
INNER JOIN auth.users u ON c.user_id = u.id
WHERE u.email = 'seu.email@aqui.com';
*/

