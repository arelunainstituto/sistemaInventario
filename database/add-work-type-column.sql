-- =====================================================
-- ADICIONAR COLUNA work_type NA TABELA prostoral_work_orders
-- Data: 22/10/2025
-- =====================================================

-- Adicionar coluna work_type como VARCHAR para aceitar texto livre
-- Isso permite que o usuário insira descrições de tipo de trabalho diretamente
ALTER TABLE prostoral_work_orders 
ADD COLUMN IF NOT EXISTS work_type VARCHAR(255);

-- Comentário explicativo
COMMENT ON COLUMN prostoral_work_orders.work_type IS 'Tipo de trabalho (texto livre): ex: Coroa, Prótese, Implante, etc';

-- =====================================================
-- NOTA: A coluna work_type_id (UUID) já existe e aponta para prostoral_work_types
-- Agora temos ambas as opções:
-- - work_type_id: para tipos de trabalho cadastrados na tabela prostoral_work_types
-- - work_type: para descrição livre do tipo de trabalho
-- =====================================================

