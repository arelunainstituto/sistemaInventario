-- Atualizar configuração do módulo de RH para permitir acesso via dashboard

-- 1. Atualizar o módulo de RH para não estar em desenvolvimento
UPDATE public.modules
SET 
    in_development = false,
    route = '/hr.html',
    updated_at = NOW()
WHERE code = 'rh' OR name ILIKE '%recursos humanos%' OR name ILIKE '%rh%';

-- 2. Verificar a configuração atual do módulo
SELECT 
    id,
    code,
    name,
    route,
    external_url,
    in_development,
    is_active
FROM public.modules
WHERE code = 'rh' OR name ILIKE '%recursos humanos%' OR name ILIKE '%rh%';
