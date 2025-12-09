// =====================================================
// PROSTORAL - Sistema de Gestão de Laboratório
// =====================================================

class ProstoralApp {
    constructor() {
        this.clients = [];
        this.orders = [];
        this.kits = [];
        this.inventory = [];
        this.apiBaseUrl = '/api/prostoral';
        this.init();
    }

    async init() {
        console.log('Iniciando ProStoral App...');
        
        // Aguardar authManager estar pronto
        if (!window.authManager) {
            console.error('AuthManager não encontrado');
            window.location.href = 'login.html';
            return;
        }

        // Aguardar inicialização do authManager
        await window.authManager.init();

        // Verificar autenticação
        if (!window.authManager.isUserAuthenticated()) {
            console.log('Usuário não autenticado, redirecionando para login');
            window.location.href = 'login.html';
            return;
        }

        console.log('Usuário autenticado!');

        // Carregar dados do usuário
        await this.loadUserInfo();

        // Carregar dashboard (view inicial)
        await this.loadDashboard();

        // Setup event listeners
        this.setupEventListeners();
    }

    async loadUserInfo() {
        const user = window.authManager.user;
        if (user && user.email) {
            // Desktop
            document.getElementById('totalOrders').textContent = '0';
            document.getElementById('totalClients').textContent = '0';
            
            // Mobile
            document.getElementById('mobileUserEmail').textContent = user.email;
            document.getElementById('mobileTotalOrders').textContent = '0';
            document.getElementById('mobileTotalClients').textContent = '0';
        }
    }

    setupEventListeners() {
        // Filtros de clientes
        const clientSearch = document.getElementById('client-search');
        const clientFilterType = document.getElementById('client-filter-type');
        const clientFilterStatus = document.getElementById('client-filter-status');

        if (clientSearch) {
            clientSearch.addEventListener('input', this.debounce(() => this.loadClients(), 300));
        }
        if (clientFilterType) {
            clientFilterType.addEventListener('change', () => this.loadClients());
        }
        if (clientFilterStatus) {
            clientFilterStatus.addEventListener('change', () => this.loadClients());
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // =====================================================
    // DASHBOARD
    // =====================================================

    async loadDashboard() {
        console.log('Carregando dashboard...');
        try {
            const token = await window.authManager.getAccessToken();
            
            // Carregar KPIs
            const response = await fetch(`${this.apiBaseUrl}/dashboard/kpis`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar KPIs');
            }

            const data = await response.json();
            
            if (data.success && data.kpis) {
                // Atualizar KPIs
                document.getElementById('kpi-active-orders').textContent = data.kpis.totalOrders || 0;
                document.getElementById('kpi-low-stock').textContent = data.kpis.lowStockItems || 0;
                document.getElementById('kpi-active-clients').textContent = data.kpis.ordersByStatus?.active || 0;
                document.getElementById('kpi-open-incidents').textContent = data.kpis.openIncidents || 0;
                
                // Atualizar header stats
                document.getElementById('totalOrders').textContent = data.kpis.totalOrders || 0;
                document.getElementById('mobileTotalOrders').textContent = data.kpis.totalOrders || 0;
            }

            // Carregar atividades recentes
            await this.loadRecentActivities();

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            this.showError('Erro ao carregar dashboard');
        }
    }

    async loadRecentActivities() {
        const container = document.getElementById('recent-activities');
        if (!container) return;

        try {
            const token = await window.authManager.getAccessToken();
            
            // Buscar últimas OS
            const response = await fetch(`${this.apiBaseUrl}/orders?limit=5`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar atividades');
            }

            const data = await response.json();
            
            if (data.success && data.orders && data.orders.length > 0) {
                container.innerHTML = `
                    <div class="space-y-4">
                        ${data.orders.map(order => `
                            <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                <div class="flex items-center gap-4">
                                    <div class="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-xl">
                                        <i class="fas fa-clipboard-list text-emerald-600 dark:text-emerald-400"></i>
                                    </div>
                                    <div>
                                        <p class="font-semibold text-gray-900 dark:text-white">OS #${order.work_order_number || order.id.substring(0, 8)}</p>
                                        <p class="text-sm text-gray-600 dark:text-gray-400">${order.patient_name || 'Paciente'}</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${this.getStatusColor(order.status)}">
                                        ${this.getStatusText(order.status)}
                                    </span>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        ${new Date(order.created_at).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-inbox text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
                        <p class="text-gray-500 dark:text-gray-400">Nenhuma atividade recente</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Erro ao carregar atividades:', error);
            container.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i class="fas fa-exclamation-circle text-4xl mb-3"></i>
                    <p>Erro ao carregar atividades</p>
                </div>
            `;
        }
    }

    // =====================================================
    // CLIENTES
    // =====================================================

    async loadClients() {
        console.log('Carregando clientes...');
        try {
            const token = await window.authManager.getAccessToken();
            const search = document.getElementById('client-search')?.value || '';
            const status = document.getElementById('client-filter-status')?.value || '';

            let url = `${this.apiBaseUrl}/clients?`;
            if (search) url += `search=${encodeURIComponent(search)}&`;
            if (status === 'active') url += `is_active=true&`;
            if (status === 'inactive') url += `is_active=false&`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar clientes');
            }

            const data = await response.json();
            let clients = data.clients || [];
            
            // Filtro de tipo (client-side já que a API não suporta)
            const type = document.getElementById('client-filter-type')?.value || '';
            if (type === 'clinic') {
                clients = clients.filter(c => c.clinic_name && !c.dentist_name);
            } else if (type === 'dentist') {
                clients = clients.filter(c => c.dentist_name);
            } else if (type === 'individual') {
                clients = clients.filter(c => !c.clinic_name && !c.dentist_name);
            }
            
            this.clients = clients;

            // Atualizar contadores
            const activeClients = this.clients.filter(c => c.is_active).length;
            document.getElementById('totalClients').textContent = this.clients.length;
            document.getElementById('mobileTotalClients').textContent = this.clients.length;
            document.getElementById('kpi-active-clients').textContent = activeClients;

            this.renderClients();
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            this.showError('Erro ao carregar clientes');
        }
    }

    renderClients() {
        const tbody = document.getElementById('clients-table-body');
        if (!tbody) return;

        if (this.clients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        <i class="fas fa-users text-6xl mb-4 opacity-50"></i>
                        <p>Nenhum cliente encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.clients.map(client => {
            // Determinar o nome principal e subtítulo
            const mainName = client.name || 'N/A';
            const subtitle = client.clinic_name || client.dentist_name || '';
            
            // Determinar ícone baseado em qual campo está preenchido
            let icon = 'fa-user';
            if (client.clinic_name && client.dentist_name) {
                icon = 'fa-building';
            } else if (client.dentist_name) {
                icon = 'fa-user-md';
            }
            
            return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center">
                            <i class="fas ${icon} text-white"></i>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">
                                ${mainName}
                            </div>
                            ${subtitle ? `<div class="text-sm text-gray-500 dark:text-gray-400">${subtitle}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        ${this.getClientType(client)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ${client.email || 'N/A'}<br>
                    <span class="text-gray-500 dark:text-gray-400">${client.phone || 'N/A'}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ${client.nif || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${client.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                        ${client.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button data-action="view" data-client-id="${client.id}" class="client-action-btn text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 mr-3" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button data-action="edit" data-client-id="${client.id}" class="client-action-btn text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button data-action="delete" data-client-id="${client.id}" class="client-action-btn text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" title="Desativar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    }

    // =====================================================
    // HELPERS
    // =====================================================

    getClientIcon(type) {
        const icons = {
            clinic: 'fa-building',
            dentist: 'fa-user-md',
            individual: 'fa-user'
        };
        return icons[type] || 'fa-user';
    }

    getTypeColor(type) {
        const colors = {
            clinic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
            dentist: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            individual: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        };
        return colors[type] || colors.individual;
    }

    getTypeText(type) {
        const texts = {
            clinic: 'Clínica',
            dentist: 'Dentista',
            individual: 'Individual'
        };
        return texts[type] || 'Individual';
    }

    getStatusColor(status) {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            in_production: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            quality_check: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
            ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
            cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        };
        return colors[status] || colors.pending;
    }

    getStatusText(status) {
        const texts = {
            pending: 'Pendente',
            in_production: 'Em Produção',
            quality_check: 'Controle Qualidade',
            ready: 'Pronto',
            delivered: 'Entregue',
            cancelled: 'Cancelado'
        };
        return texts[status] || 'Pendente';
    }

    getClientType(client) {
        if (client.clinic_name && !client.dentist_name) {
            return 'Clínica';
        } else if (client.dentist_name) {
            return 'Dentista';
        } else {
            return 'Individual';
        }
    }

    showError(message) {
        alert(message);
    }

    showSuccess(message) {
        alert(message);
    }

    // =====================================================
    // CRUD DE CLIENTES
    // =====================================================

    async viewClient(id) {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/clients/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Erro ao carregar cliente');

            const data = await response.json();
            const client = data.client;

            document.getElementById('viewClientContent').innerHTML = `
                <div class="space-y-6">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <i class="fas fa-info-circle text-emerald-600"></i>
                            Informações Básicas
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Nome / Razão Social</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.name || 'N/A'}</p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Tipo de Cliente</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">
                                    <span class="px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                        ${this.getClientType(client)}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Nome da Clínica</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.clinic_name || 'N/A'}</p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Nome do Dentista</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.dentist_name || 'N/A'}</p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">NIF</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.nif || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <i class="fas fa-phone text-emerald-600"></i>
                            Contato
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Email</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.email || 'N/A'}</p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Telefone</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Telemóvel</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.mobile || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <i class="fas fa-map-marker-alt text-emerald-600"></i>
                            Endereço
                        </h4>
                        <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
                            <p class="text-base font-medium text-gray-900 dark:text-white mb-2">${client.address || 'N/A'}</p>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${client.postal_code || ''} ${client.city || ''}, ${client.country || 'Portugal'}</p>
                        </div>
                    </div>

                    <div>
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <i class="fas fa-euro-sign text-emerald-600"></i>
                            Informações Comerciais
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Prazo de Pagamento</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.payment_terms || 30} dias</p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Desconto</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.discount_percentage || 0}%</p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-500 dark:text-gray-400">Limite de Crédito</label>
                                <p class="text-base font-medium text-gray-900 dark:text-white">${client.credit_limit ? '€' + parseFloat(client.credit_limit).toFixed(2) : 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    ${client.notes ? `
                    <div>
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <i class="fas fa-sticky-note text-emerald-600"></i>
                            Observações
                        </h4>
                        <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
                            <p class="text-base text-gray-900 dark:text-white">${client.notes}</p>
                        </div>
                    </div>
                    ` : ''}

                    <div class="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button id="btnEditFromView" data-client-id="${client.id}" class="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105">
                            <i class="fas fa-edit mr-2"></i>
                            Editar
                        </button>
                    </div>
                </div>
            `;

            document.getElementById('viewClientModal').classList.remove('hidden');
            
            // Adicionar event listener para o botão de editar
            document.getElementById('btnEditFromView')?.addEventListener('click', (e) => {
                const clientId = e.currentTarget.dataset.clientId;
                closeViewClientModal();
                this.editClient(clientId);
            });
        } catch (error) {
            console.error('Erro ao visualizar cliente:', error);
            this.showError('Erro ao carregar detalhes do cliente');
        }
    }

    async editClient(id) {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/clients/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Erro ao carregar cliente');

            const data = await response.json();
            const client = data.client;

            // Preencher o formulário
            document.getElementById('clientId').value = client.id;
            document.getElementById('clientName').value = client.name || '';
            
            // Definir o tipo de cliente baseado nos dados
            let clientType = 'individual';
            if (client.clinic_name && !client.dentist_name) {
                clientType = 'clinic';
            } else if (client.dentist_name) {
                clientType = 'dentist';
            }
            document.getElementById('clientType').value = clientType;
            
            document.getElementById('clientClinicName').value = client.clinic_name || '';
            document.getElementById('clientDentistName').value = client.dentist_name || '';
            document.getElementById('clientNif').value = client.nif || '';
            document.getElementById('clientEmail').value = client.email || '';
            document.getElementById('clientPhone').value = client.phone || '';
            document.getElementById('clientMobile').value = client.mobile || '';
            document.getElementById('clientAddress').value = client.address || '';
            document.getElementById('clientCity').value = client.city || '';
            document.getElementById('clientPostalCode').value = client.postal_code || '';
            document.getElementById('clientCountry').value = client.country || 'Portugal';
            document.getElementById('clientPaymentTerms').value = client.payment_terms || 30;
            document.getElementById('clientDiscount').value = client.discount_percentage || 0;
            document.getElementById('clientCreditLimit').value = client.credit_limit || '';
            document.getElementById('clientNotes').value = client.notes || '';
            document.getElementById('clientIsActive').checked = client.is_active !== false;

            document.getElementById('clientModalTitle').textContent = 'Editar Cliente';
            document.getElementById('clientModal').classList.remove('hidden');
        } catch (error) {
            console.error('Erro ao carregar cliente para edição:', error);
            this.showError('Erro ao carregar cliente');
        }
    }

    async deleteClient(id) {
        if (!confirm('Tem certeza que deseja desativar este cliente?')) {
            return;
        }

        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/clients/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Erro ao desativar cliente');

            this.showSuccess('Cliente desativado com sucesso!');
            this.loadClients();
        } catch (error) {
            console.error('Erro ao desativar cliente:', error);
            this.showError('Erro ao desativar cliente');
        }
    }

    async saveClient(formData) {
        try {
            const token = await window.authManager.getAccessToken();
            const clientId = formData.get('id');
            const isEditing = !!clientId;

            const clientData = {
                name: formData.get('name'),
                clinic_name: formData.get('clinic_name'),
                dentist_name: formData.get('dentist_name'),
                nif: formData.get('nif'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                mobile: formData.get('mobile'),
                address: formData.get('address'),
                city: formData.get('city'),
                postal_code: formData.get('postal_code'),
                country: formData.get('country'),
                payment_terms: parseInt(formData.get('payment_terms')) || 30,
                discount_percentage: parseFloat(formData.get('discount_percentage')) || 0,
                credit_limit: formData.get('credit_limit') ? parseFloat(formData.get('credit_limit')) : null,
                notes: formData.get('notes'),
                is_active: formData.get('is_active') === 'true'
            };

            const url = isEditing ? `${this.apiBaseUrl}/clients/${clientId}` : `${this.apiBaseUrl}/clients`;
            const method = isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clientData)
            });

            if (!response.ok) throw new Error('Erro ao salvar cliente');

            this.showSuccess(isEditing ? 'Cliente atualizado com sucesso!' : 'Cliente criado com sucesso!');
            closeClientModal();
            this.loadClients();
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            this.showError('Erro ao salvar cliente');
        }
    }
}

// Funções globais para modals
function openClientModal() {
    // Limpar formulário
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';
    document.getElementById('clientModalTitle').textContent = 'Novo Cliente';
    document.getElementById('clientCountry').value = 'Portugal';
    document.getElementById('clientPaymentTerms').value = 30;
    document.getElementById('clientDiscount').value = 0;
    document.getElementById('clientIsActive').checked = true;
    
    document.getElementById('clientModal').classList.remove('hidden');
}

function closeClientModal() {
    document.getElementById('clientModal').classList.add('hidden');
}

function closeViewClientModal() {
    document.getElementById('viewClientModal').classList.add('hidden');
}

// Inicializar app quando DOM estiver pronto
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, aguardando authManager...');
    
    // Aguardar authManager estar disponível
    const checkAuthManager = setInterval(() => {
        if (window.authManager) {
            clearInterval(checkAuthManager);
            console.log('AuthManager disponível, iniciando app...');
            window.prostoralApp = new ProstoralApp();
            
            // Event listeners para botões de modal
            document.getElementById('btnNewClient')?.addEventListener('click', () => {
                openClientModal();
            });
            
            document.getElementById('btnCloseClientModal')?.addEventListener('click', () => {
                closeClientModal();
            });
            
            document.getElementById('btnCancelClientModal')?.addEventListener('click', () => {
                closeClientModal();
            });
            
            document.getElementById('btnCloseViewClientModal')?.addEventListener('click', () => {
                closeViewClientModal();
            });
            
            // Event delegation para botões de ação dos clientes
            document.getElementById('clients-table-body')?.addEventListener('click', (e) => {
                const button = e.target.closest('.client-action-btn');
                if (!button) return;
                
                const action = button.dataset.action;
                const clientId = button.dataset.clientId;
                
                if (!window.prostoralApp) return;
                
                switch(action) {
                    case 'view':
                        window.prostoralApp.viewClient(clientId);
                        break;
                    case 'edit':
                        window.prostoralApp.editClient(clientId);
                        break;
                    case 'delete':
                        window.prostoralApp.deleteClient(clientId);
                        break;
                }
            });
            
            // Event listeners para filtros de cliente
            document.getElementById('client-search')?.addEventListener('input', debounce(() => {
                if (window.prostoralApp) {
                    window.prostoralApp.loadClients();
                }
            }, 500));
            
            document.getElementById('client-filter-type')?.addEventListener('change', () => {
                if (window.prostoralApp) {
                    window.prostoralApp.loadClients();
                }
            });
            
            document.getElementById('client-filter-status')?.addEventListener('change', () => {
                if (window.prostoralApp) {
                    window.prostoralApp.loadClients();
                }
            });
            
            // Event listener para formulário de cliente
            document.getElementById('clientForm')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData();
                formData.append('id', document.getElementById('clientId').value);
                formData.append('name', document.getElementById('clientName').value);
                formData.append('clinic_name', document.getElementById('clientClinicName').value);
                formData.append('dentist_name', document.getElementById('clientDentistName').value);
                formData.append('nif', document.getElementById('clientNif').value);
                formData.append('email', document.getElementById('clientEmail').value);
                formData.append('phone', document.getElementById('clientPhone').value);
                formData.append('mobile', document.getElementById('clientMobile').value);
                formData.append('address', document.getElementById('clientAddress').value);
                formData.append('city', document.getElementById('clientCity').value);
                formData.append('postal_code', document.getElementById('clientPostalCode').value);
                formData.append('country', document.getElementById('clientCountry').value);
                formData.append('payment_terms', document.getElementById('clientPaymentTerms').value);
                formData.append('discount_percentage', document.getElementById('clientDiscount').value);
                formData.append('credit_limit', document.getElementById('clientCreditLimit').value);
                formData.append('notes', document.getElementById('clientNotes').value);
                formData.append('is_active', document.getElementById('clientIsActive').checked.toString());
                
                if (window.prostoralApp) {
                    await window.prostoralApp.saveClient(formData);
                }
            });
        }
    }, 100);
    
    // Timeout de segurança
    setTimeout(() => {
        clearInterval(checkAuthManager);
        if (!window.prostoralApp) {
            console.error('Timeout ao aguardar authManager');
            window.location.href = 'login.html';
        }
    }, 5000);
});

// Função helper para debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
