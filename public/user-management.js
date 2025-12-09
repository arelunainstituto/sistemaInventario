/**
 * User Management System
 * Gerenciamento de Usuários - Grupo AreLuna
 */

class UserManagement {
    constructor() {
        this.apiBaseUrl = window.CONFIG.API_URL;
        this.currentEditingUserId = null;
        this.users = [];
        this.clientsData = []; // Armazena informação de clientes
        this.init();
    }

    async init() {
        // Wait for auth to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check authentication
        if (!isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        
        // Check admin access
        await this.checkAdminAccess();
        
        // Load current user info
        const user = await getCurrentUser();
        if (user) {
            document.getElementById('userEmail').textContent = user.email;
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load users
        await this.loadUsers();
    }

    async checkAdminAccess() {
        try {
            const token = getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/user`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                const isAdmin = userData.roles?.some(role => role.toLowerCase().includes('admin')) ||
                              userData.permissions?.includes('users:manage') ||
                              userData.permissions?.includes('admin:all');
                
                if (!isAdmin) {
                    alert('Você não tem permissão para acessar esta página.');
                    window.location.href = 'dashboard.html';
                }
            }
        } catch (error) {
            console.error('Error checking admin access:', error);
            window.location.href = 'dashboard.html';
        }
    }

    setupEventListeners() {
        // Logout button
        document.getElementById('logoutButton').addEventListener('click', async () => {
            await signOut();
        });

        // Create user button
        document.getElementById('btnCreateUser').addEventListener('click', () => {
            this.openUserModal();
        });

        // Close modal buttons
        document.getElementById('btnCloseUserModal').addEventListener('click', () => {
            this.closeUserModal();
        });
        document.getElementById('btnCancelUser').addEventListener('click', () => {
            this.closeUserModal();
        });

        // Form submission
        document.getElementById('formUser').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUser();
        });

        // Search and filters
        document.getElementById('searchUsers').addEventListener('input', () => {
            this.filterUsers();
        });
        document.getElementById('filterStatus').addEventListener('change', () => {
            this.filterUsers();
        });

        // Client checkbox toggle
        document.getElementById('isClient').addEventListener('change', (e) => {
            const clientSelectContainer = document.getElementById('clientSelectContainer');
            if (e.target.checked) {
                clientSelectContainer.classList.remove('hidden');
                this.loadClients();
            } else {
                clientSelectContainer.classList.add('hidden');
            }
        });

        // Event delegation for user action buttons
        document.getElementById('usersTableBody').addEventListener('click', (e) => {
            const button = e.target.closest('.user-action-btn');
            if (!button) return;
            
            const action = button.dataset.action;
            const userId = button.dataset.userId;
            
            switch(action) {
                case 'edit':
                    this.editUser(userId);
                    break;
                case 'toggle-status':
                    const currentStatus = button.dataset.userStatus === 'true';
                    this.toggleUserStatus(userId, currentStatus);
                    break;
            }
        });

        // Module checkboxes
        document.querySelectorAll('.module-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const module = e.target.dataset.module;
                const permissions = document.querySelectorAll(`[data-permission^="${module}:"]`);
                
                console.log(`🔄 Checkbox do módulo ${module} ${e.target.checked ? 'MARCADO' : 'DESMARCADO'}`);
                console.log(`   📋 Permissões a atualizar: ${permissions.length}`);
                
                permissions.forEach(perm => {
                    perm.checked = e.target.checked;
                    if (e.target.checked) {
                        console.log(`      ✅ ${perm.dataset.permission}`);
                    }
                });
                
                // Adicionar permissão :manage automaticamente
                const managePermCheckbox = document.querySelector(`[data-permission="${module}:manage"]`);
                if (managePermCheckbox) {
                    managePermCheckbox.checked = e.target.checked;
                    console.log(`   🔑 Permissão :manage ${e.target.checked ? 'MARCADA' : 'DESMARCADA'}`);
                }
            });
        });

        // Admin checkbox
        document.getElementById('isAdmin').addEventListener('change', (e) => {
            if (e.target.checked) {
                // Check all permissions
                document.querySelectorAll('.module-checkbox, .permission-checkbox').forEach(cb => {
                    cb.checked = true;
                    cb.disabled = true;
                });
            } else {
                // Uncheck and enable all
                document.querySelectorAll('.module-checkbox, .permission-checkbox').forEach(cb => {
                    cb.checked = false;
                    cb.disabled = false;
                });
            }
        });

        // Click outside modal to close
        document.getElementById('modalUser').addEventListener('click', (e) => {
            if (e.target.id === 'modalUser') {
                this.closeUserModal();
            }
        });
    }

    async loadUsers() {
        try {
            const token = getAccessToken();
            
            // Carregar usuários
            const usersResponse = await fetch(`${this.apiBaseUrl}/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!usersResponse.ok) throw new Error('Failed to load users');

            const usersData = await usersResponse.json();
            this.users = usersData.users || [];
            
            // Carregar clientes para identificar quem é cliente
            const clientsResponse = await fetch(`${this.apiBaseUrl}/prostoral/clients/all`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (clientsResponse.ok) {
                const clientsData = await clientsResponse.json();
                this.clientsData = clientsData.clients || [];
            }
            
            this.renderUsers(this.users);
        } catch (error) {
            console.error('Error loading users:', error);
            this.showError('Erro ao carregar usuários');
        }
    }

    async loadClients() {
        try {
            const token = getAccessToken();
            const selectElement = document.getElementById('clientSelect');
            
            console.log('Carregando clientes Prostoral...');
            selectElement.innerHTML = '<option value="">Carregando clientes Prostoral...</option>';
            
            const response = await fetch(`${this.apiBaseUrl}/prostoral/clients/all`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Error response:', errorData);
                throw new Error(errorData.error || 'Failed to load clients');
            }

            const data = await response.json();
            console.log('Clientes carregados:', data);
            
            const clients = data.clients || [];
            
            if (clients.length === 0) {
                selectElement.innerHTML = '<option value="">Nenhum cliente Prostoral cadastrado</option>';
                console.warn('⚠️ Nenhum cliente encontrado na tabela prostoral_clients');
                return;
            }
            
            selectElement.innerHTML = '<option value="">-- Selecione um Cliente Prostoral --</option>';
            
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = `${client.name} (${client.email})`;
                if (client.user_id) {
                    option.textContent += ' ⚠️ Já vinculado';
                    option.disabled = true;
                }
                selectElement.appendChild(option);
            });
            
            console.log('✅ Clientes carregados com sucesso:', clients.length);
        } catch (error) {
            console.error('❌ Error loading clients:', error);
            const selectElement = document.getElementById('clientSelect');
            selectElement.innerHTML = '<option value="">Erro ao carregar clientes</option>';
            this.showError('Erro ao carregar clientes Prostoral. Verifique se há clientes cadastrados.');
        }
    }

    filterUsers() {
        const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
        const statusFilter = document.getElementById('filterStatus').value;

        let filtered = this.users;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(user => 
                (user.full_name || user.email).toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm)
            );
        }

        // Filter by status
        if (statusFilter === 'active') {
            filtered = filtered.filter(user => user.is_active !== false);
        } else if (statusFilter === 'inactive') {
            filtered = filtered.filter(user => user.is_active === false);
        }

        this.renderUsers(filtered);
    }

    renderUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');

        // Hide loading
        loadingState.classList.add('hidden');

        if (!users || users.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        tbody.innerHTML = users.map(user => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span class="text-indigo-600 font-semibold text-sm">
                                ${(user.full_name || user.email).charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${user.full_name || 'Sem nome'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${user.email}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">
                        ${this.renderRoles(user.roles, user.role_descriptions)}
                        ${this.isUserClient(user.id) ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800"><i class="fas fa-tooth mr-1"></i>Cliente Prostoral</span>' : ''}
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">
                        ${this.renderModules(user.permissions)}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${user.is_active !== false 
                        ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>'
                        : '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Inativo</span>'
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button data-action="edit" data-user-id="${user.id}" class="user-action-btn text-indigo-600 hover:text-indigo-900 mr-3" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button data-action="toggle-status" data-user-id="${user.id}" data-user-status="${user.is_active !== false}" 
                        class="user-action-btn ${user.is_active !== false ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}" 
                        title="${user.is_active !== false ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${user.is_active !== false ? 'ban' : 'check-circle'}"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Mapa de tradução de roles técnicas para nomes legíveis
    getRoleDisplayName(roleName) {
        const roleMap = {
            'admin': 'Administrador',
            'Admin': 'Administrador',
            'user': 'Usuário',
            'laboratorist': 'Técnico de Laboratório',
            'lab_client': 'Cliente Laboratório',
            'technician': 'Técnico',
            'manager': 'Gerente',
            'receptionist': 'Recepcionista'
        };

        // Se começa com "user_" é uma role customizada, ignora
        if (roleName.startsWith('user_')) {
            return null; // Será tratado por roleDescriptions
        }

        return roleMap[roleName] || roleName;
    }

    // Converte descrição de acesso em função equivalente
    convertAccessToRole(roleDescription) {
        if (!roleDescription) return null;
        
        // Se a descrição menciona apenas "Laboratório" → Técnico de Laboratório
        if (roleDescription === 'Acesso a: Laboratório') {
            return 'Técnico de Laboratório';
        }
        
        // Se a descrição menciona apenas "Inventário" → Gestor de Inventário
        if (roleDescription === 'Acesso a: Inventário') {
            return 'Gestor de Inventário';
        }
        
        // Se menciona apenas "Configurações" → Administrador de Sistema
        if (roleDescription === 'Acesso a: Configurações') {
            return 'Administrador de Sistema';
        }
        
        // Se menciona apenas "Relatórios" → Analista
        if (roleDescription === 'Acesso a: Relatórios') {
            return 'Analista';
        }
        
        // Se tem múltiplos acessos, mantém a descrição original
        return null;
    }

    renderRoles(roles, roleDescriptions) {
        // Se tem roles, processa e mostra (evitando duplicatas e customizadas)
        if (roles && roles.length > 0) {
            const uniqueRoles = new Set();
            const processedRoles = [];
            
            for (const role of roles) {
                // Ignora roles customizadas (user_*)
                if (role.startsWith('user_')) {
                    continue;
                }
                
                const displayName = this.getRoleDisplayName(role);
                
                // Adiciona apenas se não for duplicado
                if (displayName && !uniqueRoles.has(displayName)) {
                    uniqueRoles.add(displayName);
                    processedRoles.push(displayName);
                }
            }
            
            // Se tiver roles válidas após processamento, mostra
            if (processedRoles.length > 0) {
                return processedRoles.slice(0, 2).map(displayName => `
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        ${displayName}
                    </span>
                `).join('');
            }
        }
        
        // Se não tem roles válidas mas tem descrição
        if (roleDescriptions && roleDescriptions.length > 0) {
            const description = roleDescriptions[0];
            
            // Tenta converter descrição de acesso único em função equivalente
            const equivalentRole = this.convertAccessToRole(description);
            
            if (equivalentRole) {
                // Exibe como se fosse uma role (roxo)
                return `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                    ${equivalentRole}
                </span>`;
            }
            
            // Se não conseguiu converter, mostra a descrição em azul (múltiplos acessos)
            return `<span class="text-xs text-blue-600 font-medium">${description}</span>`;
        }
        
        // Se não tem nada, mostra "Sem função"
        return '<span class="text-xs text-gray-400">Sem função</span>';
    }

    renderModules(permissions) {
        if (!permissions || permissions.length === 0) {
            return '<span class="text-xs text-gray-400">Nenhum módulo</span>';
        }

        const modules = new Set();
        permissions.forEach(perm => {
            const module = perm.split(':')[0];
            modules.add(module);
        });

        const moduleIcons = {
            inventory: '📦',
            prostoral: '🧪',
            laboratory: '🧪', // Legacy (mantido por compatibilidade)
            reports: '📊',
            settings: '⚙️',
            admin: '👑',
            users: '👥'
        };

        return Array.from(modules).slice(0, 4).map(module => `
            <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                ${moduleIcons[module] || '📋'} ${module}
            </span>
        `).join('');
    }

    isUserClient(userId) {
        // Verifica se o usuário está vinculado a algum cliente
        return this.clientsData.some(client => client.user_id === userId);
    }

    openUserModal(userId = null) {
        this.currentEditingUserId = userId;
        const modal = document.getElementById('modalUser');
        const title = document.getElementById('modalUserTitle');
        const passwordFields = document.getElementById('passwordFields');

        if (userId) {
            title.innerHTML = '<i class="fas fa-user-edit text-indigo-600 mr-2"></i>Editar Usuário';
            passwordFields.classList.add('hidden');
            document.getElementById('userPassword').removeAttribute('required');
            this.loadUserData(userId);
        } else {
            title.innerHTML = '<i class="fas fa-user-plus text-indigo-600 mr-2"></i>Novo Usuário';
            passwordFields.classList.remove('hidden');
            document.getElementById('userPassword').setAttribute('required', '');
            this.resetUserForm();
        }

        modal.classList.remove('hidden');
    }

    closeUserModal() {
        document.getElementById('modalUser').classList.add('hidden');
        this.resetUserForm();
        this.currentEditingUserId = null;
    }

    resetUserForm() {
        document.getElementById('formUser').reset();
        document.querySelectorAll('.module-checkbox, .permission-checkbox').forEach(cb => {
            cb.checked = false;
            cb.disabled = false;
        });
        document.getElementById('isAdmin').checked = false;
    }

    async loadUserData(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('userName').value = user.full_name || '';
        document.getElementById('userEmail_input').value = user.email;

        // Check admin status
        const isAdmin = user.roles?.some(role => role.toLowerCase().includes('admin'));
        document.getElementById('isAdmin').checked = isAdmin;

        // Load permissions
        if (user.permissions && !isAdmin) {
            console.log('📋 Carregando permissões do usuário:', user.permissions);
            
            user.permissions.forEach(perm => {
                const checkbox = document.querySelector(`[data-permission="${perm}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });

            // Check modules if all permissions are present in user data
            const requiredPerms = {
                'inventory': ['inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete', 'inventory:manage'],
                'prostoral': ['prostoral:read', 'prostoral:create', 'prostoral:update', 'prostoral:delete', 'prostoral:manage'],
                'reports': ['reports:read', 'reports:create', 'reports:manage'],
                'settings': ['settings:read', 'settings:update', 'settings:manage']
            };
            
            ['inventory', 'prostoral', 'reports', 'settings'].forEach(module => {
                const required = requiredPerms[module];
                const hasAllPerms = required.every(perm => user.permissions.includes(perm));
                const moduleCheckbox = document.querySelector(`[data-module="${module}"]`);
                
                console.log(`🔍 Módulo ${module}:`, {
                    required: required.length,
                    userHas: required.filter(p => user.permissions.includes(p)).length,
                    hasAll: hasAllPerms
                });
                
                if (moduleCheckbox && hasAllPerms) {
                    moduleCheckbox.checked = true;
                    console.log(`✅ Checkbox do módulo ${module} MARCADO`);
                } else if (moduleCheckbox) {
                    console.log(`❌ Checkbox do módulo ${module} NÃO marcado (faltam permissões)`);
                }
            });
        }

        if (isAdmin) {
            document.querySelectorAll('.module-checkbox, .permission-checkbox').forEach(cb => {
                cb.checked = true;
                cb.disabled = true;
            });
        }

        // Carregar cliente vinculado
        await this.loadClientForUser(userId);
    }

    async loadClientForUser(userId) {
        try {
            const token = getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/prostoral/clients/by-user/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) return;

            const data = await response.json();
            if (data.client) {
                // Usuário está vinculado a um cliente
                document.getElementById('isClient').checked = true;
                document.getElementById('clientSelectContainer').classList.remove('hidden');
                
                // Carregar lista de clientes e selecionar o atual
                await this.loadClients();
                document.getElementById('clientSelect').value = data.client.id;
            }
        } catch (error) {
            console.error('Error loading client for user:', error);
        }
    }

    async saveUser() {
        try {
            const name = document.getElementById('userName').value;
            const email = document.getElementById('userEmail_input').value;
            const password = document.getElementById('userPassword').value;
            const isAdmin = document.getElementById('isAdmin').checked;
            const isClient = document.getElementById('isClient').checked;
            const clientId = document.getElementById('clientSelect').value;

            // Get selected permissions
            const permissions = [];
            if (!isAdmin) {
                const allCheckboxes = document.querySelectorAll('.permission-checkbox');
                const checkedCheckboxes = document.querySelectorAll('.permission-checkbox:checked');
                
                console.log('📋 Total de checkboxes de permissão:', allCheckboxes.length);
                console.log('✅ Checkboxes marcados:', checkedCheckboxes.length);
                
                checkedCheckboxes.forEach(cb => {
                    const permission = cb.dataset.permission;
                    permissions.push(permission);
                    console.log(`   ✅ ${permission}${cb.classList.contains('hidden') ? ' (hidden)' : ''}`);
                });
                
                console.log('💾 Salvando permissões:', permissions);
                console.log('📊 Total de permissões:', permissions.length);
            }

            const userData = {
                full_name: name,
                email: email,
                is_admin: isAdmin,
                permissions: isAdmin ? [] : permissions
            };

            if (!this.currentEditingUserId) {
                userData.password = password;
            }

            const token = getAccessToken();
            const url = this.currentEditingUserId 
                ? `${this.apiBaseUrl}/admin/users/${this.currentEditingUserId}`
                : `${this.apiBaseUrl}/admin/users`;
            
            const method = this.currentEditingUserId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save user');
            }

            const result = await response.json();
            const userId = this.currentEditingUserId || result.user?.id;

            // Vincular ou desvincular cliente
            if (userId) {
                if (isClient && clientId) {
                    // Vincular usuário ao cliente
                    await this.linkUserToClient(userId, clientId);
                } else if (!isClient) {
                    // Desvincular usuário de cliente (se estava vinculado)
                    await this.unlinkUserFromClient(userId);
                }
            }

            this.showSuccess(this.currentEditingUserId ? 'Usuário atualizado!' : 'Usuário criado!');
            this.closeUserModal();
            await this.loadUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            this.showError(error.message || 'Erro ao salvar usuário');
        }
    }

    async linkUserToClient(userId, clientId) {
        try {
            const token = getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/prostoral/clients/link-user`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, clientId })
            });

            if (!response.ok) throw new Error('Failed to link user to client');

            console.log('✅ Usuário vinculado ao cliente com sucesso');
        } catch (error) {
            console.error('Error linking user to client:', error);
            throw error;
        }
    }

    async unlinkUserFromClient(userId) {
        try {
            const token = getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/prostoral/clients/unlink-user`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });

            if (!response.ok) {
                // Se não houver cliente vinculado, não é um erro
                const data = await response.json();
                if (data.affectedClients && data.affectedClients.length === 0) {
                    return;
                }
                throw new Error('Failed to unlink user from client');
            }

            console.log('✅ Usuário desvinculado do cliente');
        } catch (error) {
            console.error('Error unlinking user from client:', error);
            // Não fazer throw aqui para não bloquear o salvamento do usuário
        }
    }

    async editUser(userId) {
        this.openUserModal(userId);
    }

    async toggleUserStatus(userId, currentStatus) {
        const action = currentStatus ? 'desativar' : 'ativar';
        if (!confirm(`Deseja realmente ${action} este usuário?`)) return;

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${this.apiBaseUrl}/admin/users/${userId}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_active: !currentStatus
                })
            });

            if (!response.ok) throw new Error('Failed to update user status');

            this.showSuccess(`Usuário ${action}do com sucesso!`);
            await this.loadUsers();
        } catch (error) {
            console.error('Error toggling user status:', error);
            this.showError('Erro ao atualizar status do usuário');
        }
    }

    showSuccess(message) {
        alert(message); // You can replace this with a better notification system
    }

    showError(message) {
        alert(message); // You can replace this with a better notification system
    }
}

// Initialize when DOM is ready
let userManagement;
document.addEventListener('DOMContentLoaded', () => {
    userManagement = new UserManagement();
});

