-- =====================================================
-- CORREÇÃO: Foreign Key de kit_produtos.produto_id
-- =====================================================
-- Data: 2025-11-04
-- Descrição: Corrige a foreign key de kit_produtos.produto_id 
--            para apontar para produtoslaboratorio em vez de 
--            laboratorio_produtos (que não existe)
-- =====================================================

-- 1. Remover a constraint antiga (se existir)
DO $$
BEGIN
    -- Tentar remover constraint antiga se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'kit_produtos_produto_id_fkey'
        AND table_name = 'kit_produtos'
    ) THEN
        ALTER TABLE kit_produtos 
        DROP CONSTRAINT kit_produtos_produto_id_fkey;
    END IF;
    
    -- Tentar remover constraint alternativa se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%kit_produtos%produto_id%'
        AND table_name = 'kit_produtos'
    ) THEN
        ALTER TABLE kit_produtos 
        DROP CONSTRAINT IF EXISTS kit_produtos_produto_id_fkey1;
    END IF;
END $$;

-- 2. Adicionar a constraint correta apontando para produtoslaboratorio
ALTER TABLE kit_produtos 
ADD CONSTRAINT kit_produtos_produto_id_fkey 
FOREIGN KEY (produto_id) 
REFERENCES produtoslaboratorio(id) 
ON DELETE CASCADE;

-- 3. Verificar se a constraint foi criada corretamente
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'kit_produtos'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'produto_id';

COMMENT ON CONSTRAINT kit_produtos_produto_id_fkey ON kit_produtos 
IS 'Foreign key para produtoslaboratorio (produtos do laboratório)';

