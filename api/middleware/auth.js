const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Debug logger — silencioso em produção para evitar vazar PII (user id, email,
// permissões, perfis) nos logs do servidor. Erros continuam via console.error.
const log = process.env.NODE_ENV === 'production' ? () => {} : console.log;

/**
 * Middleware para verificar autenticação JWT
 */
async function authenticateToken(req, res, next) {
    try {
        log('🔍 [AUTH] Starting authentication...');
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            log('❌ [AUTH] No token provided');
            return res.status(401).json({ error: 'Token de acesso requerido' });
        }

        log('🔑 [AUTH] Token found, verifying with Supabase...');
        // Verificar o token JWT com Supabase
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            log('❌ [AUTH] Token verification failed:', error);
            return res.status(403).json({ error: 'Token inválido' });
        }

        log('✅ [AUTH] Token verified for user:', user.id, user.email);

        // Buscar perfil do usuário
        log('👤 [AUTH] Looking up user profile...');
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();

        log('👤 [AUTH] Profile lookup result:', { profileError, hasProfile: !!userProfile, profileData: userProfile });

        if (profileError || !userProfile) {
            log('❌ [AUTH] Profile not found or error:', profileError);
            return res.status(403).json({ error: 'Perfil de usuário não encontrado' });
        }

        log('✅ [AUTH] Profile found, continuing to role lookup...');

        log('✅ [AUTH] Profile found, continuing to role lookup...');

        // Buscar roles do usuário
        log('👥 [AUTH] Looking up user roles...');
        let finalUserRoles = [];

        try {
            // Primeiro, vamos testar uma query simples
            const { data: userRoles, error: rolesError } = await supabaseAdmin
                .from('user_roles')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true);

            log('👥 [AUTH] Simple user roles lookup result:', { rolesError, rolesCount: userRoles?.length || 0, userRoles });

            if (rolesError) {
                log('❌ [AUTH] Error loading user roles:', rolesError);
                return res.status(403).json({ error: 'Erro ao carregar permissões do usuário' });
            }

            // Se chegou até aqui, vamos continuar com uma query mais complexa
            log('👥 [AUTH] Now trying complex query with joins...');
            const { data: userRolesWithPermissions, error: complexError } = await supabaseAdmin
                .from('user_roles')
                .select(`
                    *,
                    roles(
                        *,
                        role_permissions(
                            permissions(
                                module_name,
                                action,
                                name
                            )
                        )
                    )
                `)
                .eq('user_id', user.id)
                .eq('is_active', true);

            log('👥 [AUTH] Complex query result:', { complexError, complexCount: userRolesWithPermissions?.length || 0 });

            if (complexError) {
                log('❌ [AUTH] Error in complex query:', complexError);
                return res.status(403).json({ error: 'Erro ao carregar permissões do usuário' });
            }

            // Use the complex result if available, otherwise fall back to simple
            finalUserRoles = userRolesWithPermissions || userRoles;
            log('👥 [AUTH] Using final user roles:', finalUserRoles?.length || 0);

        } catch (roleQueryError) {
            log('💥 [AUTH] Exception during role query:', roleQueryError);
            return res.status(403).json({ error: 'Erro ao carregar permissões do usuário' });
        }

        // Combinar perfil com roles e permissões
        userProfile.user_roles = finalUserRoles || [];
        log('🔗 [AUTH] Combined profile with roles, userRoles count:', finalUserRoles?.length || 0);

        // Estruturar as permissões do usuário
        const userPermissions = new Set();
        const roleNames = [];
        log('🏗️ [AUTH] Starting to structure user permissions...');

        userProfile.user_roles.forEach(userRole => {
            const role = userRole.roles;
            roleNames.push(role.name);
            log('👑 [AUTH] Processing role:', role.name, 'with permissions count:', role.role_permissions?.length || 0);

            role.role_permissions.forEach(rolePermission => {
                const permission = rolePermission.permissions;
                const permissionString = `${permission.module_name}:${permission.action}`;
                userPermissions.add(permissionString);
                log('🔑 [AUTH] Added permission:', permissionString);
            });
        });

        log('📋 [AUTH] Final permissions structure:', {
            roleNames,
            permissionsArray: Array.from(userPermissions)
        });

        // NOVO: Buscar módulos diretos do usuário em user_module_access
        let userModuleCodes = [];
        try {
            const { data: userModuleAccess, error: moduleAccessError } = await supabaseAdmin
                .from('user_module_access')
                .select(`
                    modules (
                        code
                    )
                `)
                .eq('user_id', user.id)
                .eq('is_active', true);

            if (!moduleAccessError && userModuleAccess) {
                userModuleCodes = userModuleAccess
                    .map(uma => uma.modules?.code)
                    .filter(code => code);
                log('📦 [AUTH] User has direct module access:', userModuleCodes);

                // Adicionar permissões genéricas para cada módulo
                userModuleCodes.forEach(moduleCode => {
                    userPermissions.add(`${moduleCode}:read`);
                });
            }
        } catch (moduleError) {
            console.warn('⚠️ [AUTH] Error fetching user module access:', moduleError);
        }

        // Adicionar informações do usuário ao request
        req.user = {
            id: user.id,
            email: user.email,
            profile: userProfile,
            roles: roleNames,
            permissions: Array.from(userPermissions),
            module_codes: userModuleCodes // NOVO: códigos dos módulos com acesso direto
        };

        log('✅ [AUTH] User object created:', {
            id: req.user.id,
            email: req.user.email,
            rolesCount: req.user.roles.length,
            permissionsCount: req.user.permissions.length,
            roles: req.user.roles,
            permissions: req.user.permissions
        });
        log('✅ [AUTH] Calling next() to proceed to next middleware...');

        next();
    } catch (error) {
        log('💥 [AUTH] Unexpected error in authenticateToken:', error);
        log('💥 [AUTH] Error stack:', error.stack);
        console.error('Erro na autenticação:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

/**
 * Middleware para verificar permissões específicas
 * @param {string} module - Nome do módulo (ex: 'inventory', 'laboratory')
 * @param {string} action - Ação requerida (ex: 'view', 'create', 'edit', 'delete')
 */
function requirePermission(module, action) {
    return (req, res, next) => {
        log('🔐 [PERMISSION] ===== PERMISSION CHECK STARTED =====');
        log('🔐 [PERMISSION] Checking permission:', { module, action });
        log('🔐 [PERMISSION] Required permission:', `${module}:${action}`);
        log('🔐 [PERMISSION] User object exists:', !!req.user);
        log('🔐 [PERMISSION] User permissions:', req.user?.permissions || []);
        log('🔐 [PERMISSION] User roles:', req.user?.roles || []);

        if (!req.user) {
            log('❌ [PERMISSION] No user found in request');
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // BYPASS: Admins always have access
        if (req.user.roles && req.user.roles.some(role => role.toLowerCase() === 'admin')) {
            log('✅ [PERMISSION] Admin bypass - Access granted');
            return next();
        }

        const requiredPermission = `${module}:${action}`;
        const hasPermission = req.user.permissions && req.user.permissions.includes(requiredPermission);

        log('🔐 [PERMISSION] Has permission check result:', hasPermission);

        if (hasPermission) {
            log('✅ [PERMISSION] Permission granted - proceeding to next middleware');
            return next();
        } else {
            log('❌ [PERMISSION] Permission denied - returning 403');
            return res.status(403).json({
                error: 'Acesso negado',
                required: requiredPermission,
                userPermissions: req.user.permissions || []
            });
        }
    };
}

/**
 * Middleware para verificar se o usuário tem uma role específica
 * @param {string|string[]} roles - Role(s) requerida(s)
 */
function requireRole(roles) {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        const hasRequiredRole = requiredRoles.some(role => req.user.roles.includes(role));

        if (!hasRequiredRole) {
            return res.status(403).json({
                error: 'Role insuficiente',
                required: requiredRoles,
                user_roles: req.user.roles
            });
        }

        next();
    };
}

/**
 * Middleware para verificar se o usuário é admin
 */
function requireAdmin(req, res, next) {
    return requireRole('admin')(req, res, next);
}

/**
 * Endpoint para obter informações do usuário atual
 */
async function getCurrentUser(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // Buscar módulos disponíveis para o usuário
        const availableModules = new Set();

        // Adicionar módulos das permissions (de roles)
        req.user.permissions.forEach(permission => {
            const [module] = permission.split(':');
            availableModules.add(module);
        });

        // Adicionar módulos diretos (de user_module_access)
        if (req.user.module_codes) {
            req.user.module_codes.forEach(code => {
                availableModules.add(code);
            });
        }

        const userData = {
            id: req.user.id,
            email: req.user.email,
            full_name: req.user.profile.display_name || req.user.profile.first_name || 'Usuário',
            roles: req.user.roles,
            permissions: req.user.permissions,
            available_modules: Array.from(availableModules)
        };

        log('📤 [AUTH] Sending user data:', JSON.stringify(userData, null, 2));

        res.json(userData);
    } catch (error) {
        console.error('Erro ao obter usuário atual:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

/**
 * Middleware para verificar acesso a módulo específico
 */
function requireModuleAccess(moduleCode) {
    return async (req, res, next) => {
        try {
            log(`🔐 [MODULE] Checking access to module: ${moduleCode} for user: ${req.user && req.user.id}`);

            if (!req.user) {
                log('❌ [MODULE] User not authenticated');
                return res.status(401).json({ error: 'Não autenticado' });
            }

            const userId = req.user.id;

            // Verificar se usuário tem acesso ao módulo usando a função SQL
            const { data, error } = await supabaseAdmin.rpc('user_has_module_access', {
                p_user_id: userId,
                p_module_code: moduleCode
            });

            if (error) {
                console.error('❌ [MODULE] Error checking module access:', error);
                return res.status(500).json({ error: 'Erro ao verificar acesso ao módulo' });
            }

            // A RPC pode retornar diferentes formatos (booleano direto ou array), normalizamos aqui
            let hasAccess = false;
            if (typeof data === 'boolean') {
                hasAccess = data;
            } else if (Array.isArray(data) && data.length > 0) {
                const first = data[0];
                // Tenta obter a primeira propriedade booleana disponível
                const values = Object.values(first || {});
                hasAccess = values.some(v => v === true) ? true : !!values[0];
            } else {
                hasAccess = !!data;
            }

            if (!hasAccess) {
                log(`❌ [MODULE] Access denied to module: ${moduleCode}`);
                return res.status(403).json({
                    error: 'Acesso negado',
                    message: 'Você não tem permissão para acessar este módulo'
                });
            }

            log(`✅ [MODULE] Access granted to module: ${moduleCode}`);
            next();
        } catch (error) {
            console.error('❌ [MODULE] Error in requireModuleAccess middleware:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    };
}

module.exports = {
    authenticateToken,
    requirePermission,
    requireRole,
    requireAdmin,
    getCurrentUser,
    requireModuleAccess
};