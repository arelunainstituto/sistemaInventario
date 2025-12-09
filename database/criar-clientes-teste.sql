-- =====================================================
-- CRIAR CLIENTES DE TESTE PROSTORAL
-- Execute este SQL no Supabase se não houver clientes
-- =====================================================

-- Verificar se há clientes cadastrados
SELECT COUNT(*) as total_clientes FROM prostoral_clients;

-- Se o resultado for 0, execute os INSERTs abaixo:

-- Cliente 1
INSERT INTO prostoral_clients (
    name,
    email,
    phone,
    address,
    created_at,
    updated_at
)
VALUES (
    'Clínica Dentária Lisboa',
    'clinica@lisboa.pt',
    '+351 21 123 4567',
    'Av. da Liberdade, 123, Lisboa',
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- Cliente 2
INSERT INTO prostoral_clients (
    name,
    email,
    phone,
    address,
    created_at,
    updated_at
)
VALUES (
    'Dr. João Silva',
    'joao.silva@prostoral.pt',
    '+351 91 234 5678',
    'Rua do Comércio, 45, Porto',
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- Cliente 3
INSERT INTO prostoral_clients (
    name,
    email,
    phone,
    address,
    created_at,
    updated_at
)
VALUES (
    'Centro Médico Coimbra',
    'centro@coimbra.pt',
    '+351 23 987 6543',
    'Praça da República, 78, Coimbra',
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- Verificar clientes criados
SELECT 
    id,
    name,
    email,
    phone,
    user_id,
    CASE 
        WHEN user_id IS NOT NULL THEN '✅ Vinculado'
        ELSE '⭕ Disponível'
    END as status,
    created_at
FROM prostoral_clients
ORDER BY created_at DESC;

