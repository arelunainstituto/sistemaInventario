// =====================================================
// PROSTORAL - SISTEMA DE ORDENS DE SERVIÇO
// =====================================================

class ProstoralOrdersApp {
    constructor() {
        this.orders = [];
        this.clients = [];
        this.technicians = [];
        this.inventory = [];
        this.kits = [];
        this.currentOrder = null;
        this.currentTimeTracking = null;
        this.timerInterval = null;
        this.apiBaseUrl = '/api/prostoral';
        this.accessibleIssueIds = []; // IDs das intercorrências acessíveis (para filtrar histórico)

        // Realtime subscriptions
        this.realtimeSubscriptions = [];

        // Filtros
        this.filters = {
            search: '',
            status: '',
            technician_id: '',
            date_from: '',
            date_to: ''
        };

        // Paginação
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.totalPages = 1;
    }

    async init() {
        console.log('Inicializando módulo de Ordens de Serviço...');

        // Aguardar authManager estar pronto
        if (!window.authManager || !window.authManager.isUserAuthenticated()) {
            console.error('Usuário não autenticado');
            return;
        }

        // Carregar dados iniciais
        await this.loadInitialData();

        // Setup event listeners
        this.setupEventListeners();

        // Carregar ordens
        await this.loadOrders();

        // Iniciar subscriptions real-time
        this.setupRealtimeSubscriptions();

        console.log('Módulo de Ordens de Serviço inicializado!');
    }

    async loadInitialData() {
        try {
            const token = await window.authManager.getAccessToken();

            // Carregar clientes
            const clientsRes = await fetch(`${this.apiBaseUrl}/clients?is_active=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const clientsData = await clientsRes.json();
            this.clients = clientsData.clients || [];

            // Carregar kits
            const kitsRes = await fetch(`${this.apiBaseUrl}/kits`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const kitsData = await kitsRes.json();
            this.kits = kitsData.kits || [];

            // Carregar inventário (Produtos do Laboratório)
            // Usando endpoint novo e limite alto para dropdown
            const inventoryRes = await fetch(`/api/laboratorio/produtos?limit=1000`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const inventoryData = await inventoryRes.json();
            this.inventory = inventoryData.data || [];

            // Povoar selects
            this.populateClientSelect();
            this.populateKitSelect();
            this.populateInventorySelect();

        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
        }
    }


    setupEventListeners() {
        // Botão Nova OS
        const btnNewOrder = document.getElementById('btn-new-order');
        if (btnNewOrder) {
            btnNewOrder.addEventListener('click', () => this.showCreateOrderModal());
        }

        // Botão Salvar OS
        const btnSaveOrder = document.getElementById('btn-save-order');
        if (btnSaveOrder) {
            btnSaveOrder.addEventListener('click', () => this.saveOrder());
        }

        // Filtros
        const searchInput = document.getElementById('order-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.filters.search = searchInput.value;
                this.currentPage = 1;
                this.loadOrders();
            }, 300));
        }

        const statusFilter = document.getElementById('order-filter-status');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.currentPage = 1;
                this.loadOrders();
            });
        }

        const technicianFilter = document.getElementById('order-filter-technician');
        if (technicianFilter) {
            technicianFilter.addEventListener('change', (e) => {
                this.filters.technician_id = e.target.value;
                this.currentPage = 1;
                this.loadOrders();
            });
        }

        // Paginação
        const btnPrevPage = document.getElementById('btn-prev-page');
        const btnNextPage = document.getElementById('btn-next-page');

        if (btnPrevPage) {
            btnPrevPage.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadOrders();
                }
            });
        }

        if (btnNextPage) {
            btnNextPage.addEventListener('click', () => {
                if (this.currentPage < this.totalPages) {
                    this.currentPage++;
                    this.loadOrders();
                }
            });
        }

        // Botões de ação dos modais
        const btnConfirmAddKit = document.getElementById('btn-confirm-add-kit');
        if (btnConfirmAddKit) {
            btnConfirmAddKit.addEventListener('click', () => this.addKitToOrder());
        }

        const btnConfirmAddMaterial = document.getElementById('btn-confirm-add-material');
        if (btnConfirmAddMaterial) {
            btnConfirmAddMaterial.addEventListener('click', () => this.addMaterialToOrder());
        }

        const btnStartWork = document.getElementById('btn-start-work');
        if (btnStartWork) {
            btnStartWork.addEventListener('click', () => this.startWork());
        }

        // Botões do modal de adicionar etapa
        const btnSaveStage = document.getElementById('btn-save-stage');
        if (btnSaveStage) {
            btnSaveStage.addEventListener('click', () => this.saveNewStage());
        }

        const btnCancelStage = document.getElementById('btn-cancel-stage');
        if (btnCancelStage) {
            btnCancelStage.addEventListener('click', () => this.closeAddStageModal());
        }

        // Enter no input de nova etapa
        const newStageInput = document.getElementById('new-stage-name');
        if (newStageInput) {
            newStageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveNewStage();
                }
            });
        }

        // Detectar quando seleciona "Adicionar etapa" no dropdown
        const workStageSelect = document.getElementById('work-stage');
        if (workStageSelect) {
            workStageSelect.addEventListener('change', (e) => {
                if (e.target.value === '__add_new__') {
                    this.showAddStageModal();
                    // Resetar select para vazio
                    e.target.value = '';
                }
            });
        }

        // Botão Scanner QR
        const btnScanQr = document.getElementById('btn-scan-qr');
        if (btnScanQr) {
            btnScanQr.addEventListener('click', () => this.openQrScanner());
        }

        const btnCloseQrScanner = document.getElementById('btn-close-qr-scanner');
        if (btnCloseQrScanner) {
            btnCloseQrScanner.addEventListener('click', () => this.closeQrScanner());
        }

        // Botão Confirmar Criar OS de Reparo
        const btnConfirmCreateRepair = document.getElementById('btn-confirm-create-repair');
        if (btnConfirmCreateRepair) {
            btnConfirmCreateRepair.addEventListener('click', () => this.createRepairOrder());
        }

        // Botões de fechar modais
        this.setupModalCloseButtons();

        // Manipuladores de Anexos
        this.setupAttachmentHandlers();
    }

    setupModalCloseButtons() {
        // Modal de detalhes da ordem
        const modalDetailsCloseButtons = document.querySelectorAll('[data-close-modal="modal-order-details"]');
        modalDetailsCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modal-order-details'));
        });

        // Modal de criar/editar ordem
        const modalFormCloseButtons = document.querySelectorAll('[data-close-modal="modal-order-form"]');
        modalFormCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modal-order-form'));
        });

        // Modal de adicionar kit
        const modalKitCloseButtons = document.querySelectorAll('[data-close-modal="modal-add-kit"]');
        modalKitCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modal-add-kit'));
        });

        // Modal de adicionar material
        const modalMaterialCloseButtons = document.querySelectorAll('[data-close-modal="modal-add-material"]');
        modalMaterialCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modal-add-material'));
        });

        // Modal de iniciar trabalho
        const modalWorkCloseButtons = document.querySelectorAll('[data-close-modal="modal-start-work"]');
        modalWorkCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modal-start-work'));
        });

        // Modal de adicionar intercorrência
        const modalIssueCloseButtons = document.querySelectorAll('[data-close-modal="modal-add-issue"]');
        modalIssueCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modal-add-issue'));
        });

        // Modal de criar OS de reparo
        const modalRepairCloseButtons = document.querySelectorAll('[data-close-modal="modal-create-repair"]');
        modalRepairCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modal-create-repair'));
        });
    }

    setupDetailsActionButtons() {
        // Botões que abrem modais
        const btnShowAddKit = document.getElementById('btn-show-add-kit');
        if (btnShowAddKit) {
            btnShowAddKit.replaceWith(btnShowAddKit.cloneNode(true)); // Remove listeners antigos
            document.getElementById('btn-show-add-kit').addEventListener('click', () => this.showAddKitModal());
        }

        const btnShowAddMaterial = document.getElementById('btn-show-add-material');
        if (btnShowAddMaterial) {
            btnShowAddMaterial.replaceWith(btnShowAddMaterial.cloneNode(true)); // Remove listeners antigos
            document.getElementById('btn-show-add-material').addEventListener('click', () => this.showAddMaterialModal());
        }

        const btnShowStartWork = document.getElementById('btn-show-start-work');
        if (btnShowStartWork) {
            btnShowStartWork.replaceWith(btnShowStartWork.cloneNode(true)); // Remove listeners antigos
            document.getElementById('btn-show-start-work').addEventListener('click', () => this.showStartWorkModal());
        }

        const btnShowAddIssue = document.getElementById('btn-show-add-issue');
        if (btnShowAddIssue) {
            btnShowAddIssue.replaceWith(btnShowAddIssue.cloneNode(true)); // Remove listeners antigos
            document.getElementById('btn-show-add-issue').addEventListener('click', () => this.showAddIssueModal());
        }

        const btnCreateRepair = document.getElementById('btn-create-repair');
        if (btnCreateRepair) {
            btnCreateRepair.replaceWith(btnCreateRepair.cloneNode(true)); // Remove listeners antigos
            document.getElementById('btn-create-repair').addEventListener('click', () => this.showCreateRepairModal());
        }

        const btnConfirmAddIssue = document.getElementById('btn-confirm-add-issue');
        if (btnConfirmAddIssue) {
            btnConfirmAddIssue.replaceWith(btnConfirmAddIssue.cloneNode(true)); // Remove listeners antigos
            document.getElementById('btn-confirm-add-issue').addEventListener('click', () => this.saveIssue());
        }

        // Auto-preencher custo e unidade ao selecionar produto
        const materialSelect = document.getElementById('material-item-id');
        if (materialSelect) {
            materialSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const cost = selectedOption.getAttribute('data-cost') || '0';
                const unit = selectedOption.getAttribute('data-unit') || 'un';

                const costInput = document.getElementById('material-unit-cost');
                const unitInput = document.getElementById('material-unit');

                if (costInput) costInput.value = cost;
                if (unitInput) unitInput.value = unit;
            });
        }

        // Botões de remover material
        document.querySelectorAll('.btn-remove-material').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const materialId = e.currentTarget.getAttribute('data-material-id');
                if (materialId) {
                    await this.removeMaterial(materialId);
                }
            });
        });

        // Botões de controle de tempo
        const btnPauseWork = document.getElementById('btn-pause-work');
        if (btnPauseWork) {
            btnPauseWork.replaceWith(btnPauseWork.cloneNode(true));
            document.getElementById('btn-pause-work').addEventListener('click', () => this.pauseWork());
        }

        const btnResumeWork = document.getElementById('btn-resume-work');
        if (btnResumeWork) {
            btnResumeWork.replaceWith(btnResumeWork.cloneNode(true));
            document.getElementById('btn-resume-work').addEventListener('click', () => this.resumeWork());
        }

        const btnFinishWork = document.getElementById('btn-finish-work');
        if (btnFinishWork) {
            btnFinishWork.replaceWith(btnFinishWork.cloneNode(true));
            document.getElementById('btn-finish-work').addEventListener('click', () => this.finishWork());
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
    // LISTA DE ORDENS
    // =====================================================

    async loadOrders(force = false) {
        // Cache Check
        if (!force && this.orders && this.orders.length > 0) {
            console.log('📦 Usando cache de ordens');
            this.renderOrdersTable();
            this.updatePagination();
            return;
        }

        try {
            const token = await window.authManager.getAccessToken();

            // Construir query params
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                ...this.filters
            });

            const response = await fetch(`${this.apiBaseUrl}/orders?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar ordens');
            }

            const data = await response.json();

            if (data.success) {
                this.orders = data.orders || [];
                this.totalPages = data.pagination?.totalPages || 1;
                this.renderOrdersTable();
                this.updatePagination();
            }

        } catch (error) {
            console.error('Erro ao carregar ordens:', error);
            this.showError('Erro ao carregar ordens de serviço');
        }
    }

    renderOrdersTable() {
        const tbody = document.getElementById('orders-table-body');
        if (!tbody) return;

        if (this.orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-12 text-center text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-2"></i>
                        <p>Nenhuma ordem de serviço encontrada</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.orders.map(order => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${this.escapeHtml(order.order_number || '-')}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">${this.escapeHtml(order.client?.name || 'Sem cliente')}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">${this.escapeHtml(order.patient_name || 'Sem paciente')}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${this.renderStatusBadge(order.status)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${this.formatDate(order.created_at)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${this.formatCurrency(order.total_cost || 0)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    ${this.renderQuickActions(order)}
                    <button data-action="view" data-order-id="${order.id}"
                            class="btn-order-action text-blue-600 hover:text-blue-900 mr-3" 
                            title="Ver Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${order.status !== 'delivered' && order.status !== 'cancelled' ? `
                        <button data-action="edit" data-order-id="${order.id}"
                                class="btn-order-action text-emerald-600 hover:text-emerald-900 mr-3" 
                                title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button data-action="delete" data-order-id="${order.id}"
                                class="btn-order-action text-red-600 hover:text-red-900" 
                                title="Cancelar">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : `
                        <span class="text-gray-400 text-xs italic">
                            <i class="fas fa-lock mr-1"></i>Finalizada
                        </span>
                    `}
                </td>
            </tr>
        `).join('');

        // Adicionar event listeners aos botões de ação
        setTimeout(() => {
            document.querySelectorAll('.btn-order-action').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = e.currentTarget.dataset.action;
                    const orderId = e.currentTarget.dataset.orderId;

                    if (action === 'view') {
                        this.viewOrderDetails(orderId);
                    } else if (action === 'edit') {
                        this.editOrder(orderId);
                    } else if (action === 'delete') {
                        this.deleteOrder(orderId);
                    } else if (action === 'quick-status') {
                        const newStatus = e.currentTarget.dataset.newStatus;
                        this.quickStatusChange(orderId, newStatus);
                    }
                });
            });
        }, 0);
    }

    renderStatusBadge(status) {
        const statusConfig = {
            'received': { color: 'gray', icon: 'inbox', text: 'Recebido' },
            'design': { color: 'purple', icon: 'pencil-ruler', text: 'Design' },
            'production': { color: 'blue', icon: 'cogs', text: 'Produção' },
            'finishing': { color: 'indigo', icon: 'paint-brush', text: 'Acabamento' },
            'quality_control': { color: 'yellow', icon: 'check-circle', text: 'Controle de Qualidade' },
            'delivered': { color: 'green', icon: 'check-double', text: 'Entregue' },
            'cancelled': { color: 'red', icon: 'times', text: 'Cancelado' }
        };

        const config = statusConfig[status] || statusConfig['received'];

        return `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800">
                <i class="fas fa-${config.icon} mr-1"></i>
                ${config.text}
            </span>
        `;
    }

    renderQuickActions(order) {
        // Não mostrar ações rápidas se já estiver entregue ou cancelada
        if (order.status === 'delivered' || order.status === 'cancelled') {
            return '';
        }

        let buttonHtml = '';

        // Recebido → Aceito (Design)
        if (order.status === 'received') {
            buttonHtml = `
                <button data-action="quick-status" data-order-id="${order.id}" data-new-status="design"
                        class="btn-order-action inline-flex items-center px-2 py-1 mr-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors" 
                        title="Aceitar ordem">
                    <i class="fas fa-check mr-1"></i>Aceito
                </button>
            `;
        }
        // Design ou Acabamento ou CQ → Produção
        else if (order.status === 'design' || order.status === 'finishing' || order.status === 'quality_control') {
            buttonHtml = `
                <button data-action="quick-status" data-order-id="${order.id}" data-new-status="production"
                        class="btn-order-action inline-flex items-center px-2 py-1 mr-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors" 
                        title="Colocar em Produção">
                    <i class="fas fa-cogs mr-1"></i>Produção
                </button>
            `;
        }
        // Produção → Finalizado (Entregue)
        else if (order.status === 'production') {
            buttonHtml = `
                <button data-action="quick-status" data-order-id="${order.id}" data-new-status="delivered"
                        class="btn-order-action inline-flex items-center px-2 py-1 mr-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors" 
                        title="Finalizar ordem">
                    <i class="fas fa-check-double mr-1"></i>Finalizado
                </button>
            `;
        }

        return buttonHtml;
    }

    renderModalQuickActions(order) {
        const container = document.getElementById('modal-quick-actions');
        if (!container) return;

        // Não mostrar ações rápidas se já estiver entregue ou cancelada
        if (order.status === 'delivered' || order.status === 'cancelled') {
            container.innerHTML = '';
            return;
        }

        let buttonHtml = '';

        // Recebido → Aceito (Design)
        if (order.status === 'received') {
            buttonHtml = `
                <button data-action="modal-quick-status" data-order-id="${order.id}" data-new-status="design"
                        class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm" 
                        title="Aceitar ordem">
                    <i class="fas fa-check mr-1.5"></i>Aceito
                </button>
            `;
        }
        // Design ou Acabamento ou CQ → Produção
        else if (order.status === 'design' || order.status === 'finishing' || order.status === 'quality_control') {
            buttonHtml = `
                <button data-action="modal-quick-status" data-order-id="${order.id}" data-new-status="production"
                        class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm" 
                        title="Colocar em Produção">
                    <i class="fas fa-cogs mr-1.5"></i>Produção
                </button>
            `;
        }
        // Produção → Finalizado (Entregue)
        else if (order.status === 'production') {
            buttonHtml = `
                <button data-action="modal-quick-status" data-order-id="${order.id}" data-new-status="delivered"
                        class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm" 
                        title="Finalizar ordem">
                    <i class="fas fa-check-double mr-1.5"></i>Finalizado
                </button>
            `;
        }

        container.innerHTML = buttonHtml;

        // Adicionar event listeners aos botões do modal
        setTimeout(() => {
            container.querySelectorAll('[data-action="modal-quick-status"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const orderId = e.currentTarget.dataset.orderId;
                    const newStatus = e.currentTarget.dataset.newStatus;
                    this.quickStatusChange(orderId, newStatus);
                });
            });
        }, 0);
    }

    updatePagination() {
        const pageInfo = document.getElementById('page-info');
        if (pageInfo) {
            pageInfo.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
        }

        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');

        if (btnPrev) {
            btnPrev.disabled = this.currentPage === 1;
            btnPrev.classList.toggle('opacity-50', this.currentPage === 1);
        }

        if (btnNext) {
            btnNext.disabled = this.currentPage >= this.totalPages;
            btnNext.classList.toggle('opacity-50', this.currentPage >= this.totalPages);
        }
    }

    // =====================================================
    // CRIAR/EDITAR ORDEM
    // =====================================================

    showCreateOrderModal() {
        this.currentOrder = null;
        const modal = document.getElementById('modal-order-form');
        if (modal) {
            // Limpar formulário
            document.getElementById('order-form').reset();
            document.getElementById('modal-order-title').textContent = 'Nova Ordem de Serviço';
            modal.classList.remove('hidden');
        }
    }

    async editOrder(orderId) {
        try {
            const token = await window.authManager.getAccessToken();

            const response = await fetch(`${this.apiBaseUrl}/orders/${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar ordem');
            }

            const data = await response.json();

            if (data.success && data.order) {
                this.currentOrder = data.order;
                this.populateOrderForm(data.order);

                const modal = document.getElementById('modal-order-form');
                if (modal) {
                    document.getElementById('modal-order-title').textContent = 'Editar Ordem de Serviço';
                    modal.classList.remove('hidden');
                }
            }

        } catch (error) {
            console.error('Erro ao carregar ordem:', error);
            this.showError('Erro ao carregar ordem');
        }
    }

    populateOrderForm(order) {
        document.getElementById('order-client-id').value = order.client_id || '';
        document.getElementById('order-patient-name').value = order.patient_name || '';
        document.getElementById('order-work-type').value = order.work_type || '';
        document.getElementById('order-work-description').value = order.work_description || '';

        // Formatar data para datetime-local (YYYY-MM-DDTHH:mm)
        if (order.due_date) {
            const date = new Date(order.due_date);
            // Format: YYYY-MM-DDTHH:mm
            const formatted = date.toISOString().slice(0, 16);
            document.getElementById('order-expected-delivery').value = formatted;
        } else {
            document.getElementById('order-expected-delivery').value = '';
        }

        document.getElementById('order-final-price').value = order.final_price || '';
        document.getElementById('order-status').value = order.status || 'pending';
    }

    async saveOrder() {
        try {
            // Bloquear edição de OS finalizada ou cancelada
            if (this.currentOrder && (this.currentOrder.status === 'delivered' || this.currentOrder.status === 'cancelled')) {
                this.showError('🔒 Não é possível editar uma ordem finalizada ou cancelada!');
                return;
            }

            const token = await window.authManager.getAccessToken();

            const workType = document.getElementById('order-work-type').value;

            const formData = {
                client_id: document.getElementById('order-client-id').value,
                patient_name: document.getElementById('order-patient-name').value,
                work_type: workType || null, // Adicionar work_type como campo separado
                work_description: document.getElementById('order-work-description').value,
                due_date: document.getElementById('order-expected-delivery').value || null,
                final_price: parseFloat(document.getElementById('order-final-price').value) || 0,
                status: document.getElementById('order-status').value
            };

            // Validações
            if (!formData.client_id || !formData.patient_name || !formData.work_description) {
                this.showError('Por favor, preencha todos os campos obrigatórios');
                return;
            }

            const url = this.currentOrder
                ? `${this.apiBaseUrl}/orders/${this.currentOrder.id}`
                : `${this.apiBaseUrl}/orders`;

            const method = this.currentOrder ? 'PUT' : 'POST';

            console.log('📤 Enviando dados:', formData);

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Erro na resposta:', errorData);
                throw new Error(errorData.error || errorData.details || 'Erro ao salvar ordem');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess(this.currentOrder ? 'Ordem atualizada com sucesso!' : 'Ordem criada com sucesso!');
                this.closeModal('modal-order-form');
                await this.loadOrders(true);
            }

        } catch (error) {
            console.error('❌ Erro ao salvar ordem:', error);
            this.showError(error.message || 'Erro ao salvar ordem');
        }
    }

    async deleteOrder(orderId) {
        if (!confirm('Tem certeza que deseja cancelar esta ordem?')) {
            return;
        }

        try {
            const token = await window.authManager.getAccessToken();

            const response = await fetch(`${this.apiBaseUrl}/orders/${orderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao cancelar ordem');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Ordem cancelada com sucesso!');
                await this.loadOrders(true);
            }

        } catch (error) {
            console.error('Erro ao cancelar ordem:', error);
            this.showError('Erro ao cancelar ordem');
        }
    }

    async quickStatusChange(orderId, newStatus) {
        // Mensagens de confirmação baseadas no status
        const confirmMessages = {
            'design': '✅ Aceitar esta ordem?',
            'production': '🔧 Colocar esta ordem em Produção?',
            'delivered': '✅ Finalizar esta ordem?'
        };

        const message = confirmMessages[newStatus] || 'Deseja alterar o status desta ordem?';

        if (!confirm(message)) {
            return;
        }

        try {
            const token = await window.authManager.getAccessToken();

            const response = await fetch(`${this.apiBaseUrl}/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao atualizar status');
            }

            const data = await response.json();

            if (data.success) {
                const successMessages = {
                    'design': '✅ Ordem aceita com sucesso!',
                    'production': '🔧 Ordem colocada em Produção!',
                    'delivered': '✅ Ordem finalizada com sucesso!'
                };

                this.showSuccess(successMessages[newStatus] || 'Status atualizado com sucesso!');

                // 1. OTIMIZAÇÃO: Atualizar localmente e re-renderizar tabela IMEDIATAMENTE
                if (this.orders) {
                    const localOrder = this.orders.find(o => o.id === orderId);
                    if (localOrder) {
                        localOrder.status = newStatus;
                        this.renderOrdersTable();
                    }
                }

                // 2. Se estiver com modal aberto, atualizar detalhes via API (para pegar logs etc)
                if (this.currentOrder && this.currentOrder.id === orderId) {
                    this.currentOrder.status = newStatus; // Visual imediato no modal

                    // UPDATE VISUAL IMEDIATO DO BADGE
                    const badgeEl = document.getElementById('detail-status');
                    if (badgeEl) {
                        badgeEl.innerHTML = this.renderStatusBadge(newStatus);
                    }

                    // Limpar ações antigas imediatamente para evitar cliques duplos
                    const actionsEl = document.getElementById('modal-quick-actions');
                    if (actionsEl) {
                        actionsEl.innerHTML = '';
                    }

                    await this.viewOrderDetails(orderId);
                }

                // 3. Atualizar dados reais do servidor em background
                this.loadOrders(true).catch(console.error);
            }

        } catch (error) {
            console.error('❌ Erro ao atualizar status:', error);
            this.showError(error.message || 'Erro ao atualizar status');
        }
    }

    // =====================================================
    // DETALHES DA ORDEM
    // =====================================================

    async viewOrderDetails(orderId) {
        try {
            console.log('📦 Carregando detalhes da OS:', orderId);
            const token = await window.authManager.getAccessToken();
            console.log('🔑 Token obtido:', token ? 'OK' : 'FALHOU');

            const url = `${this.apiBaseUrl}/orders/${orderId}`;
            console.log('🌐 URL completa:', url);

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log('📡 Status da resposta:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro na resposta:', errorText);
                throw new Error(`Erro ${response.status}: ${errorText || 'Erro ao carregar detalhes'}`);
            }

            const data = await response.json();
            console.log('✅ Dados recebidos:', data);

            if (data.success && data.order) {
                this.currentOrder = data.order;
                this.userNames = data.userNames || {}; // Guardar nomes de usuários
                this.renderOrderDetails(data.order);

                // Configurar event listeners dos botões de ação
                this.setupDetailsActionButtons();

                const modal = document.getElementById('modal-order-details');
                if (modal) {
                    modal.classList.remove('hidden');
                }

                // Gerar QR Code
                this.generateOrderQRCode(data.order);
            }

        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            this.showError('Erro ao carregar detalhes da ordem');
        }
    }

    renderOrderDetails(order) {
        // Informações gerais
        document.getElementById('detail-order-number').textContent = order.order_number || '-';
        document.getElementById('detail-client-name').textContent = order.client?.name || 'Cliente não especificado';
        document.getElementById('detail-patient-name').textContent = order.patient_name || 'Paciente não especificado';
        document.getElementById('detail-work-type').textContent = order.work_type || 'Tipo não especificado';
        document.getElementById('detail-work-description').textContent = order.work_description || 'Sem descrição';
        document.getElementById('detail-status').innerHTML = this.renderStatusBadge(order.status);
        document.getElementById('detail-total-cost').textContent = this.formatCurrency(order.total_cost || 0);
        document.getElementById('detail-final-price').textContent = this.formatCurrency(order.final_price || 0);

        // Ações Rápidas dentro do Modal
        this.renderModalQuickActions(order);

        // Materiais
        this.renderOrderMaterials(order.materials || []);

        // Time tracking - passar order completo para calcular tempo em produção
        this.renderOrderTimeTracking(order.time_tracking || [], order.history || [], order.status);

        // Reparos vinculados
        this.renderOrderRepairs(order);

        // Anexos
        this.renderAttachments(order.attachments || []);

        // Intercorrências - guardar IDs acessíveis para filtrar histórico
        this.accessibleIssueIds = (order.issues || []).map(issue => issue.id);
        this.renderOrderIssues(order.issues || []);

        // Histórico - filtrar baseado em intercorrências acessíveis
        this.renderOrderHistory(order.history || []);
    }

    renderOrderMaterials(materials) {
        const container = document.getElementById('order-materials-list');
        if (!container) return;

        if (materials.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Nenhum material adicionado</p>';
            return;
        }

        container.innerHTML = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Custo Unit.</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ação</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${materials.map(m => `
                        <tr>
                            <td class="px-4 py-2 text-sm">${this.escapeHtml(m.produto?.nome_material || m.inventory_item?.name || 'Material não identificado')}</td>
                            <td class="px-4 py-2 text-sm">${m.used_quantity} ${m.unit || ''}</td>
                            <td class="px-4 py-2 text-sm">${this.formatCurrency(m.unit_cost || 0)}</td>
                            <td class="px-4 py-2 text-sm font-medium">${this.formatCurrency(m.total_cost || 0)}</td>
                            <td class="px-4 py-2 text-sm">
                                ${m.from_kit_id ? `<span class="text-blue-600"><i class="fas fa-box"></i> Kit</span>` : '<span class="text-gray-600">Manual</span>'}
                            </td>
                            <td class="px-4 py-2 text-right">
                                <button data-action="remove-material" data-material-id="${m.id}" class="btn-remove-material text-red-600 hover:text-red-900 text-sm" title="Remover">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // =====================================================
    // GESTÃO DE MATERIAIS
    // =====================================================

    showAddKitModal() {
        const modal = document.getElementById('modal-add-kit');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    showAddMaterialModal() {
        const modal = document.getElementById('modal-add-material');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    async addKitToOrder() {
        if (!this.currentOrder) {
            this.showError('Nenhuma ordem selecionada');
            return;
        }

        try {
            const kitId = document.getElementById('material-kit-id').value;

            if (!kitId) {
                this.showError('Por favor, selecione um kit');
                return;
            }

            const token = await window.authManager.getAccessToken();

            const response = await fetch(`${this.apiBaseUrl}/orders/${this.currentOrder.id}/materials/kit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ kit_id: kitId })
            });

            if (!response.ok) {
                throw new Error('Erro ao adicionar kit');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Kit adicionado com sucesso!');
                this.closeModal('modal-add-kit');

                // Recarregar detalhes da ordem
                await this.viewOrderDetails(this.currentOrder.id);
            }

        } catch (error) {
            console.error('Erro ao adicionar kit:', error);
            this.showError('Erro ao adicionar kit');
        }
    }

    async addMaterialToOrder() {
        if (!this.currentOrder) {
            this.showError('Nenhuma ordem selecionada');
            return;
        }

        try {
            const itemId = document.getElementById('material-item-id').value;
            const quantity = parseFloat(document.getElementById('material-quantity').value);
            const unitCost = parseFloat(document.getElementById('material-unit-cost').value) || 0;
            const unit = document.getElementById('material-unit').value;
            const notes = document.getElementById('material-notes').value;

            if (!itemId || !quantity) {
                this.showError('Por favor, selecione um produto e informe a quantidade');
                return;
            }

            const token = await window.authManager.getAccessToken();

            const response = await fetch(`${this.apiBaseUrl}/orders/${this.currentOrder.id}/materials`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inventory_item_id: itemId,
                    used_quantity: quantity,
                    unit_cost: unitCost,
                    unit: unit,
                    notes: notes
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao adicionar material');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Material adicionado com sucesso!');
                this.closeModal('modal-add-material');

                // Limpar formulário
                document.getElementById('material-item-id').value = '';
                document.getElementById('material-quantity').value = '1';
                document.getElementById('material-unit-cost').value = '';
                document.getElementById('material-unit').value = '';
                document.getElementById('material-notes').value = '';

                // Recarregar detalhes da ordem
                await this.viewOrderDetails(this.currentOrder.id);
            }

        } catch (error) {
            console.error('Erro ao adicionar material:', error);
            this.showError('Erro ao adicionar material');
        }
    }

    async removeMaterial(materialId) {
        if (!confirm('Tem certeza que deseja remover este material?')) {
            return;
        }

        if (!this.currentOrder) {
            this.showError('Nenhuma ordem selecionada');
            return;
        }

        try {
            const token = await window.authManager.getAccessToken();

            const response = await fetch(`${this.apiBaseUrl}/orders/${this.currentOrder.id}/materials/${materialId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao remover material');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Material removido com sucesso!');

                // Recarregar detalhes da ordem
                await this.viewOrderDetails(this.currentOrder.id);
            }

        } catch (error) {
            console.error('Erro ao remover material:', error);
            this.showError('Erro ao remover material');
        }
    }

    renderOrderTimeTracking(tracking, history = [], currentStatus = '') {
        const container = document.getElementById('order-time-tracking-list');
        if (!container) return;

        // Verificar se há tracking ativo
        const activeTracking = tracking.find(t => t.status === 'in_progress' || t.status === 'paused');
        if (activeTracking) {
            this.currentTimeTracking = activeTracking;
            this.showActiveTimer(activeTracking);
        } else {
            this.hideActiveTimer();
        }

        // Calcular tempo em produção (desde status production até delivered/cancelled)
        let productionTimeHtml = '';

        const productionStart = history.find(h =>
            h.change_type === 'status_change' &&
            h.new_status === 'production'
        );

        if (productionStart) {
            const startDate = new Date(productionStart.changed_at);
            let endDate = new Date();

            // Se já foi finalizada, usar a data de finalização
            const deliveredChange = history.find(h =>
                h.change_type === 'status_change' &&
                (h.new_status === 'delivered' || h.new_status === 'cancelled')
            );

            if (deliveredChange) {
                endDate = new Date(deliveredChange.changed_at);
            }

            // Calcular diferença em minutos
            const diffMs = endDate - startDate;
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMinutes / 60);
            const diffMins = diffMinutes % 60;
            const diffDays = Math.floor(diffHours / 24);
            const remainingHours = diffHours % 24;

            let productionTimeDisplay = '';
            if (diffDays > 0) {
                productionTimeDisplay = `${diffDays}d ${remainingHours}h ${diffMins}min`;
            } else if (diffHours > 0) {
                productionTimeDisplay = `${diffHours}h ${diffMins}min`;
            } else {
                productionTimeDisplay = `${diffMins}min`;
            }

            const isFinished = deliveredChange ? true : false;
            const statusText = isFinished ? 'Tempo Total em Produção' : 'Tempo em Produção (Em andamento)';

            // Classes CSS fixas para Tailwind
            const bgClass = isFinished
                ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/30 border-2 border-emerald-300 dark:border-emerald-700'
                : 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 border-2 border-blue-300 dark:border-blue-700';

            const textClass = isFinished
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-blue-600 dark:text-blue-400';

            productionTimeHtml = `
                <!-- Tempo em Produção -->
                <div class="${bgClass} rounded-lg p-4 mb-4">
                    <div class="text-center">
                        <p class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">
                            <i class="fas fa-clock mr-1"></i>${statusText}
                        </p>
                        <p class="text-4xl font-black ${textClass}">${productionTimeDisplay}</p>
                        <p class="text-xs text-gray-600 dark:text-gray-400 mt-2">
                            <i class="fas fa-play-circle mr-1"></i>Iniciado: ${this.formatDateTime(productionStart.changed_at)}
                            ${deliveredChange ? `<br><i class="fas fa-check-circle mr-1"></i>Finalizado: ${this.formatDateTime(deliveredChange.changed_at)}` : ''}
                        </p>
                    </div>
                </div>
            `;
        }

        if (tracking.length === 0) {
            container.innerHTML = productionTimeHtml + '<p class="text-gray-500 text-sm">Nenhum registro de tempo de trabalho</p>';
            return;
        }

        // Calcular tempo total trabalhado
        const totalMinutes = tracking.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);

        // Agrupar por fase
        const byStage = {};
        tracking.forEach(t => {
            const stage = t.stage || 'Não especificado';
            if (!byStage[stage]) {
                byStage[stage] = { minutes: 0, cost: 0, records: [] };
            }
            byStage[stage].minutes += (t.duration_minutes || 0);
            byStage[stage].cost += (t.labor_cost || 0);
            byStage[stage].records.push(t);
        });

        // Converter minutos em formato legível
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;

        let timeDisplay = '';
        if (days > 0) {
            timeDisplay = `${days}d ${remainingHours}h ${mins}min`;
        } else if (hours > 0) {
            timeDisplay = `${hours}h ${mins}min`;
        } else {
            timeDisplay = `${mins}min`;
        }

        let html = productionTimeHtml + `
            <!-- Resumo Tempo Trabalhado -->
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-4">
                <div class="text-center">
                    <p class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        <i class="fas fa-user-clock mr-1"></i>Tempo Efetivamente Trabalhado
                    </p>
                    <p class="text-3xl font-bold text-purple-600 dark:text-purple-400">${timeDisplay}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${tracking.length} ${tracking.length === 1 ? 'período' : 'períodos'} de trabalho</p>
                </div>
            </div>

            <!-- Resumo por Fase -->
            ${Object.keys(byStage).length > 1 ? `
                <div class="mb-4 space-y-2">
                    <p class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Por Fase:</p>
                    ${Object.entries(byStage).map(([stage, data]) => {
            const stageHours = Math.floor(data.minutes / 60);
            const stageMins = data.minutes % 60;
            const stageTime = stageHours > 0 ? `${stageHours}h ${stageMins}min` : `${stageMins}min`;
            return `
                            <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <p class="font-medium text-sm text-gray-900 dark:text-gray-100">${this.escapeHtml(this.formatStage(stage))}</p>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">${data.records.length} ${data.records.length === 1 ? 'período' : 'períodos'}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-lg font-bold text-blue-600 dark:text-blue-400">${stageTime}</p>
                                        <p class="text-xs text-gray-600 dark:text-gray-400">${this.formatCurrency(data.cost)}</p>
                                    </div>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            ` : ''}

            <!-- Detalhes de Cada Período -->
            <div class="space-y-3">
                <p class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Detalhes dos Períodos:</p>
                ${tracking.map((t, index) => `
                    <div class="border-l-4 border-blue-500 bg-white dark:bg-gray-800 rounded-r-lg shadow-sm hover:shadow-md transition-shadow pl-4 pr-3 py-3">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-bold">
                                        ${index + 1}
                                    </span>
                                    <p class="font-semibold text-sm text-gray-900 dark:text-gray-100">${this.escapeHtml(this.formatStage(t.stage))}</p>
                                </div>
                                <p class="text-xs text-gray-500 dark:text-gray-400 ml-8">
                                    <i class="fas fa-user-circle mr-1"></i>
                                    Técnico: ${this.getUserName(t.technician_id)}
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 ml-8">
                                    <i class="fas fa-clock mr-1"></i>
                                    ${this.formatDateTime(t.started_at)} 
                                    ${t.finished_at ? `→ ${this.formatDateTime(t.finished_at)}` : '<span class="text-green-600 dark:text-green-400 font-medium">(Em andamento)</span>'}
                                </p>
                            </div>
                            <div class="text-right ml-4">
                                <p class="text-lg font-bold text-blue-600 dark:text-blue-400">${t.duration_minutes || 0} min</p>
                                <p class="text-xs text-gray-600 dark:text-gray-400">${this.formatCurrency(t.labor_cost || 0)}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    // =====================================================
    // TIME TRACKING
    // =====================================================

    showStartWorkModal() {
        const modal = document.getElementById('modal-start-work');
        if (modal) {
            // Carregar etapas customizadas
            this.populateStageDropdown();

            // Limpar seleção
            const select = document.getElementById('work-stage');
            if (select) {
                select.value = '';

                // Re-adicionar listener para detectar "Adicionar etapa"
                // (Remove listeners antigos primeiro)
                const newSelect = select.cloneNode(true);
                select.parentNode.replaceChild(newSelect, select);

                newSelect.addEventListener('change', (e) => {
                    if (e.target.value === '__add_new__') {
                        this.showAddStageModal();
                        // Resetar select para vazio
                        e.target.value = '';
                    }
                });
            }

            modal.classList.remove('hidden');
        }
    }

    async startWork() {
        if (!this.currentOrder) {
            this.showError('Nenhuma ordem selecionada');
            return;
        }

        try {
            const stage = document.getElementById('work-stage').value;

            if (!stage) {
                this.showError('Por favor, selecione uma etapa');
                return;
            }

            // Taxa horária fixa de 70€
            const hourlyRate = 70.00;

            const token = await window.authManager.getAccessToken();

            const response = await fetch(`${this.apiBaseUrl}/orders/${this.currentOrder.id}/time-tracking`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stage, hourly_rate: hourlyRate })
            });

            if (!response.ok) {
                throw new Error('Erro ao iniciar trabalho');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Trabalho iniciado!');
                this.closeModal('modal-start-work');
                this.currentTimeTracking = data.tracking;

                // Recarregar detalhes da ordem para mostrar o timer
                await this.viewOrderDetails(this.currentOrder.id);
            }

        } catch (error) {
            console.error('Erro ao iniciar trabalho:', error);
            this.showError('Erro ao iniciar trabalho');
        }
    }

    // Gerenciar etapas customizadas
    loadCustomStages() {
        const stages = localStorage.getItem('customWorkStages');
        return stages ? JSON.parse(stages) : [];
    }

    saveCustomStage(stageName) {
        const stages = this.loadCustomStages();

        // Gerar ID único
        const stageId = `custom_${stageName.toLowerCase().replace(/\s+/g, '_')}`;

        // Verificar se já existe
        if (stages.some(s => s.id === stageId)) {
            this.showError('Esta etapa já existe!');
            return false;
        }

        stages.push({
            id: stageId,
            name: stageName
        });

        localStorage.setItem('customWorkStages', JSON.stringify(stages));
        return true;
    }

    populateStageDropdown() {
        const select = document.getElementById('work-stage');
        if (!select) return;

        // Carregar etapas customizadas
        const customStages = this.loadCustomStages();

        // Remover etapas customizadas antigas (se houver)
        const options = select.querySelectorAll('option[data-custom="true"]');
        options.forEach(opt => opt.remove());

        // Adicionar etapas customizadas antes da opção "Adicionar etapa"
        const addNewOption = select.querySelector('option[value="__add_new__"]');

        customStages.forEach(stage => {
            const option = document.createElement('option');
            option.value = stage.id;
            option.textContent = stage.name;
            option.setAttribute('data-custom', 'true');

            if (addNewOption) {
                select.insertBefore(option, addNewOption);
            } else {
                select.appendChild(option);
            }
        });
    }

    showAddStageModal() {
        const modal = document.getElementById('modal-add-stage');
        const input = document.getElementById('new-stage-name');

        if (modal && input) {
            input.value = '';
            modal.classList.remove('hidden');

            // Focar no input
            setTimeout(() => input.focus(), 100);
        }
    }

    closeAddStageModal() {
        const modal = document.getElementById('modal-add-stage');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    saveNewStage() {
        const input = document.getElementById('new-stage-name');
        const stageName = input?.value?.trim();

        if (!stageName) {
            this.showError('Digite um nome para a etapa');
            return;
        }

        if (this.saveCustomStage(stageName)) {
            this.showSuccess(`Etapa "${stageName}" adicionada com sucesso!`);
            this.closeAddStageModal();

            // Atualizar dropdown
            this.populateStageDropdown();

            // Selecionar a nova etapa
            const select = document.getElementById('work-stage');
            const stageId = `custom_${stageName.toLowerCase().replace(/\s+/g, '_')}`;
            if (select) {
                select.value = stageId;
            }
        }
    }

    async pauseWork() {
        if (!this.currentTimeTracking) {
            this.showError('Nenhum trabalho ativo');
            return;
        }

        try {
            const token = await window.authManager.getAccessToken();

            const response = await fetch(
                `${this.apiBaseUrl}/orders/${this.currentOrder.id}/time-tracking/${this.currentTimeTracking.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action: 'pause' })
                }
            );

            if (!response.ok) {
                throw new Error('Erro ao pausar trabalho');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Trabalho pausado!');
                this.currentTimeTracking = data.tracking;
                this.stopTimer();
                this.showActiveTimer(data.tracking);
            }

        } catch (error) {
            console.error('Erro ao pausar trabalho:', error);
            this.showError('Erro ao pausar trabalho');
        }
    }

    async resumeWork() {
        if (!this.currentTimeTracking) {
            this.showError('Nenhum trabalho ativo');
            return;
        }

        try {
            const token = await window.authManager.getAccessToken();

            const response = await fetch(
                `${this.apiBaseUrl}/orders/${this.currentOrder.id}/time-tracking/${this.currentTimeTracking.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action: 'resume' })
                }
            );

            if (!response.ok) {
                throw new Error('Erro ao retomar trabalho');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Trabalho retomado!');
                this.currentTimeTracking = data.tracking;
                this.showActiveTimer(data.tracking);
            }

        } catch (error) {
            console.error('Erro ao retomar trabalho:', error);
            this.showError('Erro ao retomar trabalho');
        }
    }

    async finishWork() {
        if (!this.currentTimeTracking) {
            this.showError('Nenhum trabalho ativo');
            return;
        }

        if (!confirm('Tem certeza que deseja finalizar este trabalho?')) {
            return;
        }

        try {
            const token = await window.authManager.getAccessToken();

            const response = await fetch(
                `${this.apiBaseUrl}/orders/${this.currentOrder.id}/time-tracking/${this.currentTimeTracking.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action: 'finish' })
                }
            );

            if (!response.ok) {
                throw new Error('Erro ao finalizar trabalho');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Trabalho finalizado!');
                this.currentTimeTracking = null;
                this.stopTimer();

                // Recarregar detalhes da ordem
                await this.viewOrderDetails(this.currentOrder.id);
            }

        } catch (error) {
            console.error('Erro ao finalizar trabalho:', error);
            this.showError('Erro ao finalizar trabalho');
        }
    }

    showActiveTimer(tracking) {
        const timerContainer = document.getElementById('active-timer');
        const stageDisplay = document.getElementById('active-timer-stage');
        const btnPause = document.getElementById('btn-pause-work');
        const btnResume = document.getElementById('btn-resume-work');

        if (!timerContainer) return;

        timerContainer.classList.remove('hidden');

        if (stageDisplay) {
            stageDisplay.textContent = `Etapa: ${this.formatStage(tracking.stage)}`;
        }

        // Controlar botões de pause/resume
        if (tracking.status === 'paused') {
            btnPause?.classList.add('hidden');
            btnResume?.classList.remove('hidden');
        } else {
            btnPause?.classList.remove('hidden');
            btnResume?.classList.add('hidden');
            this.startTimer(tracking.started_at);
        }
    }

    hideActiveTimer() {
        const timerContainer = document.getElementById('active-timer');
        if (timerContainer) {
            timerContainer.classList.add('hidden');
        }
        this.stopTimer();
    }

    startTimer(startedAt) {
        this.stopTimer(); // Parar qualquer timer existente

        const updateTimer = () => {
            const now = new Date();
            const start = new Date(startedAt);
            const diff = now - start;

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            const timerDisplay = document.getElementById('active-timer-display');
            if (timerDisplay) {
                timerDisplay.textContent = display;
            }
        };

        updateTimer(); // Atualizar imediatamente
        this.timerInterval = setInterval(updateTimer, 1000); // Atualizar a cada segundo
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    renderOrderIssues(issues) {
        const container = document.getElementById('order-issues-list');
        if (!container) return;

        if (issues.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Nenhuma intercorrência registrada</p>';
            return;
        }

        container.innerHTML = issues.map(issue => `
            <div class="border rounded-lg p-4 mb-3 ${this.getIssueBorderColor(issue.severity)}">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-medium text-sm">${this.escapeHtml(issue.title)}</h4>
                    ${this.renderSeverityBadge(issue.severity)}
                </div>
                <p class="text-sm text-gray-600 mb-2">${this.escapeHtml(issue.description)}</p>
                <div class="flex justify-between items-center text-xs text-gray-500">
                    <span>Tipo: ${this.formatIssueType(issue.type)}</span>
                    <span>${this.formatDateTime(issue.reported_at)}</span>
                </div>
                ${issue.response ? `
                    <div class="mt-2 pt-2 border-t">
                        <p class="text-sm text-gray-700"><strong>Resposta:</strong> ${this.escapeHtml(issue.response)}</p>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    // =====================================================
    // INTERCORRÊNCIAS
    // =====================================================

    showAddIssueModal() {
        const modal = document.getElementById('modal-add-issue');
        if (modal) {
            // Limpar formulário
            document.getElementById('issue-type').value = '';
            document.getElementById('issue-severity').value = 'medium';
            document.getElementById('issue-title').value = '';
            document.getElementById('issue-description').value = '';

            modal.classList.remove('hidden');
        }
    }

    async saveIssue() {
        if (!this.currentOrder) {
            this.showError('Nenhuma ordem selecionada');
            return;
        }

        try {
            const type = document.getElementById('issue-type').value;
            const severity = document.getElementById('issue-severity').value;
            const title = document.getElementById('issue-title').value;
            const description = document.getElementById('issue-description').value;

            if (!type || !severity || !title || !description) {
                this.showError('Por favor, preencha todos os campos obrigatórios');
                return;
            }

            const token = await window.authManager.getAccessToken();

            const response = await fetch(`${this.apiBaseUrl}/orders/${this.currentOrder.id}/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type,
                    severity,
                    title,
                    description,
                    visible_to_client: false
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao criar intercorrência');
            }

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Intercorrência registrada com sucesso!');
                this.closeModal('modal-add-issue');

                // Recarregar detalhes da ordem
                await this.viewOrderDetails(this.currentOrder.id);
            }

        } catch (error) {
            console.error('Erro ao salvar intercorrência:', error);
            this.showError('Erro ao salvar intercorrência');
        }
    }

    // Helper para obter nome de usuário
    getUserName(userId) {
        if (!userId) return 'Sistema';
        return this.userNames[userId] || `Usuário`;
    }

    renderOrderHistory(history) {
        const container = document.getElementById('order-history-list');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Nenhum histórico disponível</p>';
            return;
        }

        // Filtrar histórico: remover intercorrências que o usuário não tem acesso
        const filteredHistory = history.filter(h => {
            // Se for registro de intercorrência, verificar se usuário tem acesso
            if (h.change_type === 'issue_created' || h.change_type === 'issue_updated') {
                const issueId = h.metadata?.issue_id;
                // Só mostrar se o issue_id estiver na lista de IDs acessíveis
                // (que já foi filtrada pelo RLS no backend)
                return issueId && this.accessibleIssueIds && this.accessibleIssueIds.includes(issueId);
            }
            // Outros tipos de registro sempre mostram
            return true;
        });

        if (filteredHistory.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Nenhum histórico disponível</p>';
            return;
        }

        // Design de timeline compacto e vertical
        container.innerHTML = `
            <div class="relative">
                <!-- Linha vertical da timeline -->
                <div class="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                
                ${filteredHistory.map((h, index) => {
            const icon = this.getHistoryIcon(h.change_type);
            const iconColor = this.getHistoryIconColor(h.change_type);
            const time = new Date(h.changed_at);
            const timeStr = time.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
            const dateStr = time.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });

            return `
                        <div class="relative pb-4 last:pb-0">
                            <!-- Ícone na linha -->
                            <div class="absolute left-4 flex items-center justify-center w-5 h-5 ${iconColor} rounded-full border-2 border-white shadow">
                                <i class="fas fa-${icon} text-[10px] text-white"></i>
                            </div>
                            
                            <!-- Conteúdo -->
                            <div class="ml-14 bg-gray-50 rounded-lg p-2.5 hover:bg-gray-100 transition-colors">
                                <div class="flex items-center justify-between mb-0.5">
                                    <span class="text-xs font-medium text-gray-900">
                                        ${this.escapeHtml(h.description || this.formatHistoryDescription(h))}
                                    </span>
                                    <span class="text-[10px] text-gray-500 font-mono">${timeStr}</span>
                                </div>
                                <div class="text-[10px] text-gray-500">
                                    <span>${dateStr}</span>
                                    <span class="mx-1">•</span>
                                    <span class="font-medium">${this.getUserName(h.changed_by)}</span>
                                </div>
                                ${h.metadata && Object.keys(h.metadata).length > 0 ? `
                                    <div class="mt-1 text-[10px] text-gray-600">
                                        ${this.renderCompactMetadata(h.metadata)}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    // Ícone colorido para cada tipo
    getHistoryIconColor(changeType) {
        const colors = {
            'status_change': 'bg-blue-500',
            'material_added': 'bg-green-500',
            'material_removed': 'bg-red-500',
            'time_tracking_started': 'bg-purple-500',
            'time_tracking_paused': 'bg-yellow-500',
            'time_tracking_resumed': 'bg-purple-500',
            'time_tracking_finished': 'bg-green-600',
            'issue_created': 'bg-orange-500',
            'issue_updated': 'bg-orange-400',
            'order_updated': 'bg-indigo-500',
            'client_confirmed': 'bg-teal-500'
        };
        return colors[changeType] || 'bg-gray-500';
    }

    // Metadata compacto
    renderCompactMetadata(metadata) {
        if (!metadata) return '';

        const items = [];
        if (metadata.quantity) items.push(`Qtd: ${metadata.quantity}`);
        if (metadata.unit_cost) items.push(`€${metadata.unit_cost}`);
        if (metadata.duration_minutes) items.push(`${metadata.duration_minutes}min`);
        if (metadata.labor_cost) items.push(`€${metadata.labor_cost}`);
        if (metadata.item_name) items.push(metadata.item_name);

        return items.join(' • ');
    }

    getHistoryIcon(changeType) {
        const icons = {
            'status_change': 'sync-alt',
            'material_added': 'plus-circle',
            'material_removed': 'minus-circle',
            'time_tracking_started': 'play-circle',
            'time_tracking_paused': 'pause-circle',
            'time_tracking_resumed': 'play-circle',
            'time_tracking_finished': 'check-circle',
            'issue_created': 'exclamation-triangle',
            'issue_updated': 'edit',
            'order_updated': 'pen',
            'client_confirmed': 'check-double'
        };
        return icons[changeType] || 'circle';
    }

    getHistoryColor(changeType) {
        const colors = {
            'status_change': 'border-blue-400',
            'material_added': 'border-green-400',
            'material_removed': 'border-red-400',
            'time_tracking_started': 'border-emerald-400',
            'time_tracking_paused': 'border-yellow-400',
            'time_tracking_resumed': 'border-emerald-400',
            'time_tracking_finished': 'border-green-500',
            'issue_created': 'border-orange-400',
            'issue_updated': 'border-amber-400',
            'order_updated': 'border-indigo-400',
            'client_confirmed': 'border-teal-400'
        };
        return colors[changeType] || 'border-gray-400';
    }

    formatHistoryType(changeType) {
        const types = {
            'status_change': 'Status',
            'material_added': 'Material +',
            'material_removed': 'Material -',
            'time_tracking_started': 'Início',
            'time_tracking_paused': 'Pausa',
            'time_tracking_resumed': 'Retomada',
            'time_tracking_finished': 'Conclusão',
            'issue_created': 'Intercorrência',
            'issue_updated': 'Atualização',
            'order_updated': 'Edição',
            'client_confirmed': 'Confirmação'
        };
        return types[changeType] || 'Alteração';
    }

    formatHistoryDescription(h) {
        if (h.change_type === 'status_change' && h.old_status && h.new_status) {
            return `Status alterado de "${this.formatStatus(h.old_status)}" para "${this.formatStatus(h.new_status)}"`;
        }
        return 'Alteração registrada';
    }

    renderHistoryMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) {
            return '';
        }

        // Extrair informações relevantes do metadata
        const details = [];

        if (metadata.item_name) {
            details.push(`Item: ${metadata.item_name}`);
        }
        if (metadata.quantity) {
            details.push(`Qtd: ${metadata.quantity} ${metadata.unit || ''}`);
        }
        if (metadata.total_cost) {
            details.push(`Custo: ${this.formatCurrency(metadata.total_cost)}`);
        }
        if (metadata.kit_name) {
            details.push(`Kit: ${metadata.kit_name}`);
        }
        if (metadata.stage) {
            details.push(`Etapa: ${this.formatStage(metadata.stage)}`);
        }
        if (metadata.duration_minutes) {
            details.push(`Duração: ${metadata.duration_minutes} min`);
        }
        if (metadata.labor_cost) {
            details.push(`Mão de obra: ${this.formatCurrency(metadata.labor_cost)}`);
        }

        if (details.length === 0) return '';

        return `
            <div class="mt-2 pt-2 border-t border-gray-100">
                <div class="flex flex-wrap gap-2">
                    ${details.map(d => `
                        <span class="text-xs bg-gray-50 px-2 py-1 rounded">${this.escapeHtml(d)}</span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    generateOrderQRCode(order) {
        const qrContainer = document.getElementById('order-qr-code');
        if (!qrContainer) return;

        qrContainer.innerHTML = '';

        // Verificar se a biblioteca QRCode está disponível
        if (typeof QRCode === 'undefined') {
            console.error('Biblioteca QRCode não está carregada');
            qrContainer.innerHTML = '<p class="text-gray-500 text-sm">Erro ao carregar gerador de QR Code</p>';
            return;
        }

        // URL do QR Code (se não existir, usar o ID da ordem)
        const qrText = order.qr_code_url || `https://erp.institutoareluna.pt/prostoral/order/${order.id}`;

        try {
            new QRCode(qrContainer, {
                text: qrText,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });

            // Adicionar informação do QR Code
            const infoDiv = document.createElement('div');
            infoDiv.className = 'text-center mt-2';
            infoDiv.innerHTML = `<p class="text-xs text-gray-500">OS #${this.escapeHtml(order.order_number)}</p>`;
            qrContainer.appendChild(infoDiv);
        } catch (error) {
            console.error('Erro ao gerar QR Code:', error);
            qrContainer.innerHTML = '<p class="text-gray-500 text-sm">Erro ao gerar QR Code</p>';
        }
    }

    // =====================================================
    // HELPERS/POPULATES
    // =====================================================

    populateClientSelect() {
        const select = document.getElementById('order-client-id');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione um cliente...</option>' +
            this.clients.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
    }

    populateKitSelect() {
        const select = document.getElementById('material-kit-id');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione um kit...</option>' +
            this.kits.map(k => `<option value="${k.id}">${this.escapeHtml(k.nome)}</option>`).join('');
    }

    populateInventorySelect() {
        const select = document.getElementById('material-item-id');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione um produto...</option>' +
            this.inventory.map(i => `<option value="${i.id}" data-cost="${i.custo || 0}" data-unit="${i.unidade_medida || 'un'}">${this.escapeHtml(i.nome_material)} (${i.codigo_barras || '-'})</option>`).join('');
    }

    // =====================================================
    // FORMATTERS
    // =====================================================

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-PT');
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('pt-PT');
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: 'EUR'
        }).format(value || 0);
    }

    formatStage(stage) {
        if (!stage) return '-';

        const stages = {
            'design': 'Design',
            'production': 'Produção',
            'finishing': 'Acabamento',
            'quality_control': 'Controle de Qualidade',
            'other': 'Outro'
        };

        if (stages[stage]) return stages[stage];

        // Formatar stages personalizados (ex: custom_polimento -> Polimento)
        if (stage.startsWith('custom_')) {
            const name = stage.replace('custom_', '');
            return name.charAt(0).toUpperCase() + name.slice(1);
        }

        return stage;
    }

    formatStatus(status) {
        const statuses = {
            'pending': 'Pendente',
            'in_progress': 'Em Progresso',
            'quality_control': 'Controle de Qualidade',
            'ready': 'Pronto',
            'delivered': 'Entregue',
            'cancelled': 'Cancelado'
        };
        return statuses[status] || status;
    }

    formatIssueType(type) {
        const types = {
            'technical': 'Técnico',
            'material': 'Material',
            'delay': 'Atraso',
            'quality': 'Qualidade',
            'client_request': 'Solicitação do Cliente',
            'other': 'Outro'
        };
        return types[type] || type;
    }

    renderSeverityBadge(severity) {
        const colors = {
            'low': 'gray',
            'medium': 'yellow',
            'high': 'orange',
            'critical': 'red'
        };
        const color = colors[severity] || 'gray';
        return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${color}-100 text-${color}-800">${severity}</span>`;
    }

    getIssueBorderColor(severity) {
        const colors = {
            'low': 'border-gray-300',
            'medium': 'border-yellow-300',
            'high': 'border-orange-300',
            'critical': 'border-red-300'
        };
        return colors[severity] || 'border-gray-300';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =====================================================
    // UI HELPERS
    // =====================================================

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // ===== QR CODE SCANNER =====
    async openQrScanner() {
        const modal = document.getElementById('modal-qr-scanner');
        if (!modal) return;

        modal.classList.remove('hidden');

        const statusEl = document.getElementById('qr-scanner-status');

        try {
            // Verificar se a biblioteca está disponível
            if (typeof Html5Qrcode === 'undefined') {
                throw new Error('Biblioteca Html5Qrcode não carregada');
            }

            // Inicializar scanner
            this.html5QrcodeScanner = new Html5Qrcode("qr-reader");

            statusEl.textContent = 'Iniciando câmera...';
            statusEl.className = 'mt-3 text-center text-sm text-blue-600 dark:text-blue-400';

            // Configurações do scanner
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            // Iniciar scanning
            await this.html5QrcodeScanner.start(
                { facingMode: "environment" }, // Câmera traseira
                config,
                (decodedText) => {
                    // QR Code detectado!
                    console.log('QR Code detectado:', decodedText);
                    this.handleQrCodeDetected(decodedText);
                },
                (errorMessage) => {
                    // Erro de scanning (normal, ocorre constantemente)
                    // Não fazer nada aqui
                }
            );

            statusEl.textContent = '📷 Câmera ativa. Posicione o QR code...';
            statusEl.className = 'mt-3 text-center text-sm text-green-600 dark:text-green-400';

        } catch (error) {
            console.error('Erro ao iniciar scanner:', error);
            statusEl.textContent = `❌ Erro: ${error.message}`;
            statusEl.className = 'mt-3 text-center text-sm text-red-600 dark:text-red-400';

            // Se falhar, mostrar alerta
            this.showError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        }
    }

    async closeQrScanner() {
        try {
            // Parar o scanner se estiver ativo
            if (this.html5QrcodeScanner) {
                await this.html5QrcodeScanner.stop();
                this.html5QrcodeScanner.clear();
                this.html5QrcodeScanner = null;
            }
        } catch (error) {
            console.error('Erro ao fechar scanner:', error);
        }

        // Fechar modal
        const modal = document.getElementById('modal-qr-scanner');
        if (modal) {
            modal.classList.add('hidden');
        }

        // Resetar status
        const statusEl = document.getElementById('qr-scanner-status');
        if (statusEl) {
            statusEl.textContent = 'Aguardando câmera...';
            statusEl.className = 'mt-3 text-center text-sm text-gray-600 dark:text-gray-400';
        }
    }

    async handleQrCodeDetected(qrData) {
        console.log('Processando QR Code:', qrData);

        // Fechar o scanner
        await this.closeQrScanner();

        try {
            // Extrair ID da OS do QR code
            // Formato esperado: "WO-OS-{order_number}" ou URL ou UUID
            let orderId = null;

            // Se for uma URL completa
            if (qrData.includes('/os/')) {
                const match = qrData.match(/\/os\/([a-f0-9-]+)/i);
                if (match) {
                    orderId = match[1];
                }
            }
            // Se for só o UUID
            else if (qrData.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
                orderId = qrData;
            }
            // Se for WO-OS-{number}, buscar pelo número
            else if (qrData.startsWith('WO-OS-')) {
                const orderNumber = qrData.replace('WO-OS-', '');
                // Buscar ordem pelo número
                const order = this.orders.find(o => o.order_number === `OS-${orderNumber}`);
                if (order) {
                    orderId = order.id;
                }
            }

            if (!orderId) {
                this.showError('QR Code não reconhecido como uma Ordem de Serviço válida.');
                return;
            }

            // Abrir detalhes da ordem
            console.log('Abrindo ordem:', orderId);
            await this.viewOrderDetails(orderId);
            this.showSuccess('✅ Ordem de serviço encontrada!');

        } catch (error) {
            console.error('Erro ao processar QR Code:', error);
            this.showError('Erro ao abrir a ordem de serviço.');
        }
    }

    showError(message) {
        // Implementar toast/notification
        alert(message); // Temporário
    }

    showSuccess(message) {
        // Implementar toast/notification
        alert(message); // Temporário
    }

    // =====================================================
    // SISTEMA DE REPAROS
    // =====================================================

    async loadOrderRepairs(orderId) {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/orders/${orderId}/related`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar reparos');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Erro ao carregar reparos:', error);
            return null;
        }
    }

    async renderOrderRepairs(order) {
        const repairsSection = document.getElementById('repairs-section');
        const repairsList = document.getElementById('order-repairs-list');

        if (!repairsSection || !repairsList) return;

        // Só mostrar seção para OSs finalizadas que NÃO são reparos
        // Nota: is_repair pode ser undefined em OSs antigas, então tratamos como false
        if (order.status !== 'delivered' || order.is_repair === true) {
            repairsSection.classList.add('hidden');
            return;
        }

        // Mostrar seção (mesmo se não houver reparos ou houver erro)
        repairsSection.classList.remove('hidden');

        // Carregar reparos vinculados
        const data = await this.loadOrderRepairs(order.id);

        if (!data || !data.success) {
            // Mostrar mensagem de que não há reparos
            repairsList.innerHTML = `
                <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-tools text-3xl mb-2 opacity-50"></i>
                    <p class="text-sm">Nenhum reparo vinculado a esta OS</p>
                </div>
            `;
            return;
        }

        const repairs = data.repairs || [];

        if (repairs.length === 0) {
            repairsList.innerHTML = `
                <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-tools text-3xl mb-2 opacity-50"></i>
                    <p class="text-sm">Nenhum reparo vinculado a esta OS</p>
                </div>
            `;
            return;
        }

        // Renderizar lista de reparos
        repairsList.innerHTML = repairs.map(repair => `
            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800 mb-3">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-mono font-bold text-blue-600 dark:text-blue-400">${this.escapeHtml(repair.order_number)}</span>
                            ${this.renderRepairTypeBadge(repair.repair_type)}
                            ${this.renderStatusBadge(repair.status)}
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">${this.escapeHtml(repair.work_description || '-')}</p>
                    </div>
                    <button data-repair-id="${repair.id}" class="btn-view-repair text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
                <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span><i class="fas fa-calendar mr-1"></i>${this.formatDate(repair.created_at)}</span>
                    <span><i class="fas fa-euro-sign mr-1"></i>${this.formatCurrency(repair.total_cost || 0)}</span>
                </div>
                ${repair.repair_reason ? `
                    <div class="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
                        <strong>Motivo:</strong> ${this.escapeHtml(repair.repair_reason)}
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Adicionar event listeners para ver detalhes dos reparos
        repairsList.querySelectorAll('.btn-view-repair').forEach(btn => {
            btn.addEventListener('click', () => {
                const repairId = btn.dataset.repairId;
                this.viewOrderDetails(repairId);
            });
        });
    }

    renderRepairTypeBadge(repairType) {
        const badges = {
            'warranty': '<span class="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs rounded-full">🛡️ Garantia</span>',
            'billable': '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs rounded-full">💰 Pago</span>',
            'goodwill': '<span class="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-xs rounded-full">💝 Cortesia</span>'
        };
        return badges[repairType] || '';
    }

    showCreateRepairModal() {
        const modal = document.getElementById('modal-create-repair');
        if (!modal || !this.currentOrder) return;

        // Preencher dados da OS principal
        document.getElementById('repair-parent-order-number').textContent = this.currentOrder.order_number;
        document.getElementById('repair-client-name').textContent = this.currentOrder.client?.name || 'N/A';
        document.getElementById('repair-patient-name').textContent = this.currentOrder.patient_name || 'N/A';

        // Preview do número da OS de reparo
        this.updateRepairNumberPreview();

        // Limpar campos
        document.getElementById('repair-type').value = '';
        document.getElementById('repair-reason').value = '';
        document.getElementById('repair-work-description').value = '';
        document.getElementById('repair-due-date').value = '';
        document.getElementById('repair-priority').value = 'high';

        modal.classList.remove('hidden');
    }

    async updateRepairNumberPreview() {
        if (!this.currentOrder) return;

        const previewEl = document.getElementById('repair-preview-number');
        if (!previewEl) return;

        try {
            const data = await this.loadOrderRepairs(this.currentOrder.id);
            const repairCount = data?.repairs?.length || 0;
            const nextNumber = `${this.currentOrder.order_number}-R${repairCount + 1}`;
            previewEl.textContent = nextNumber;
        } catch (error) {
            previewEl.textContent = `${this.currentOrder.order_number}-R?`;
        }
    }

    async createRepairOrder() {
        try {
            const repairType = document.getElementById('repair-type').value;
            const repairReason = document.getElementById('repair-reason').value;
            const workDescription = document.getElementById('repair-work-description').value;
            const dueDate = document.getElementById('repair-due-date').value;
            const priority = document.getElementById('repair-priority').value;

            // Validação
            if (!repairType || !repairReason) {
                this.showError('Preencha os campos obrigatórios');
                return;
            }

            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/orders/${this.currentOrder.id}/repair`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    repair_type: repairType,
                    repair_reason: repairReason,
                    work_description: workDescription,
                    due_date: dueDate || null,
                    priority: priority
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao criar OS de reparo');
            }

            const data = await response.json();

            this.showSuccess('✅ OS de Reparo criada com sucesso!');

            // Fechar modal
            document.getElementById('modal-create-repair').classList.add('hidden');

            // Recarregar detalhes da OS para atualizar a lista de reparos
            await this.viewOrderDetails(this.currentOrder.id);

        } catch (error) {
            console.error('Erro ao criar OS de reparo:', error);
            this.showError(error.message || 'Erro ao criar OS de reparo');
        }
    }

    // =====================================================
    // REAL-TIME SUBSCRIPTIONS
    // =====================================================

    setupRealtimeSubscriptions() {
        console.log('🔴 Configurando subscriptions real-time...');

        // Verificar se o Supabase está disponível
        if (!window.authManager || !window.authManager.supabase) {
            console.warn('⚠️ Supabase não disponível ainda, tentando novamente em 2s...');
            setTimeout(() => this.setupRealtimeSubscriptions(), 2000);
            return;
        }

        // Unsubscribe de qualquer subscription anterior
        this.cleanupRealtimeSubscriptions();

        const supabase = window.authManager.supabase;

        // Subscribe a mudanças nas work orders
        const ordersSubscription = supabase
            .channel('prostoral_work_orders_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'prostoral_work_orders'
                },
                (payload) => this.handleOrderChange(payload)
            )
            .subscribe();

        this.realtimeSubscriptions.push(ordersSubscription);

        // Subscribe a mudanças nas intercorrências
        const issuesSubscription = supabase
            .channel('prostoral_work_order_issues_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'prostoral_work_order_issues'
                },
                (payload) => this.handleIssueChange(payload)
            )
            .subscribe();

        this.realtimeSubscriptions.push(issuesSubscription);

        // Subscribe a mudanças no histórico
        const historySubscription = supabase
            .channel('prostoral_work_order_status_history_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'prostoral_work_order_status_history'
                },
                (payload) => this.handleHistoryChange(payload)
            )
            .subscribe();

        this.realtimeSubscriptions.push(historySubscription);

        console.log('✅ Real-time subscriptions ativas');
    }

    cleanupRealtimeSubscriptions() {
        if (this.realtimeSubscriptions.length > 0 && window.authManager?.supabase) {
            console.log('🔴 Limpando subscriptions antigas...');
            this.realtimeSubscriptions.forEach(sub => {
                window.authManager.supabase.removeChannel(sub);
            });
            this.realtimeSubscriptions = [];
        }
    }

    handleOrderChange(payload) {
        console.log('🔔 Mudança detectada em Work Order:', payload);

        const { eventType, new: newRecord, old: oldRecord } = payload;

        // Se estamos vendo a lista de ordens, atualizar
        const ordersContent = document.getElementById('orders-content');
        if (ordersContent && !ordersContent.classList.contains('hidden')) {
            this.showRealtimeNotification('Uma ordem foi atualizada. Atualizando lista...');
            this.loadOrders(true);
        }

        // Se estamos vendo os detalhes desta ordem específica, atualizar
        if (this.currentOrder && (newRecord?.id === this.currentOrder.id || oldRecord?.id === this.currentOrder.id)) {
            if (eventType === 'DELETE') {
                this.showRealtimeNotification('⚠️ Esta ordem foi excluída');
                this.closeModal('modal-order-details');
                this.loadOrders();
            } else {
                this.showRealtimeNotification('Ordem atualizada. Recarregando detalhes...');
                this.viewOrderDetails(this.currentOrder.id);
            }
        }
    }

    handleIssueChange(payload) {
        console.log('🔔 Mudança detectada em Intercorrência:', payload);

        const { new: newRecord, old: oldRecord } = payload;
        const workOrderId = newRecord?.work_order_id || oldRecord?.work_order_id;

        // Se estamos vendo os detalhes desta ordem, atualizar
        if (this.currentOrder && workOrderId === this.currentOrder.id) {
            this.showRealtimeNotification('Nova intercorrência adicionada');
            this.viewOrderDetails(this.currentOrder.id);
        }
    }

    handleHistoryChange(payload) {
        console.log('🔔 Novo registro de histórico:', payload);

        const { new: newRecord } = payload;

        // Se estamos vendo os detalhes desta ordem, atualizar histórico
        if (this.currentOrder && newRecord?.work_order_id === this.currentOrder.id) {
            this.viewOrderDetails(this.currentOrder.id);
        }
    }

    showRealtimeNotification(message) {
        // Criar notificação flutuante
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-down';
        notification.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas fa-sync-alt fa-spin"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Remover após 3 segundos
        setTimeout(() => {
            notification.classList.add('animate-fade-out-up');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showNotification(message, type = 'info') {
        const colors = {
            'success': 'bg-green-500',
            'error': 'bg-red-500',
            'info': 'bg-blue-500',
            'warning': 'bg-yellow-500'
        };
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'info': 'fa-info-circle',
            'warning': 'fa-exclamation-triangle'
        };
        const colorClass = colors[type] || 'bg-blue-500';
        const iconClass = icons[type] || 'fa-info-circle';

        const notification = document.createElement('div');
        notification.className = `fixed top-20 right-4 ${colorClass} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-down flex items-center gap-3`;
        notification.innerHTML = `
            <i class="fas ${iconClass}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('animate-fade-out-up');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    // =====================================================
    // ATTACHMENTS HANDLING
    // =====================================================

    setupAttachmentHandlers() {
        const input = document.getElementById('order-attachment-input');
        if (input) {
            input.addEventListener('change', (e) => this.handleFileUpload(e));
        }
    }

    async handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        if (!this.currentOrder) {
            this.showNotification('Erro: Nenhuma ordem selecionada', 'error');
            return;
        }

        await this.uploadAttachments(files);

        // Limpar input
        event.target.value = '';
    }

    async uploadAttachments(files) {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        try {
            this.showNotification('Fazendo upload dos arquivos...', 'info');

            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/orders/${this.currentOrder.id}/attachments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro no upload');
            }

            const data = await response.json();
            this.showNotification('Arquivos enviados com sucesso!', 'success');

            // Atualizar detalhes
            await this.viewOrderDetails(this.currentOrder.id);

        } catch (error) {
            console.error('Erro no upload:', error);
            this.showNotification(error.message, 'error');
        }
    }

    renderAttachments(attachments) {
        const container = document.getElementById('order-attachments-list');
        if (!container) return;

        if (!attachments || attachments.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm col-span-full">Nenhum anexo adicionado.</p>';
            return;
        }

        container.innerHTML = attachments.map(att => {
            const isImage = att.type.startsWith('image/');
            const icon = isImage ? 'fa-image' : 'fa-file-pdf';
            const bgClass = isImage ? 'bg-gray-100' : 'bg-red-50';
            const textClass = isImage ? 'text-gray-600' : 'text-red-600';

            let content = '';
            if (isImage) {
                content = `
                    <div class="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer" onclick="window.ordersApp.openImageModal('${att.url}')">
                        <img src="${att.url}" class="w-full h-full object-cover transition-transform group-hover:scale-105" alt="${att.name}">
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <i class="fas fa-search-plus text-white text-2xl drop-shadow-lg"></i>
                        </div>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 truncate" title="${att.name}">${att.name}</p>
                `;
            } else {
                content = `
                    <a href="${att.url}" target="_blank" class="flex flex-col items-center justify-center p-4 rounded-lg ${bgClass} hover:opacity-80 transition-all aspect-square border border-gray-200">
                        <i class="fas ${icon} ${textClass} text-3xl mb-2"></i>
                        <span class="text-xs text-gray-600 text-center line-clamp-2 break-all" title="${att.name}">${att.name}</span>
                    </a>
                `;
            }

            return `
                <div class="relative group">
                    ${content}
                    <button onclick="window.ordersApp.deleteAttachment('${att.id}')" 
                        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600 z-10"
                        title="Excluir anexo">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    async deleteAttachment(attachmentId) {
        if (!confirm('Tem certeza que deseja excluir este anexo?')) return;

        try {
            this.showNotification('Excluindo anexo...', 'info');

            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/orders/${this.currentOrder.id}/attachments/${attachmentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao excluir anexo');
            }

            const result = await response.json();

            // Atualizar lista localmente
            if (this.currentOrder) {
                this.currentOrder.attachments = result.attachments;
                this.renderAttachments(this.currentOrder.attachments);

                // Se estiver com detalhes abertos, atualizar também
                this.viewOrderDetails(this.currentOrder.id);
            }

            this.showNotification('Anexo excluído com sucesso', 'success');

        } catch (error) {
            console.error('Erro ao excluir anexo:', error);
            this.showNotification(error.message || 'Erro ao excluir anexo', 'error');
        }
    }


    openImageModal(url) {
        const modal = document.getElementById('modal-image-preview');
        const img = document.getElementById('preview-image-full');
        if (modal && img) {
            img.src = url;
            modal.classList.remove('hidden');
        }
    }
}

// Inicializar app quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.ordersApp = new ProstoralOrdersApp();
});

