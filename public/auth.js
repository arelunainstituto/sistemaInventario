/**
 * Sistema de Autenticação
 * Grupo AreLuna - Sistema de Inventário
 */

/**
 * Classe para gerenciar autenticação
 */
class AuthManager {
    constructor() {
        // Usar APENAS um cliente Supabase com as configurações globais
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        this.currentUser = null;
        this.session = null;
        this.isAuthenticated = false;
        this.onAuthStateChange = null;

        // Promise que resolve quando a inicialização estiver completa
        this.ready = this.init();
    }

    /**
     * Inicializa o sistema de autenticação
     */
    async init() {
        try {
            // Verificar sessão atual
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error) {
                console.error('Erro ao verificar sessão:', error);
                return;
            }

            if (session) {
                this.setSession(session);
            }

            // Escutar mudanças de autenticação
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed:', event, session);

                if (event === 'SIGNED_IN' && session) {
                    this.setSession(session);
                } else if (event === 'SIGNED_OUT') {
                    this.clearSession();
                }
            });

        } catch (error) {
            console.error('Erro ao inicializar autenticação:', error);
        }
    }

    /**
     * Define a sessão do usuário
     */
    setSession(session) {
        this.session = session;
        this.currentUser = session.user;
        this.isAuthenticated = true;

        // Armazenar informações do usuário E TOKEN
        localStorage.setItem('user', JSON.stringify(this.currentUser));
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('access_token', session.access_token); // ✅ Armazenar token

        console.log('Usuário autenticado:', this.currentUser.email);
        console.log('✅ Token armazenado no localStorage');
    }

    /**
     * Limpa a sessão do usuário
     */
    clearSession() {
        this.session = null;
        this.currentUser = null;
        this.isAuthenticated = false;

        // Limpar localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('access_token'); // ✅ Limpar token também
        localStorage.removeItem('rememberMe');

        console.log('Sessão limpa');
    }

    /**
     * Fazer login
     */
    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            return { success: true, data };

        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fazer logout
     */
    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();

            if (error) {
                throw error;
            }

            this.clearSession();

            // Redirecionar para login
            window.location.href = 'login.html';

            return { success: true };

        } catch (error) {
            console.error('Erro no logout:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Alterar senha do usuário
     */
    async changePassword(currentPassword, newPassword) {
        try {
            // Verificar se o usuário está autenticado
            if (!this.isUserAuthenticated()) {
                throw new Error('Usuário não autenticado');
            }

            // Primeiro, verificar se a senha atual está correta
            // fazendo um novo login com as credenciais atuais
            const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
                email: this.currentUser.email,
                password: currentPassword
            });

            if (signInError) {
                throw new Error('Senha atual incorreta');
            }

            // Se o login foi bem-sucedido, alterar a senha
            const { data, error } = await this.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                throw error;
            }

            return { success: true, data };

        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            throw error;
        }
    }

    /**
     * Verificar se o usuário está autenticado
     */
    isUserAuthenticated() {
        return this.isAuthenticated && this.session && this.currentUser;
    }

    /**
     * Obter usuário atual
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Obter sessão atual
     */
    getCurrentSession() {
        return this.session;
    }

    /**
     * Proteger página (redirecionar para login se não autenticado)
     */
    requireAuth() {
        if (!this.isUserAuthenticated()) {
            console.log('Usuário não autenticado, redirecionando para login');
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /**
     * Redirecionar usuário autenticado (para dashboard)
     */
    redirectIfAuthenticated() {
        if (this.isUserAuthenticated()) {
            console.log('Usuário já autenticado, redirecionando para dashboard');
            window.location.href = 'dashboard.html';
            return true;
        }
        return false;
    }

    /**
     * Obter token de acesso
     */
    getAccessToken() {
        return this.session?.access_token || null;
    }

    /**
     * Verificar se o token está válido
     */
    isTokenValid() {
        if (!this.session) return false;

        const now = Math.floor(Date.now() / 1000);
        return this.session.expires_at > now;
    }

    /**
     * Renovar token se necessário
     */
    async refreshTokenIfNeeded() {
        if (!this.session || this.isTokenValid()) {
            return true;
        }

        try {
            const { data, error } = await this.supabase.auth.refreshSession();

            if (error) {
                throw error;
            }

            if (data.session) {
                this.setSession(data.session);
                return true;
            }

            return false;

        } catch (error) {
            console.error('Erro ao renovar token:', error);
            this.signOut();
            return false;
        }
    }

    /**
     * Verificar se o usuário tem uma permissão específica
     */
    async hasPermission(permissionName) {
        try {
            if (!this.isUserAuthenticated()) {
                return false;
            }

            const { data, error } = await this.supabase
                .from('user_roles')
                .select(`
                    roles!inner(
                        name,
                        role_permissions!inner(
                            permissions!inner(
                                name
                            )
                        )
                    )
                `)
                .eq('user_id', this.currentUser.id)
                .eq('is_active', true);

            if (error) {
                console.error('Erro ao verificar permissões:', error);
                return false;
            }

            // Verificar se o usuário tem a permissão específica ou é admin
            for (const userRole of data) {
                const role = userRole.roles;

                // Admin tem acesso total
                if (role.name === 'admin') {
                    return true;
                }

                // Verificar permissões específicas
                for (const rolePermission of role.role_permissions) {
                    if (rolePermission.permissions.name === permissionName) {
                        return true;
                    }
                }
            }

            return false;

        } catch (error) {
            console.error('Erro ao verificar permissão:', error);
            return false;
        }
    }

    /**
     * Verificar se o usuário tem um role específico
     */
    async hasRole(roleName) {
        try {
            if (!this.isUserAuthenticated()) {
                return false;
            }

            const { data, error } = await this.supabase
                .from('user_roles')
                .select(`
                    roles!inner(name)
                `)
                .eq('user_id', this.currentUser.id)
                .eq('is_active', true)
                .eq('roles.name', roleName);

            if (error) {
                console.error('Erro ao verificar role:', error);
                return false;
            }

            return data && data.length > 0;

        } catch (error) {
            console.error('Erro ao verificar role:', error);
            return false;
        }
    }

    /**
     * Obter todas as permissões do usuário
     */
    async getUserPermissions() {
        try {
            if (!this.isUserAuthenticated()) {
                return [];
            }

            const { data, error } = await this.supabase
                .from('user_roles')
                .select(`
                    roles!inner(
                        name,
                        role_permissions!inner(
                            permissions!inner(
                                name,
                                description,
                                resource,
                                action
                            )
                        )
                    )
                `)
                .eq('user_id', this.currentUser.id)
                .eq('is_active', true);

            if (error) {
                console.error('Erro ao obter permissões:', error);
                return [];
            }

            const permissions = [];
            const permissionSet = new Set(); // Para evitar duplicatas

            for (const userRole of data) {
                const role = userRole.roles;

                for (const rolePermission of role.role_permissions) {
                    const permission = rolePermission.permissions;
                    const permissionKey = permission.name;

                    if (!permissionSet.has(permissionKey)) {
                        permissions.push({
                            name: permission.name,
                            description: permission.description,
                            resource: permission.resource,
                            action: permission.action,
                            role: role.name
                        });
                        permissionSet.add(permissionKey);
                    }
                }
            }

            return permissions;

        } catch (error) {
            console.error('Erro ao obter permissões do usuário:', error);
            return [];
        }
    }

    /**
     * Verificar se o usuário é admin
     */
    async isAdmin() {
        return await this.hasRole('admin');
    }

    /**
     * Verificar permissão e redirecionar se não autorizado
     */
    async requirePermission(permissionName, redirectUrl = 'login.html') {
        const hasPermission = await this.hasPermission(permissionName);

        if (!hasPermission) {
            console.warn(`Acesso negado. Permissão necessária: ${permissionName}`);
            window.location.href = redirectUrl;
            return false;
        }

        return true;
    }

    /**
     * Verificar role e redirecionar se não autorizado
     */
    async requireRole(roleName, redirectUrl = 'login.html') {
        const hasRole = await this.hasRole(roleName);

        if (!hasRole) {
            console.warn(`Acesso negado. Role necessário: ${roleName}`);
            window.location.href = redirectUrl;
            return false;
        }

        return true;
    }

}

/**
 * Instância global do gerenciador de autenticação
 * IMPORTANTE: Deve ser criada ANTES das funções que a utilizam
 */
const authManager = new AuthManager();

/**
 * Funções utilitárias para uso nas páginas
 */


/**
 * Proteger página atual
 */
function requireAuthentication() {
    return authManager.requireAuth();
}

/**
 * Redirecionar se já autenticado
 */
function redirectIfAuthenticated() {
    return authManager.redirectIfAuthenticated();
}

/**
 * Fazer logout
 */
async function logout() {
    const result = await authManager.signOut();
    if (!result.success) {
        console.error('Erro ao fazer logout:', result.error);
        alert('Erro ao fazer logout. Tente novamente.');
    }
}

/**
 * Obter usuário atual
 */
function getCurrentUser() {
    return authManager.getCurrentUser();
}

/**
 * Verificar se está autenticado
 */
function isAuthenticated() {
    return authManager.isUserAuthenticated();
}

/**
 * Obter token de acesso
 */
function getAccessToken() {
    return authManager.getAccessToken();
}

/**
 * Adicionar cabeçalho de autorização às requisições
 */
function getAuthHeaders() {
    const token = getAccessToken();
    return token ? {
        'Authorization': `Bearer ${token}`
    } : {};
}

/**
 * Fazer requisição autenticada
 */
async function authenticatedFetch(url, options = {}) {
    // Renovar token se necessário
    await authManager.refreshTokenIfNeeded();

    const headers = {
        ...getAuthHeaders(),
        ...options.headers
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    return response;
}

/**
 * Mostrar informações do usuário na interface
 */
function displayUserInfo() {
    const user = getCurrentUser();
    if (!user) return;

    // Procurar elementos para mostrar info do usuário
    const userEmailElements = document.querySelectorAll('[data-user-email]');
    const userNameElements = document.querySelectorAll('[data-user-name]');

    userEmailElements.forEach(el => {
        el.textContent = user.email;
    });

    userNameElements.forEach(el => {
        el.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
    });
}

/**
 * Adicionar botão de logout à interface
 */
function addLogoutButton() {
    const logoutButtons = document.querySelectorAll('[data-logout-btn]');

    logoutButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (confirm('Tem certeza que deseja sair?')) {
                await logout();
            }
        });
    });
}

/**
 * Inicialização automática quando o DOM estiver pronto
 */
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para o authManager inicializar
    setTimeout(() => {
        displayUserInfo();
        addLogoutButton();
    }, 100);
});

// Exportar para uso global
window.AuthManager = AuthManager; // Explicitamente exportar a classe
window.authManager = authManager;
window.requireAuthentication = requireAuthentication;
window.redirectIfAuthenticated = redirectIfAuthenticated;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.isAuthenticated = isAuthenticated;
window.getAccessToken = getAccessToken;
window.getAuthHeaders = getAuthHeaders;
window.authenticatedFetch = authenticatedFetch;

console.log('✅ [AUTH] auth.js loaded successfully');