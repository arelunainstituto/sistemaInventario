// =====================================================
// PORTAL DO CLIENTE - SISTEMA PROSTORAL
// =====================================================

class ClientPortalApp {
    constructor() {
        this.orders = [];
        this.currentOrder = null;
        this.filters = {
            search: '',
            status: '',
            date_from: ''
        };
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.totalPages = 1;
        this.apiBaseUrl = '/api/prostoral';
    }

    async init() {
        console.log('Inicializando Portal do Cliente...');

        // Aguardar authManager estar pronto
        if (!window.authManager || !window.authManager.isUserAuthenticated()) {
            console.error('Usuário não autenticado');
            window.location.href = '/login.html';
            return;
        }

        // Verificar se o usuário é cliente
        await this.checkClientRole();

        // Exibir email do usuário
        const { data: { user } } = await window.authManager.supabase.auth.getUser();
        if (user) {
            document.getElementById('user-email').textContent = user.email;
            const mobileUserEmail = document.getElementById('mobileUserEmail');
            if (mobileUserEmail) {
                mobileUserEmail.textContent = user.email;
            }
        }

        // Setup event listeners
        this.setupEventListeners();

        // Carregar dashboard
        await this.loadDashboard();

        // Carregar ordens inicialmente
        await this.loadOrders();

        console.log('Portal do Cliente inicializado!');
    }

    async checkClientRole() {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/check-client-role`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Acesso negado: Você não tem permissão de cliente');
            }

            const data = await response.json();
            console.log('[DEBUG] checkClientRole response:', data);

            // Verificar se é usuário interno e redirecionar
            if (data.isInternal && data.redirectUrl) {
                alert('Usuário interno detectado. Redirecionando para o Sistema de Laboratório...');
                window.location.href = data.redirectUrl;
                return;
            }

            if (!data.isClient) {
                alert('Acesso negado: Você não tem permissão de cliente');
                window.location.href = '/prostoral.html';
            }
        } catch (error) {
            console.error('Erro ao verificar permissões:', error);
            // Se a rota ainda não existe, permitir acesso temporariamente
            // alert('Erro ao verificar permissões: ' + error.message);
        }
    }

    setupEventListeners() {
        // Tabs
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Dark mode
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
        }

        const mobileDarkModeToggle = document.getElementById('mobileDarkModeToggle');
        if (mobileDarkModeToggle) {
            mobileDarkModeToggle.addEventListener('click', () => this.toggleDarkMode());
        }

        // Mobile menu
        const openMobileMenu = document.getElementById('openMobileMenu');
        const closeMobileMenu = document.getElementById('closeMobileMenu');
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        const mobileMenu = document.getElementById('mobileMenu');

        if (openMobileMenu) {
            openMobileMenu.addEventListener('click', () => {
                mobileMenu.classList.remove('translate-x-full');
                mobileMenuOverlay.classList.remove('opacity-0', 'invisible');
            });
        }

        if (closeMobileMenu) {
            closeMobileMenu.addEventListener('click', () => {
                mobileMenu.classList.add('translate-x-full');
                mobileMenuOverlay.classList.add('opacity-0', 'invisible');
            });
        }

        if (mobileMenuOverlay) {
            mobileMenuOverlay.addEventListener('click', () => {
                mobileMenu.classList.add('translate-x-full');
                mobileMenuOverlay.classList.add('opacity-0', 'invisible');
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', () => this.logout());
        }

        // Nova ordem
        const btnNewOrder = document.getElementById('btn-new-order');
        if (btnNewOrder) {
            btnNewOrder.addEventListener('click', () => this.showNewOrderModal());
        }

        // Cancelar nova ordem
        const btnCancelOrder = document.getElementById('btn-cancel-order');
        if (btnCancelOrder) {
            btnCancelOrder.addEventListener('click', () => this.closeModal('modal-new-order'));
        }

        // Form de nova ordem
        const newOrderForm = document.getElementById('new-order-form');
        if (newOrderForm) {
            newOrderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createOrder();
            });
        }

        // Fechar modal de detalhes
        const btnCloseDetails = document.getElementById('btn-close-details');
        if (btnCloseDetails) {
            btnCloseDetails.addEventListener('click', () => this.closeModal('modal-order-details'));
        }

        // Filtros
        const filterSearch = document.getElementById('filter-search');
        if (filterSearch) {
            filterSearch.addEventListener('input', () => {
                this.filters.search = filterSearch.value;
                this.loadOrders();
            });
        }

        const filterStatus = document.getElementById('filter-status');
        if (filterStatus) {
            filterStatus.addEventListener('change', () => {
                this.filters.status = filterStatus.value;
                this.loadOrders();
            });
        }

        const filterDateFrom = document.getElementById('filter-date-from');
        if (filterDateFrom) {
            filterDateFrom.addEventListener('change', () => {
                this.filters.date_from = filterDateFrom.value;
                this.loadOrders();
            });
        }
    }

    switchTab(tabName) {
        // Atualizar botões
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active', 'border-emerald-600', 'text-emerald-600');
            btn.classList.add('border-transparent');
        });
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('active', 'border-emerald-600', 'text-emerald-600');
        }

        // Atualizar conteúdo
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(`${tabName}-content`);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        // Carregar dados da aba
        if (tabName === 'dashboard') {
            this.loadDashboard();
        } else if (tabName === 'orders') {
            this.loadOrders();
        }
    }

    toggleDarkMode() {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
    }

    async logout() {
        const result = await window.authManager.signOut();
        if (result.success) {
            window.location.href = '/login.html';
        } else {
            alert('Erro ao fazer logout. Tente novamente.');
        }
    }

    // =====================================================
    // DASHBOARD
    // =====================================================

    async loadDashboard() {
        try {
            const token = await window.authManager.getAccessToken();

            // Carregar KPIs
            const kpisResponse = await fetch(`${this.apiBaseUrl}/client/dashboard/kpis`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!kpisResponse.ok) {
                throw new Error('Erro ao carregar KPIs');
            }

            const kpis = await kpisResponse.json();

            document.getElementById('kpi-total-orders').textContent = kpis.total_orders || 0;
            document.getElementById('kpi-active-orders').textContent = kpis.active_orders || 0;
            document.getElementById('kpi-completed-orders').textContent = kpis.completed_orders || 0;
            document.getElementById('kpi-open-issues').textContent = kpis.open_issues || 0;

            // Carregar atividades recentes
            await this.loadRecentActivities();

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            this.showError('Erro ao carregar dashboard');
        }
    }

    async loadRecentActivities() {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/client/orders/recent`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar atividades');
            }

            const orders = await response.json();
            this.renderRecentActivities(orders);

        } catch (error) {
            console.error('Erro ao carregar atividades:', error);
            document.getElementById('recent-activities').innerHTML = '<p class="text-gray-500 dark:text-gray-400">Erro ao carregar atividades</p>';
        }
    }

    renderRecentActivities(orders) {
        const container = document.getElementById('recent-activities');

        if (!orders || orders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Nenhuma atividade recente</p>';
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer" onclick="window.clientPortalApp.viewOrderDetails('${order.id}')">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-clipboard-list text-emerald-600 dark:text-emerald-400"></i>
                    <div>
                        <p class="font-semibold text-gray-900 dark:text-white">OS #${order.order_number.substring(0, 12)}</p>
                        <p class="text-sm text-gray-600 dark:text-gray-400">${order.patient_name}</p>
                    </div>
                </div>
                <div class="text-right">
                    ${this.renderStatusBadge(order.status)}
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${this.formatDate(order.received_date)}</p>
                </div>
            </div>
        `).join('');
    }

    // =====================================================
    // ORDENS DE SERVIÇO
    // =====================================================

    async loadOrders() {
        try {
            const token = await window.authManager.getAccessToken();

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                search: this.filters.search || '',
                status: this.filters.status || '',
                date_from: this.filters.date_from || ''
            });

            const response = await fetch(`${this.apiBaseUrl}/client/orders?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar ordens');
            }

            const data = await response.json();
            this.orders = data.orders || [];
            this.totalPages = data.pagination?.totalPages || 1;

            this.renderOrdersTable();

        } catch (error) {
            console.error('Erro ao carregar ordens:', error);
            this.showError('Erro ao carregar ordens');
        }
    }

    renderOrdersTable() {
        const tbody = document.getElementById('orders-table-body');

        if (!this.orders || this.orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Nenhuma ordem encontrada
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.orders.map(order => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onclick="window.clientPortalApp.viewOrderDetails('${order.id}')">
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="font-medium text-gray-900 dark:text-white">#${order.order_number.substring(0, 12)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-gray-900 dark:text-white">${order.patient_name || 'N/A'}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${this.renderStatusBadge(order.status)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-gray-600 dark:text-gray-400">${this.formatDate(order.received_date)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button onclick="event.stopPropagation(); window.clientPortalApp.viewOrderDetails('${order.id}')" class="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200">
                        <i class="fas fa-eye mr-1"></i>Ver Detalhes
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderStatusBadge(status) {
        const statusMap = {
            received: { label: 'Recebido', class: 'status-received' },
            design: { label: 'Design', class: 'status-design' },
            production: { label: 'Produção', class: 'status-production' },
            finishing: { label: 'Acabamento', class: 'status-finishing' },
            quality_control: { label: 'Controle de Qualidade', class: 'status-quality_control' },
            delivered: { label: 'Entregue', class: 'status-delivered' },
            cancelled: { label: 'Cancelado', class: 'status-cancelled' }
        };

        const statusInfo = statusMap[status] || { label: status, class: '' };
        return `<span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>`;
    }

    // =====================================================
    // CRIAR ORDEM
    // =====================================================

    showNewOrderModal() {
        document.getElementById('modal-new-order').classList.remove('hidden');
        document.getElementById('new-order-form').reset();
    }

    async createOrder() {
        try {
            const patientName = document.getElementById('order-patient-name').value;
            const workType = document.getElementById('order-work-type').value;
            const workDescription = document.getElementById('order-work-description').value;
            const expectedDelivery = document.getElementById('order-expected-delivery').value;

            if (!patientName || !workDescription) {
                this.showError('Por favor, preencha os campos obrigatórios');
                return;
            }

            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/client/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patient_name: patientName,
                    work_type: workType,
                    work_description: workDescription,
                    due_date: expectedDelivery || null
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao criar ordem');
            }

            this.showSuccess('Ordem criada com sucesso!');
            this.closeModal('modal-new-order');
            await this.loadOrders();
            await this.loadDashboard();

        } catch (error) {
            console.error('Erro ao criar ordem:', error);
            this.showError(`Erro: ${error.message}`);
        }
    }

    // =====================================================
    // VER DETALHES DA ORDEM
    // =====================================================

    async viewOrderDetails(orderId) {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/client/orders/${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar detalhes da ordem');
            }

            const order = await response.json();
            this.currentOrder = order;
            this.renderOrderDetails(order);
            document.getElementById('modal-order-details').classList.remove('hidden');

        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            this.showError('Erro ao carregar detalhes da ordem');
        }
    }

    renderOrderDetails(order) {
        const content = document.getElementById('order-details-content');
        document.getElementById('modal-order-title').textContent = `OS #${order.order_number}`;

        content.innerHTML = `
            <!-- Informações Gerais -->
            <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-6">
                <h4 class="font-bold text-lg text-gray-900 dark:text-white mb-4">
                    <i class="fas fa-info-circle text-emerald-600 mr-2"></i>Informações Gerais
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Paciente:</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${order.patient_name || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Tipo:</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${order.work_type || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Status:</p>
                        ${this.renderStatusBadge(order.status)}
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Data de Recebimento:</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${this.formatDate(order.received_date)}</p>
                    </div>
                    ${order.due_date ? `
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Previsão de Entrega:</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${this.formatDate(order.due_date)}</p>
                    </div>
                    ` : ''}
                </div>
                <div class="mt-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Descrição:</p>
                    <p class="text-gray-900 dark:text-white">${order.work_description || 'N/A'}</p>
                </div>
            </div>

            <!-- Minhas Intercorrências -->
            <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="font-bold text-lg text-gray-900 dark:text-white">
                        <i class="fas fa-exclamation-triangle text-orange-500 mr-2"></i>Minhas Intercorrências
                    </h4>
                    <button onclick="window.clientPortalApp.showAddIssueModal()" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                        <i class="fas fa-plus mr-1"></i>Nova Intercorrência
                    </button>
                </div>
                <div id="client-issues-list">
                    ${order.client_issues && order.client_issues.length > 0 ?
                order.client_issues.map(issue => this.renderIssue(issue)).join('') :
                '<p class="text-gray-500 dark:text-gray-400">Nenhuma intercorrência registrada</p>'
            }
                </div>
            </div>

            <!-- Histórico -->
            <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
                <h4 class="font-bold text-lg text-gray-900 dark:text-white mb-4">
                    <i class="fas fa-history text-blue-600 mr-2"></i>Histórico de Alterações
                </h4>
                <div class="space-y-3">
                    ${order.history && order.history.length > 0 ?
                order.history.map(h => this.renderHistoryItem(h)).join('') :
                '<p class="text-gray-500 dark:text-gray-400">Nenhum histórico disponível</p>'
            }
                </div>
            </div>
        `;
    }

    renderIssue(issue) {
        const severityColors = {
            low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
            medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
            critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        };

        return `
            <div class="bg-white dark:bg-gray-700 rounded-lg p-4 mb-3">
                <div class="flex items-start justify-between mb-2">
                    <h5 class="font-semibold text-gray-900 dark:text-white">${issue.title}</h5>
                    <span class="px-2 py-1 rounded-full text-xs font-semibold ${severityColors[issue.severity] || severityColors.low}">
                        ${issue.severity || 'Baixa'}
                    </span>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">${issue.description}</p>
                <p class="text-xs text-gray-500 dark:text-gray-500">
                    ${this.formatDate(issue.created_at)}
                </p>
            </div>
        `;
    }

    renderHistoryItem(item) {
        return `
            <div class="flex items-start space-x-3 p-3 bg-white dark:bg-gray-700 rounded-lg">
                <i class="fas fa-circle text-xs text-emerald-600 mt-1"></i>
                <div class="flex-1">
                    <p class="text-sm text-gray-900 dark:text-white">${item.change_type || 'Alteração'}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${this.formatDate(item.changed_at)}</p>
                </div>
            </div>
        `;
    }

    // =====================================================
    // ADICIONAR INTERCORRÊNCIA
    // =====================================================

    showAddIssueModal() {
        // Criar modal inline
        const modalHtml = `
            <div id="modal-add-issue-temp" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h3 class="text-2xl font-bold text-gray-900 dark:text-white">Nova Intercorrência</h3>
                    </div>
                    <form id="add-issue-form" class="p-6 space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Título *</label>
                            <input type="text" id="issue-title" required class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição *</label>
                            <textarea id="issue-description" required rows="3" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gravidade</label>
                            <select id="issue-severity" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                <option value="low">Baixa</option>
                                <option value="medium">Média</option>
                                <option value="high">Alta</option>
                                <option value="critical">Crítica</option>
                            </select>
                        </div>
                    </form>
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                        <button type="button" onclick="document.getElementById('modal-add-issue-temp').remove()" class="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all">
                            Cancelar
                        </button>
                        <button type="submit" form="add-issue-form" class="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all">
                            <i class="fas fa-check mr-2"></i>Criar Intercorrência
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Event listener para o form
        document.getElementById('add-issue-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createIssue();
        });
    }

    async createIssue() {
        try {
            const title = document.getElementById('issue-title').value;
            const description = document.getElementById('issue-description').value;
            const severity = document.getElementById('issue-severity').value;

            if (!title || !description) {
                this.showError('Por favor, preencha todos os campos obrigatórios');
                return;
            }

            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/client/orders/${this.currentOrder.id}/issues`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    severity
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao criar intercorrência');
            }

            this.showSuccess('Intercorrência criada com sucesso!');
            document.getElementById('modal-add-issue-temp').remove();
            await this.viewOrderDetails(this.currentOrder.id);

        } catch (error) {
            console.error('Erro ao criar intercorrência:', error);
            this.showError(`Erro: ${error.message}`);
        }
    }

    // =====================================================
    // UTILIDADES
    // =====================================================

    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        };

        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in`;
        toast.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Inicializar app quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Verificar dark mode salvo
    if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.classList.add('dark');
    }

    // Aguardar authManager estar pronto
    const checkAuth = setInterval(() => {
        if (window.authManager && window.authManager.isUserAuthenticated()) {
            clearInterval(checkAuth);
            window.clientPortalApp = new ClientPortalApp();
            window.clientPortalApp.init();
        }
    }, 100);
});

