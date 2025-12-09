-- Script de Diagnóstico de Permissões RH

-- 1. Listar todas as permissões do módulo RH existentes no banco
SELECT id, name, module_name, action 
FROM permissions 
WHERE module_name ILIKE 'hr' OR name ILIKE 'hr:%' OR name ILIKE 'HR:%';

-- 2. Listar permissões atribuídas à role Admin
SELECT 
    r.name as role_name,
    p.name as permission_name,
    p.module_name
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'Admin' 
AND (p.module_name ILIKE 'hr' OR p.name ILIKE 'hr:%' OR p.name ILIKE 'HR:%');

-- 3. Verificar se o usuário Admin tem a role Admin
SELECT 
    u.email,
    r.name as role_name
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
JOIN auth.users u ON u.id = ur.user_id
WHERE r.name = 'Admin';
