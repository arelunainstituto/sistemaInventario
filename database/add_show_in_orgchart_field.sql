-- Adicionar campo show_in_orgchart na tabela rh_employees
-- Este campo controla se o funcionário aparece no organograma

ALTER TABLE rh_employees
ADD COLUMN IF NOT EXISTS show_in_orgchart BOOLEAN DEFAULT true;

-- Comentário na coluna
COMMENT ON COLUMN rh_employees.show_in_orgchart IS 'Controla se o funcionário aparece no organograma (true = aparece, false = oculto)';

-- Atualizar todos os funcionários existentes para aparecer no organograma por padrão
UPDATE rh_employees
SET show_in_orgchart = true
WHERE show_in_orgchart IS NULL;

-- Verificar a alteração
SELECT 
    id,
    name,
    role,
    department,
    show_in_orgchart,
    status
FROM rh_employees
ORDER BY name
LIMIT 10;
