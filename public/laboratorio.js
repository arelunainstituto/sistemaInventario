// =====================================================
// MÓDULO DE LABORATÓRIO - Integrado ao Prostoral
// =====================================================

class LaboratorioModule {
    constructor() {
        this.products = [];
        this.movements = [];
        this.alerts = [];
        this.alertFilter = 'all'; // 'all', 'critico', 'aviso', 'informativo'
        this.currentPage = 1;
        this.itemsPerPage = 100; // Aumentado para 100 produtos por página
        this.apiBaseUrl = '/api/laboratorio';
        this.init();
    }

    async init() {
        if (this.initialized) {
            console.log('Módulo de Laboratório já foi inicializado');
            return;
        }

        console.log('Iniciando Módulo de Laboratório...');
        this.setupEventListeners();

        // Carregar produtos inicialmente
        await this.loadProducts();

        // Carregar estatísticas dos relatórios
        await this.loadReportStats();

        this.initialized = true;
    }

    setupEventListeners() {
        // Botões de ação
        const btnNewProduct = document.getElementById('btnNewProduct');
        const btnNewEntry = document.getElementById('btnNewEntry');
        const btnNewExit = document.getElementById('btnNewExit');
        const btnScanQR = document.getElementById('btnScanQR');

        if (btnNewProduct) {
            btnNewProduct.addEventListener('click', () => this.showProductModal());
        }
        if (btnNewEntry) {
            btnNewEntry.addEventListener('click', () => this.quickScanQRForMovement('entrada'));
        }
        if (btnNewExit) {
            btnNewExit.addEventListener('click', () => this.quickScanQRForMovement('saida'));
        }
        if (btnScanQR) {
            btnScanQR.addEventListener('click', () => this.scanQRCode());
        }

        // Botões de relatórios
        const btnExportInventory = document.getElementById('btnExportInventory');
        const btnExportMovements = document.getElementById('btnExportMovements');
        const btnExportValue = document.getElementById('btnExportValue');
        const btnExportConsumption = document.getElementById('btnExportConsumption');

        if (btnExportInventory) {
            btnExportInventory.addEventListener('click', () => this.exportInventoryReport());
        }
        if (btnExportMovements) {
            btnExportMovements.addEventListener('click', () => this.exportMovementsReport());
        }
        if (btnExportValue) {
            btnExportValue.addEventListener('click', () => this.exportValueReport());
        }
        if (btnExportConsumption) {
            btnExportConsumption.addEventListener('click', () => this.exportConsumptionReport());
        }

        // Modals - Produto
        const btnCloseProductModal = document.getElementById('btnCloseProductModal');
        const btnCancelProduct = document.getElementById('btnCancelProduct');
        const productForm = document.getElementById('productForm');

        if (btnCloseProductModal) {
            btnCloseProductModal.addEventListener('click', () => this.hideProductModal());
        }
        if (btnCancelProduct) {
            btnCancelProduct.addEventListener('click', () => this.hideProductModal());
        }
        if (productForm) {
            productForm.addEventListener('submit', (e) => this.saveProduct(e));
        }

        // Modals - Movimentação
        const btnCloseMovementModal = document.getElementById('btnCloseMovementModal');
        const btnCancelMovement = document.getElementById('btnCancelMovement');
        const movementForm = document.getElementById('movementForm');

        if (btnCloseMovementModal) {
            btnCloseMovementModal.addEventListener('click', () => this.hideMovementModal());
        }
        if (btnCancelMovement) {
            btnCancelMovement.addEventListener('click', () => this.hideMovementModal());
        }
        if (movementForm) {
            movementForm.addEventListener('submit', (e) => this.saveMovement(e));
        }

        // Filtros de produtos
        const productSearch = document.getElementById('product-search');
        const productFilterCategoria = document.getElementById('product-filter-categoria');
        const productFilterStatus = document.getElementById('product-filter-status');

        if (productSearch) {
            productSearch.addEventListener('input', this.debounce(() => this.loadProducts(), 300));
        }
        if (productFilterCategoria) {
            productFilterCategoria.addEventListener('change', () => this.loadProducts());
        }
        if (productFilterStatus) {
            productFilterStatus.addEventListener('change', () => this.loadProducts());
        }

        // Filtros de movimentações
        const movementSearch = document.getElementById('movement-search');
        const movementFilterTipo = document.getElementById('movement-filter-tipo');
        const btnApplyMovementFilter = document.getElementById('btnApplyMovementFilter');

        if (movementSearch) {
            movementSearch.addEventListener('input', this.debounce(() => this.loadMovements(), 300));
        }
        if (movementFilterTipo) {
            movementFilterTipo.addEventListener('change', () => this.loadMovements());
        }
        if (btnApplyMovementFilter) {
            btnApplyMovementFilter.addEventListener('click', () => this.loadMovements());
        }

        // Paginação produtos
        const productsPrevPage = document.getElementById('productsPrevPage');
        const productsNextPage = document.getElementById('productsNextPage');

        if (productsPrevPage) {
            productsPrevPage.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadProducts();
                }
            });
        }
        if (productsNextPage) {
            productsNextPage.addEventListener('click', () => {
                this.currentPage++;
                this.loadProducts();
            });
        }

        // Filtros de alertas
        const filterAllAlerts = document.getElementById('filterAllAlerts');
        const filterCriticosAlerts = document.getElementById('filterCriticosAlerts');
        const filterAvisosAlerts = document.getElementById('filterAvisosAlerts');
        const filterInformativosAlerts = document.getElementById('filterInformativosAlerts');

        if (filterAllAlerts) {
            filterAllAlerts.addEventListener('click', () => this.setAlertFilter('all', filterAllAlerts));
        }
        if (filterCriticosAlerts) {
            filterCriticosAlerts.addEventListener('click', () => this.setAlertFilter('critico', filterCriticosAlerts));
        }
        if (filterAvisosAlerts) {
            filterAvisosAlerts.addEventListener('click', () => this.setAlertFilter('aviso', filterAvisosAlerts));
        }
        if (filterInformativosAlerts) {
            filterInformativosAlerts.addEventListener('click', () => this.setAlertFilter('informativo', filterInformativosAlerts));
        }
    }

    setAlertFilter(filter, clickedButton) {
        this.alertFilter = filter;

        // Atualizar estilos dos botões
        const buttons = [
            document.getElementById('filterAllAlerts'),
            document.getElementById('filterCriticosAlerts'),
            document.getElementById('filterAvisosAlerts'),
            document.getElementById('filterInformativosAlerts')
        ];

        buttons.forEach(btn => {
            if (btn) {
                btn.className = 'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
            }
        });

        if (clickedButton) {
            clickedButton.className = 'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-emerald-600 text-white shadow-md';
        }

        // Re-renderizar alertas com filtro
        this.renderAlerts();
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
    // PRODUTOS
    // =====================================================

    async loadProducts() {
        try {
            const search = document.getElementById('product-search')?.value || '';
            const categoria = document.getElementById('product-filter-categoria')?.value || '';
            const status = document.getElementById('product-filter-status')?.value || '';

            // Query com JOIN entre produtoslaboratorio e estoquelaboratorio
            let query = window.authManager.supabase
                .from('produtoslaboratorio')
                .select(`
                    *,
                    estoquelaboratorio (
                        quantidade_atual,
                        quantidade_minima,
                        quantidade_maxima,
                        status
                    )
                `, { count: 'exact' })
                .eq('ativo', true)
                .is('deleted_at', null);

            // Filtro de busca
            if (search) {
                query = query.or(`nome_material.ilike.%${search}%,codigo_barras.ilike.%${search}%,marca.ilike.%${search}%`);
            }

            // Filtro de categoria
            if (categoria) {
                query = query.eq('categoria', categoria);
            }

            // Ordenação e paginação
            const from = (this.currentPage - 1) * this.itemsPerPage;
            const to = from + this.itemsPerPage - 1;

            const { data, error, count } = await query
                .order('data_criacao', { ascending: false })
                .range(from, to);

            if (error) throw error;

            // Filtrar por status de estoque (após busca, pois envolve dados do JOIN)
            let products = data || [];
            if (status) {
                products = products.filter(p => {
                    const qty = p.estoquelaboratorio?.quantidade_atual || 0;
                    if (status === 'critico') return qty <= 5;
                    if (status === 'baixo') return qty > 5 && qty <= 20;
                    if (status === 'ok') return qty > 20;
                    return true;
                });
            }

            this.products = products;

            this.renderProducts();
            this.updateProductsPagination({
                data: products,
                total: count || 0,
                page: this.currentPage,
                limit: this.itemsPerPage
            });
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            this.showNotification('Erro ao carregar produtos: ' + error.message, 'error');
        }
    }

    renderProducts() {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;

        if (this.products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-12 text-gray-500 dark:text-gray-400">
                        <i class="fas fa-flask text-4xl mb-2 opacity-50"></i>
                        <p>Nenhum produto encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.products.map(product => {
            // Pegar quantidade do estoque
            const quantidade = product.estoquelaboratorio?.quantidade_atual || 0;

            // Calcular status baseado na quantidade
            let statusClass = 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
            let statusText = 'Normal';

            if (quantidade <= 5) {
                statusClass = 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
                statusText = 'Crítico';
            } else if (quantidade <= 20) {
                statusClass = 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300';
                statusText = 'Baixo';
            }

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td class="py-3 px-4">
                        <span class="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            ${product.codigo_barras || product.qr_code || '-'}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <div class="font-medium text-gray-900 dark:text-white">${product.nome_material}</div>
                        ${product.referencia_lote ? `<div class="text-xs text-gray-500">Lote: ${product.referencia_lote}</div>` : ''}
                    </td>
                    <td class="py-3 px-4 text-gray-600 dark:text-gray-400">${product.marca || '-'}</td>
                    <td class="py-3 px-4">
                        <span class="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                            ${this.formatCategoria(product.categoria)}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <span class="font-semibold">${quantidade} ${product.unidade_medida}</span>
                    </td>
                    <td class="py-3 px-4">
                        <span class="text-xs px-2 py-1 rounded-full ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <div class="flex space-x-2">
                            <button data-action="view" data-id="${product.id}" class="product-action-btn p-2 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900 rounded-lg transition-colors" title="Visualizar">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button data-action="edit" data-id="${product.id}" class="product-action-btn p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button data-action="qrcode" data-id="${product.id}" class="product-action-btn p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded-lg transition-colors" title="Ver QR Code">
                                <i class="fas fa-qrcode"></i>
                            </button>
                            <button data-action="delete" data-id="${product.id}" class="product-action-btn p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Adicionar event listeners aos botões de ação
        document.querySelectorAll('.product-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = btn.getAttribute('data-action');
                const id = btn.getAttribute('data-id');

                switch (action) {
                    case 'view':
                        this.viewProduct(id);
                        break;
                    case 'edit':
                        this.editProduct(id);
                        break;
                    case 'qrcode':
                        this.viewQRCode(id);
                        break;
                    case 'delete':
                        this.deleteProduct(id);
                        break;
                }
            });
        });
    }

    formatCategoria(categoria) {
        const categorias = {
            'resinas': 'Resinas',
            'ceras': 'Ceras',
            'metais': 'Metais',
            'gesso': 'Gesso',
            'silicone': 'Silicone',
            'ceramica': 'Cerâmica',
            'acrilico': 'Acrílico',
            'instrumentos': 'Instrumentos',
            'equipamentos': 'Equipamentos',
            'consumiveis': 'Consumíveis',
            'outros': 'Outros'
        };
        return categorias[categoria] || categoria;
    }

    renderStatusBadge(status) {
        const statusConfig = {
            'disponivel': { text: 'Disponível', class: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
            'baixo': { text: 'Estoque Baixo', class: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' },
            'critico': { text: 'Crítico', class: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' },
            'esgotado': { text: 'Esgotado', class: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' }
        };

        const config = statusConfig[status] || statusConfig['disponivel'];
        return `<span class="text-xs px-3 py-1 rounded-full font-medium ${config.class}">${config.text}</span>`;
    }

    updateProductsPagination(result) {
        const countEl = document.getElementById('productsCount');
        const pageInfo = document.getElementById('productsPageInfo');
        const prevBtn = document.getElementById('productsPrevPage');
        const nextBtn = document.getElementById('productsNextPage');

        if (countEl) countEl.textContent = result.total || 0;
        if (pageInfo) pageInfo.textContent = `Página ${result.currentPage || 1} de ${result.totalPages || 1}`;

        if (prevBtn) {
            prevBtn.disabled = (result.currentPage || 1) <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = (result.currentPage || 1) >= (result.totalPages || 1);
        }
    }

    showProductModal(product = null) {
        const modal = document.getElementById('productModal');
        const title = document.getElementById('productModalTitle');
        const form = document.getElementById('productForm');

        if (!modal || !form) return;

        // Resetar formulário
        form.reset();
        document.getElementById('productId').value = '';

        if (product) {
            title.textContent = 'Editar Produto';
            document.getElementById('productId').value = product.id;
            document.getElementById('productNomeMaterial').value = product.nome_material || '';
            document.getElementById('productCategoria').value = product.categoria || '';
            document.getElementById('productMarca').value = product.marca || '';
            document.getElementById('productFornecedor').value = product.fornecedor || '';
            document.getElementById('productCodigoBarras').value = product.codigo_barras || '';
            document.getElementById('productReferenciaLote').value = product.referencia_lote || '';
            document.getElementById('productUnidadeMedida').value = product.unidade_medida || '';
            document.getElementById('productLocalizacao').value = product.localizacao || '';
            document.getElementById('productDataValidade').value = product.data_validade || '';
            document.getElementById('productEstoqueMinimo').value = product.quantidade_minima || '';
            document.getElementById('productEstoqueMaximo').value = product.quantidade_maxima || '';
            document.getElementById('productQuantidadeInicial').value = product.quantidade_atual || 0;
            document.getElementById('productCustoUnitario').value = product.custo_unitario || '';
            document.getElementById('productDescricao').value = product.descricao || '';
            document.getElementById('productObservacoes').value = product.observacoes || '';
        } else {
            title.textContent = 'Novo Produto';
        }

        modal.classList.remove('hidden');
    }

    hideProductModal() {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async saveProduct(e) {
        e.preventDefault();

        const productId = document.getElementById('productId').value;
        const isEdit = !!productId;

        const productData = {
            nome_material: document.getElementById('productNomeMaterial').value,
            categoria: document.getElementById('productCategoria').value,
            marca: document.getElementById('productMarca').value,
            fornecedor: document.getElementById('productFornecedor').value,
            codigo_barras: document.getElementById('productCodigoBarras').value,
            referencia_lote: document.getElementById('productReferenciaLote').value,
            unidade_medida: document.getElementById('productUnidadeMedida').value,
            localizacao: document.getElementById('productLocalizacao').value,
            data_validade: document.getElementById('productDataValidade').value || null,
            estoque_minimo: parseFloat(document.getElementById('productEstoqueMinimo').value) || 0,
            estoque_maximo: parseFloat(document.getElementById('productEstoqueMaximo').value) || 0,
            quantidade_inicial: parseFloat(document.getElementById('productQuantidadeInicial').value) || 0,
            custo_unitario: parseFloat(document.getElementById('productCustoUnitario').value) || 0,
            descricao: document.getElementById('productDescricao').value,
            observacoes: document.getElementById('productObservacoes').value
        };

        try {
            const token = await window.authManager.getAccessToken();
            const url = isEdit ? `${this.apiBaseUrl}/produtos/${productId}` : `${this.apiBaseUrl}/produtos`;
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao salvar produto');
            }

            this.showNotification(isEdit ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!', 'success');
            this.hideProductModal();
            await this.loadProducts();
        } catch (error) {
            console.error('Erro ao salvar produto:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async viewProduct(productId) {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/produtos/${productId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Erro ao carregar produto');

            const product = await response.json();

            // Criar modal de visualização
            const viewModal = document.createElement('div');
            viewModal.className = 'fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
            viewModal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                        <h3 class="text-2xl font-bold text-gray-900 dark:text-white">Detalhes do Produto</h3>
                        <button class="close-view-modal text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            <i class="fas fa-times text-2xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-6">
                        <!-- QR Code -->
                        <div class="text-center mb-6 bg-gray-50 dark:bg-gray-700 p-6 rounded-2xl">
                            <div id="product-qrcode-view" class="inline-block bg-white p-4 rounded-xl"></div>
                            <p class="mt-4 text-sm font-mono text-gray-600 dark:text-gray-400">${product.qr_code}</p>
                        </div>
                        
                        <!-- Informações do Produto -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Nome do Material</label>
                                <p class="text-lg font-semibold text-gray-900 dark:text-white">${product.nome_material}</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Categoria</label>
                                <p class="text-lg text-gray-900 dark:text-white">${this.formatCategoria(product.categoria)}</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Marca</label>
                                <p class="text-lg text-gray-900 dark:text-white">${product.marca || '-'}</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Fornecedor</label>
                                <p class="text-lg text-gray-900 dark:text-white">${product.fornecedor || '-'}</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Código de Barras</label>
                                <p class="text-lg font-mono text-gray-900 dark:text-white">${product.codigo_barras || '-'}</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Referência/Lote</label>
                                <p class="text-lg text-gray-900 dark:text-white">${product.referencia_lote || '-'}</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Quantidade Atual</label>
                                <p class="text-2xl font-bold text-emerald-600">${product.quantidade_atual || 0} ${product.unidade_medida}</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Estoque Mínimo</label>
                                <p class="text-lg text-gray-900 dark:text-white">${product.quantidade_minima || 0} ${product.unidade_medida}</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                                <div>${this.renderStatusBadge(product.status)}</div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Localização</label>
                                <p class="text-lg text-gray-900 dark:text-white">${product.localizacao || '-'}</p>
                            </div>
                            
                            ${product.data_validade ? `
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Data de Validade</label>
                                <p class="text-lg text-gray-900 dark:text-white">${new Date(product.data_validade).toLocaleDateString('pt-BR')}</p>
                            </div>
                            ` : ''}
                            
                            ${product.custo_medio_unitario ? `
                            <div>
                                <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Custo Médio</label>
                                <p class="text-lg font-semibold text-gray-900 dark:text-white">€${parseFloat(product.custo_medio_unitario).toFixed(2)}</p>
                            </div>
                            ` : ''}
                        </div>
                        
                        ${product.descricao ? `
                        <div class="mt-6">
                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Descrição</label>
                            <p class="text-gray-700 dark:text-gray-300">${product.descricao}</p>
                        </div>
                        ` : ''}
                        
                        ${product.observacoes ? `
                        <div class="mt-4">
                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Observações</label>
                            <p class="text-gray-700 dark:text-gray-300">${product.observacoes}</p>
                        </div>
                        ` : ''}
                        
                        <!-- Ações -->
                        <div class="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <button class="print-product px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                <i class="fas fa-print mr-2"></i>
                                Imprimir
                            </button>
                            <button class="close-view-modal px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(viewModal);

            // Gerar QR Code
            if (typeof QRCode !== 'undefined' && product.qr_code) {
                setTimeout(() => {
                    new QRCode(document.getElementById('product-qrcode-view'), {
                        text: product.qr_code,
                        width: 200,
                        height: 200
                    });
                }, 100);
            }

            // Event listeners
            viewModal.querySelectorAll('.close-view-modal').forEach(btn => {
                btn.addEventListener('click', () => viewModal.remove());
            });

            viewModal.querySelector('.print-product').addEventListener('click', () => {
                window.print();
            });

        } catch (error) {
            console.error('Erro ao visualizar produto:', error);
            this.showNotification('Erro ao carregar produto', 'error');
        }
    }

    async editProduct(productId) {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/produtos/${productId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Erro ao carregar produto');

            const product = await response.json();
            this.showProductModal(product);
        } catch (error) {
            console.error('Erro ao editar produto:', error);
            this.showNotification('Erro ao carregar produto', 'error');
        }
    }

    async deleteProduct(productId) {
        if (!confirm('Tem certeza que deseja excluir este produto?')) return;

        try {
            // Hard delete: remove permanentemente (evita problemas de RLS)
            const { error } = await window.authManager.supabase
                .from('produtoslaboratorio')
                .delete()
                .eq('id', productId);

            if (error) throw error;

            this.showNotification('Produto excluído com sucesso!', 'success');
            await this.loadProducts();
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            this.showNotification('Erro ao excluir produto: ' + error.message, 'error');
        }
    }

    async viewQRCode(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product || !product.qr_code) {
            this.showNotification('QR Code não disponível', 'warning');
            return;
        }

        // Criar modal temporário para mostrar QR Code
        const qrModal = document.createElement('div');
        qrModal.className = 'fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4 qr-modal';
        qrModal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 dark:text-white">QR Code</h3>
                    <button class="close-qr-modal text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                <div class="text-center">
                    <div class="bg-white p-6 rounded-xl inline-block mb-4 shadow-inner">
                        <div id="qrcode-container-${productId}" class="flex items-center justify-center min-h-[256px]">
                            <div class="text-gray-400">
                                <i class="fas fa-spinner fa-spin text-4xl mb-2"></i>
                                <p class="text-sm">Gerando QR Code...</p>
                            </div>
                        </div>
                    </div>
                    <p class="text-gray-700 dark:text-gray-300 font-semibold text-lg mb-1">${product.nome_material}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg inline-block">${product.qr_code}</p>
                    <div class="flex space-x-3 justify-center mt-6">
                        <button class="download-qr-btn px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors shadow-lg">
                            <i class="fas fa-download mr-2"></i>
                            Baixar
                        </button>
                        <button class="print-qr-btn px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors shadow-lg">
                            <i class="fas fa-print mr-2"></i>
                            Imprimir
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(qrModal);

        // Gerar QR Code
        await this.generateQRCode(product.qr_code, `qrcode-container-${productId}`);

        // Event listeners
        qrModal.querySelector('.close-qr-modal').addEventListener('click', () => {
            qrModal.remove();
        });

        qrModal.querySelector('.print-qr-btn').addEventListener('click', () => {
            this.printQRCode(product);
        });

        qrModal.querySelector('.download-qr-btn').addEventListener('click', () => {
            this.downloadQRCode(product);
        });

        // Fechar ao clicar fora
        qrModal.addEventListener('click', (e) => {
            if (e.target === qrModal) {
                qrModal.remove();
            }
        });
    }

    async generateQRCode(text, containerId) {
        console.log('🔍 Gerando QR Code:', { text, containerId });

        // Aguardar um pouco para garantir que o DOM está renderizado
        await new Promise(resolve => setTimeout(resolve, 100));

        const container = document.getElementById(containerId);
        if (!container) {
            console.error('❌ Container não encontrado:', containerId);
            return;
        }

        console.log('✅ Container encontrado, verificando biblioteca QRCode...');
        console.log('QRCode disponível?', typeof QRCode !== 'undefined');

        try {
            // Limpar loading
            container.innerHTML = '';

            // Método 1: Tentar usar QRCode.js se disponível
            if (typeof QRCode !== 'undefined') {
                console.log('✅ Usando QRCode.js para gerar QR Code');

                new QRCode(container, {
                    text: text,
                    width: 256,
                    height: 256,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });

                console.log('✅ QR Code gerado com sucesso!');
                return;
            }

            // Método 2: Usar API externa (backup)
            console.log('⚠️ QRCode.js não disponível, usando API externa');
            container.innerHTML = `
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(text)}" 
                     alt="QR Code" 
                     class="rounded-lg shadow-md"
                     style="width: 256px; height: 256px; opacity: 0; transition: opacity 0.3s;"
                     onload="this.style.opacity='1'"
                     onerror="this.parentElement.innerHTML='<div class=\\'text-red-500 p-4\\'>Erro ao carregar QR Code</div>'"
                />
            `;
        } catch (error) {
            console.error('❌ Erro ao gerar QR Code:', error);
            container.innerHTML = `
                <div class="text-center p-8">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-3"></i>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Erro ao gerar QR Code</p>
                    <p class="text-xs text-gray-500 dark:text-gray-500 mt-2 font-mono break-all">${text}</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                        Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    downloadQRCode(product) {
        try {
            const qrCanvas = document.querySelector('.qr-modal canvas');
            if (qrCanvas) {
                // Método 1: Se temos canvas do QRCode.js
                const link = document.createElement('a');
                link.download = `QR_${product.qr_code}.png`;
                link.href = qrCanvas.toDataURL();
                link.click();
            } else {
                // Método 2: Usar a imagem da API
                const qrImage = document.querySelector('.qr-modal img');
                if (qrImage) {
                    const link = document.createElement('a');
                    link.download = `QR_${product.qr_code}.png`;
                    link.href = qrImage.src;
                    link.click();
                }
            }
            this.showNotification('QR Code baixado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao baixar QR Code:', error);
            this.showNotification('Erro ao baixar QR Code', 'error');
        }
    }

    printQRCode(product) {
        // Criar uma janela de impressão com o QR Code
        const printWindow = window.open('', '_blank');
        const qrCanvas = document.querySelector('.qr-modal canvas');
        const qrImage = document.querySelector('.qr-modal img');

        let qrSrc = '';
        if (qrCanvas) {
            qrSrc = qrCanvas.toDataURL();
        } else if (qrImage) {
            qrSrc = qrImage.src;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Code - ${product.nome_material}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 20px;
                    }
                    .qr-container {
                        text-align: center;
                        padding: 30px;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        background: white;
                    }
                    img {
                        margin: 20px 0;
                        border: 3px solid #10b981;
                        padding: 10px;
                        background: white;
                        border-radius: 8px;
                    }
                    h2 {
                        color: #111827;
                        margin: 10px 0;
                    }
                    .code {
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                        color: #6b7280;
                        margin: 10px 0;
                        padding: 8px 16px;
                        background: #f3f4f6;
                        border-radius: 6px;
                        display: inline-block;
                    }
                    .category {
                        color: #10b981;
                        font-weight: bold;
                        margin: 5px 0;
                    }
                    @media print {
                        body { margin: 0; }
                        .qr-container { border: none; }
                    }
                </style>
            </head>
            <body>
                <div class="qr-container">
                    <h2>${product.nome_material}</h2>
                    <p class="category">${this.formatCategoria(product.categoria)}</p>
                    ${product.marca ? `<p><strong>Marca:</strong> ${product.marca}</p>` : ''}
                    <img src="${qrSrc}" alt="QR Code" width="300" height="300" />
                    <div class="code">${product.qr_code}</div>
                    ${product.localizacao ? `<p><strong>Localização:</strong> ${product.localizacao}</p>` : ''}
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        };
    }

    // Scan QR Code rápido antes de abrir modal de movimentação
    async quickScanQRForMovement(tipo) {
        // Mostrar notificação com opções
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-slide-down';
        notification.innerHTML = `
            <div class="text-center">
                <div class="mb-4">
                    <i class="fas fa-qrcode text-6xl text-blue-600"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    ${tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}
                </h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">
                    Escolha como deseja registrar a movimentação
                </p>
                <div class="space-y-3">
                    <button id="btnQuickScanQR" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 touch-target">
                        <i class="fas fa-camera text-2xl"></i>
                        <span>Escanear Código</span>
                    </button>
                    <button id="btnManualSelect" class="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 touch-target">
                        <i class="fas fa-hand-pointer text-2xl"></i>
                        <span>Seleção Manual</span>
                    </button>
                    <button id="btnCancelQuickScan" class="w-full text-gray-600 dark:text-gray-400 py-2 hover:text-gray-800 dark:hover:text-white transition-colors">
                        Cancelar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Event listeners
        document.getElementById('btnQuickScanQR').addEventListener('click', async () => {
            document.body.removeChild(notification);
            await this.startQRScanForMovement(tipo);
        });

        document.getElementById('btnManualSelect').addEventListener('click', () => {
            document.body.removeChild(notification);
            this.showMovementModal(tipo);
        });

        document.getElementById('btnCancelQuickScan').addEventListener('click', () => {
            document.body.removeChild(notification);
        });
    }

    // Iniciar scanner de QR Code para movimentação
    async startQRScanForMovement(tipo) {
        try {
            // Criar modal de scanner
            const scannerModal = document.createElement('div');
            scannerModal.id = 'qrScannerModal';
            scannerModal.className = 'fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4';
            scannerModal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                            <i class="fas fa-qrcode mr-2"></i>
                            Escanear Código
                        </h3>
                        <button id="btnCloseScannerModal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-2xl">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="relative bg-black rounded-xl overflow-hidden mb-4" style="height: 400px;">
                        <video id="qrVideo" class="w-full h-full object-cover"></video>
                        <div class="absolute inset-0 border-4 border-blue-500 m-12 rounded-xl pointer-events-none"></div>
                        <div id="scannerStatus" class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-full text-sm">
                            Posicione o código dentro da moldura
                        </div>
                    </div>
                    
                    <div class="text-center">
                        <p class="text-gray-600 dark:text-gray-400 mb-4">
                            Ou digite o código manualmente:
                        </p>
                        <div class="flex gap-2">
                            <input type="text" id="manualQRInput" placeholder="QR Code ou Código de Barras" 
                                   class="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-base">
                            <button id="btnManualQRSubmit" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">
                                <i class="fas fa-check"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(scannerModal);

            // Configurar câmera
            const video = document.getElementById('qrVideo');
            const statusDiv = document.getElementById('scannerStatus');
            let stream = null;
            let scanning = true;

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                video.srcObject = stream;
                video.play();

                // Iniciar scanner híbrido (QR Code + Código de Barras)
                this.startHybridScanner(video, statusDiv, tipo, stream, scanning);
            } catch (err) {
                console.error('Erro ao acessar câmera:', err);
                statusDiv.textContent = 'Erro ao acessar câmera. Use entrada manual.';
                statusDiv.className += ' bg-red-600';
            }

            // Fechar modal
            const closeScanner = () => {
                scanning = false;
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                // Parar Quagga se estiver rodando
                if (typeof Quagga !== 'undefined') {
                    try {
                        Quagga.stop();
                    } catch (e) {
                        // Quagga pode não estar rodando
                    }
                }
                if (document.body.contains(scannerModal)) {
                    document.body.removeChild(scannerModal);
                }
            };

            document.getElementById('btnCloseScannerModal').addEventListener('click', closeScanner);

            // Input manual
            document.getElementById('btnManualQRSubmit').addEventListener('click', async () => {
                const code = document.getElementById('manualQRInput').value.trim();
                if (code) {
                    // Parar Quagga
                    if (typeof Quagga !== 'undefined') {
                        try {
                            Quagga.stop();
                        } catch (e) { }
                    }
                    closeScanner();
                    await this.findProductByQRAndOpenModal(code, tipo);
                }
            });

            document.getElementById('manualQRInput').addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const code = e.target.value.trim();
                    if (code) {
                        // Parar Quagga
                        if (typeof Quagga !== 'undefined') {
                            try {
                                Quagga.stop();
                            } catch (e) { }
                        }
                        closeScanner();
                        await this.findProductByQRAndOpenModal(code, tipo);
                    }
                }
            });

        } catch (error) {
            console.error('Erro ao iniciar scanner:', error);
            this.showNotification('Erro ao iniciar scanner. Use seleção manual.', 'error');
            this.showMovementModal(tipo);
        }
    }

    // Buscar produto por QR Code ou Código de Barras e abrir modal
    async findProductByQRAndOpenModal(code, tipo) {
        try {
            // Buscar produto por QR Code OU Código de Barras
            const produto = this.products.find(p =>
                p.qr_code === code || p.codigo_barras === code
            );

            if (produto) {
                // Determinar qual código foi usado
                const codeType = produto.qr_code === code ? 'QR Code' : 'Código de Barras';
                this.showNotification(`✅ Produto encontrado (${codeType}): ${produto.nome_material}`, 'success');
                // Abrir modal com produto pré-selecionado
                this.showMovementModal(tipo, produto.id);
            } else {
                this.showNotification(`❌ Produto não encontrado: ${code}`, 'error');
                // Abrir modal normal
                this.showMovementModal(tipo);
            }
        } catch (error) {
            console.error('Erro ao buscar produto:', error);
            this.showNotification('Erro ao buscar produto', 'error');
            this.showMovementModal(tipo);
        }
    }

    // Scanner híbrido (QR Code + Código de Barras)
    startHybridScanner(video, statusDiv, tipo, stream, scanningRef) {
        let scanning = true;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Variável para armazenar referência do scanner
        const scannerState = { scanning: true };

        const stopScanning = (code, codeType) => {
            scannerState.scanning = false;
            scanning = false;
            stream.getTracks().forEach(track => track.stop());

            statusDiv.textContent = `✅ ${codeType} detectado!`;
            statusDiv.className = statusDiv.className.replace('bg-black', 'bg-green-600');

            // Remover modal
            const modal = document.getElementById('qrScannerModal');
            if (modal && document.body.contains(modal)) {
                document.body.removeChild(modal);
            }

            // Buscar produto
            this.findProductByQRAndOpenModal(code, tipo);
        };

        // Tentar iniciar Quagga para código de barras
        if (typeof Quagga !== 'undefined') {
            try {
                const videoElement = document.getElementById('qrVideo');
                Quagga.init({
                    inputStream: {
                        type: "LiveStream",
                        target: videoElement,
                        constraints: {
                            facingMode: "environment"
                        }
                    },
                    decoder: {
                        readers: [
                            "ean_reader",      // EAN-13, EAN-8
                            "ean_8_reader",
                            "code_128_reader",  // Code 128
                            "code_39_reader",   // Code 39
                            "upc_reader",       // UPC-A, UPC-E
                            "upc_e_reader"
                        ]
                    },
                    locate: true
                }, (err) => {
                    if (!err) {
                        Quagga.start();
                        console.log('✅ Quagga iniciado para código de barras');

                        // Detectar código de barras
                        Quagga.onDetected((result) => {
                            if (scannerState.scanning && result && result.codeResult && result.codeResult.code) {
                                const code = result.codeResult.code;
                                console.log('Código de barras detectado:', code);
                                Quagga.stop();
                                stopScanning(code, 'Código de Barras');
                            }
                        });
                    } else {
                        console.error('Erro ao iniciar Quagga:', err);
                    }
                });
            } catch (error) {
                console.error('Erro ao configurar Quagga:', error);
            }
        }

        // Scanner de QR Code com jsQR (em paralelo)
        if (typeof jsQR !== 'undefined') {
            const scanQR = () => {
                if (!scannerState.scanning) return;

                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height);

                    if (code) {
                        console.log('QR Code detectado:', code.data);
                        if (typeof Quagga !== 'undefined') {
                            Quagga.stop();
                        }
                        stopScanning(code.data, 'QR Code');
                        return;
                    }
                }

                requestAnimationFrame(scanQR);
            };

            scanQR();
        } else {
            statusDiv.textContent = 'jsQR não carregado. Apenas código de barras disponível.';
        }
    }

    // Scanner com jsQR (mantido para compatibilidade)
    scanWithJsQR(video, statusDiv, tipo, stream, scanning) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        const scan = () => {
            if (!scanning) return;

            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code) {
                    scanning = false;
                    stream.getTracks().forEach(track => track.stop());

                    statusDiv.textContent = '✅ QR Code detectado!';
                    statusDiv.className += ' bg-green-600';

                    // Remover modal
                    const modal = document.getElementById('qrScannerModal');
                    if (modal) document.body.removeChild(modal);

                    // Buscar produto
                    this.findProductByQRAndOpenModal(code.data, tipo);
                    return;
                }
            }

            requestAnimationFrame(scan);
        };

        scan();
    }

    scanQRCode() {
        this.showNotification('Use os botões de Entrada ou Saída para escanear QR Code', 'info');
    }

    // =====================================================
    // MOVIMENTAÇÕES
    // =====================================================

    async loadMovements() {
        try {
            const token = await window.authManager.getAccessToken();
            const search = document.getElementById('movement-search')?.value || '';
            const tipo = document.getElementById('movement-filter-tipo')?.value || '';
            const dataInicio = document.getElementById('movement-filter-data-inicio')?.value || '';
            const dataFim = document.getElementById('movement-filter-data-fim')?.value || '';

            const queryParams = new URLSearchParams({
                page: 1,
                limit: 50,
                search,
                tipo,
                data_inicio: dataInicio,
                data_fim: dataFim
            });

            const response = await fetch(`${this.apiBaseUrl}/movimentacoes?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Erro ao carregar movimentações');

            const result = await response.json();
            this.movements = result.data || [];

            this.renderMovements();
            this.updateMovementsPagination(result);
        } catch (error) {
            console.error('Erro ao carregar movimentações:', error);
            this.showNotification('Erro ao carregar movimentações', 'error');
        }
    }

    renderMovements() {
        const tbody = document.getElementById('movementsTableBody');
        if (!tbody) return;

        if (this.movements.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-12 text-gray-500 dark:text-gray-400">
                        <i class="fas fa-exchange-alt text-4xl mb-2 opacity-50"></i>
                        <p>Nenhuma movimentação encontrada</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.movements.map(mov => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td class="py-3 px-4 text-gray-600 dark:text-gray-400">
                    ${new Date(mov.data_movimentacao).toLocaleDateString('pt-BR')}
                </td>
                <td class="py-3 px-4">
                    <span class="text-xs px-3 py-1 rounded-full font-medium ${mov.tipo === 'entrada'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
            }">
                        ${mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                </td>
                <td class="py-3 px-4 font-medium text-gray-900 dark:text-white">${mov.nome_material}</td>
                <td class="py-3 px-4 font-semibold">${mov.quantidade} ${mov.unidade_medida}</td>
                <td class="py-3 px-4 text-gray-600 dark:text-gray-400">${mov.responsavel || '-'}</td>
                <td class="py-3 px-4 text-gray-600 dark:text-gray-400">${mov.motivo}</td>
            </tr>
        `).join('');
    }

    updateMovementsPagination(result) {
        const countEl = document.getElementById('movementsCount');
        const pageInfo = document.getElementById('movementsPageInfo');

        if (countEl) countEl.textContent = result.total || 0;
        if (pageInfo) pageInfo.textContent = `Página 1 de ${result.totalPages || 1}`;
    }

    async showMovementModal(tipo, preSelectedProductId = null) {
        const modal = document.getElementById('movementModal');
        const title = document.getElementById('movementModalTitle');
        const form = document.getElementById('movementForm');

        if (!modal || !form) return;

        // Resetar formulário
        form.reset();
        document.getElementById('movementTipo').value = tipo;

        // Atualizar título e opções baseado no tipo
        title.textContent = tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída';

        // Carregar produtos no select
        await this.loadProductsForMovement();

        // Pré-selecionar produto se fornecido
        if (preSelectedProductId) {
            const productSelect = document.getElementById('movementProduto');
            if (productSelect) {
                productSelect.value = preSelectedProductId;
                // Destacar o select
                productSelect.classList.add('ring-4', 'ring-green-500');
                setTimeout(() => {
                    productSelect.classList.remove('ring-4', 'ring-green-500');
                }, 2000);
            }
        }

        // Configurar opções de motivo
        const motivoSelect = document.getElementById('movementMotivo');
        if (tipo === 'entrada') {
            motivoSelect.innerHTML = `
                <option value="">Selecione...</option>
                <option value="compra">Compra</option>
                <option value="devolucao">Devolução</option>
                <option value="ajuste">Ajuste de Estoque</option>
                <option value="transferencia">Transferência</option>
                <option value="outro">Outro</option>
            `;
            document.getElementById('movementCustoUnitarioDiv').classList.remove('hidden');
            document.getElementById('movementResponsavelDiv').classList.add('hidden');
        } else {
            motivoSelect.innerHTML = `
                <option value="">Selecione...</option>
                <option value="producao">Produção</option>
                <option value="perda">Perda/Quebra</option>
                <option value="ajuste">Ajuste de Estoque</option>
                <option value="transferencia">Transferência</option>
                <option value="outro">Outro</option>
            `;
            document.getElementById('movementCustoUnitarioDiv').classList.add('hidden');
            document.getElementById('movementResponsavelDiv').classList.remove('hidden');
        }

        modal.classList.remove('hidden');
    }

    async loadProductsForMovement() {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/produtos?limit=1000`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Erro ao carregar produtos');

            const result = await response.json();
            const products = result.data || [];

            const select = document.getElementById('movementProduto');
            if (select) {
                select.innerHTML = '<option value="">Selecione um produto...</option>' +
                    products.map(p => `<option value="${p.id}">${p.nome_material} (${p.marca || 'Sem marca'})</option>`).join('');
            }
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
        }
    }

    hideMovementModal() {
        const modal = document.getElementById('movementModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async saveMovement(e) {
        e.preventDefault();

        const tipo = document.getElementById('movementTipo').value;
        const movementData = {
            tipo,
            produto_id: document.getElementById('movementProduto').value,
            quantidade: parseFloat(document.getElementById('movementQuantidade').value),
            motivo: document.getElementById('movementMotivo').value,
            responsavel: document.getElementById('movementResponsavel')?.value || null,
            custo_unitario: tipo === 'entrada' ? parseFloat(document.getElementById('movementCustoUnitario')?.value) || null : null,
            observacoes: document.getElementById('movementObservacoes').value
        };

        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/movimentacoes/${tipo}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(movementData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao registrar movimentação');
            }

            this.showNotification('Movimentação registrada com sucesso!', 'success');
            this.hideMovementModal();
            await this.loadMovements();
            await this.loadProducts(); // Atualizar produtos para refletir mudanças de estoque
        } catch (error) {
            console.error('Erro ao salvar movimentação:', error);
            this.showNotification(error.message, 'error');
        }
    }

    // =====================================================
    // ALERTAS
    // =====================================================

    async loadAlerts() {
        try {
            const token = await window.authManager.getAccessToken();
            const response = await fetch(`${this.apiBaseUrl}/alertas`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Erro ao carregar alertas');

            const result = await response.json();
            this.alerts = result.data || [];

            this.renderAlerts();
            this.updateAlertsStats();
        } catch (error) {
            console.error('Erro ao carregar alertas:', error);
            this.showNotification('Erro ao carregar alertas', 'error');
        }
    }

    renderAlerts() {
        const container = document.getElementById('alertsList');
        if (!container) return;

        // Filtrar alertas baseado no filtro ativo
        let filteredAlerts = this.alerts;
        if (this.alertFilter !== 'all') {
            filteredAlerts = this.alerts.filter(alert => alert.tipo === this.alertFilter);
        }

        if (filteredAlerts.length === 0) {
            const mensagem = this.alertFilter === 'all'
                ? 'Nenhum alerta ativo'
                : `Nenhum alerta do tipo "${this.alertFilter}"`;
            container.innerHTML = `
                <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-check-circle text-4xl mb-2 opacity-50"></i>
                    <p>${mensagem}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredAlerts.map(alert => {
            // Mapear tipo para cor e ícone
            const tipoConfig = {
                'critico': {
                    icon: 'fa-exclamation-triangle',
                    color: 'red',
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    borderColor: 'border-red-500',
                    textColor: 'text-red-700 dark:text-red-400'
                },
                'aviso': {
                    icon: 'fa-exclamation-circle',
                    color: 'yellow',
                    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
                    borderColor: 'border-yellow-500',
                    textColor: 'text-yellow-700 dark:text-yellow-400'
                },
                'informativo': {
                    icon: 'fa-info-circle',
                    color: 'blue',
                    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                    borderColor: 'border-blue-500',
                    textColor: 'text-blue-700 dark:text-blue-400'
                }
            };

            const config = tipoConfig[alert.tipo] || tipoConfig['informativo'];

            return `
                <div class="${config.bgColor} rounded-xl p-4 border-l-4 ${config.borderColor}">
                    <div class="flex items-start justify-between">
                        <div class="flex items-start space-x-3">
                            <i class="fas ${config.icon} ${config.textColor} text-xl mt-1"></i>
                            <div>
                                <h4 class="font-semibold text-gray-900 dark:text-white">${alert.titulo}</h4>
                                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${alert.mensagem}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                    ${new Date(alert.data_criacao).toLocaleString('pt-BR')}
                                </p>
                            </div>
                        </div>
                        <button onclick="window.prostoralLab.markAlertAsViewed('${alert.id}')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateAlertsStats() {
        const alertsCount = this.alerts.length;
        const alertsCriticos = this.alerts.filter(a => a.tipo === 'critico').length;
        const alertsAvisos = this.alerts.filter(a => a.tipo === 'aviso').length;
        const alertsInfo = this.alerts.filter(a => a.tipo === 'informativo').length;

        document.getElementById('alertsCriticos').textContent = alertsCriticos;
        document.getElementById('alertsAvisos').textContent = alertsAvisos;
        document.getElementById('alertsInfo').textContent = alertsInfo;

        // Atualizar badge na aba (mobile e desktop)
        const alertCount = document.getElementById('alertCount');
        const alertCountDesktop = document.getElementById('alertCount-desktop');

        if (alertsCount > 0) {
            if (alertCount) {
                alertCount.textContent = alertsCount;
                alertCount.classList.remove('hidden');
            }
            if (alertCountDesktop) {
                alertCountDesktop.textContent = alertsCount;
                alertCountDesktop.classList.remove('hidden');
            }
        } else {
            if (alertCount) {
                alertCount.classList.add('hidden');
            }
            if (alertCountDesktop) {
                alertCountDesktop.classList.add('hidden');
            }
        }
    }

    async markAlertAsViewed(alertId) {
        try {
            const token = await window.authManager.getAccessToken();
            await fetch(`${this.apiBaseUrl}/alertas/${alertId}/visualizar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            await this.loadAlerts();
        } catch (error) {
            console.error('Erro ao marcar alerta como visualizado:', error);
        }
    }

    // =====================================================
    // RELATÓRIOS
    // =====================================================

    async loadReports() {
        try {
            const token = await window.authManager.getAccessToken();

            // Carregar KPIs de relatório
            const [valueRes, entriesRes, exitsRes, productsRes] = await Promise.all([
                fetch(`${this.apiBaseUrl}/relatorios/valor-estoque`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${this.apiBaseUrl}/relatorios/entradas-mes`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${this.apiBaseUrl}/relatorios/saidas-mes`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${this.apiBaseUrl}/produtos?limit=1`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const valueData = await valueRes.json();
            const entriesData = await entriesRes.json();
            const exitsData = await exitsRes.json();
            const productsData = await productsRes.json();

            document.getElementById('totalStockValue').textContent = `€${(valueData.valor_total || 0).toFixed(2)}`;
            document.getElementById('totalMonthEntries').textContent = entriesData.total || 0;
            document.getElementById('totalMonthExits').textContent = exitsData.total || 0;
            document.getElementById('totalProducts').textContent = productsData.total || 0;
        } catch (error) {
            console.error('Erro ao carregar relatórios:', error);
        }
    }

    // =====================================================
    // RELATÓRIOS - ESTATÍSTICAS
    // =====================================================

    async loadReportStats() {
        try {
            const token = localStorage.getItem('sb-hvqckoajxhdqaxfawisd-auth-token');
            if (!token) return;

            // Buscar valor total em estoque
            const valorEstoqueResponse = await fetch(`${this.apiBaseUrl}/relatorios/valor-estoque`, {
                headers: {
                    'Authorization': `Bearer ${JSON.parse(token).access_token}`
                }
            });

            if (valorEstoqueResponse.ok) {
                const valorData = await valorEstoqueResponse.json();
                const valorElement = document.getElementById('totalStockValue');
                if (valorElement && valorData.valor_total !== undefined) {
                    valorElement.textContent = `€${parseFloat(valorData.valor_total || 0).toFixed(2)}`;
                }
            }

            // Buscar entradas do mês
            const entradasResponse = await fetch(`${this.apiBaseUrl}/relatorios/entradas-mes`, {
                headers: {
                    'Authorization': `Bearer ${JSON.parse(token).access_token}`
                }
            });

            if (entradasResponse.ok) {
                const entradasData = await entradasResponse.json();
                const entradasElement = document.getElementById('totalMonthEntries');
                if (entradasElement && entradasData.total !== undefined) {
                    entradasElement.textContent = entradasData.total || 0;
                }
            }

            // Buscar saídas do mês
            const saidasResponse = await fetch(`${this.apiBaseUrl}/relatorios/saidas-mes`, {
                headers: {
                    'Authorization': `Bearer ${JSON.parse(token).access_token}`
                }
            });

            if (saidasResponse.ok) {
                const saidasData = await saidasResponse.json();
                const saidasElement = document.getElementById('totalMonthExits');
                if (saidasElement && saidasData.total !== undefined) {
                    saidasElement.textContent = saidasData.total || 0;
                }
            }

            // Total de produtos
            const produtosElement = document.getElementById('totalProducts');
            if (produtosElement) {
                produtosElement.textContent = this.products.length || 0;
            }

            // Inicializar filtros de data
            this.initializeDateFilters();

        } catch (error) {
            console.error('Erro ao carregar estatísticas de relatórios:', error);
        }
    }

    // =====================================================
    // FILTROS DE DATA
    // =====================================================

    initializeDateFilters() {
        // Definir datas padrão (mês atual)
        const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const hoje = new Date();

        const dataInicioInput = document.getElementById('filtroDataInicio');
        const dataFimInput = document.getElementById('filtroDataFim');

        if (dataInicioInput && !dataInicioInput.value) {
            dataInicioInput.value = primeiroDia.toISOString().split('T')[0];
        }
        if (dataFimInput && !dataFimInput.value) {
            dataFimInput.value = hoje.toISOString().split('T')[0];
        }

        // Event listeners
        const btnAplicar = document.getElementById('btnAplicarFiltro');
        const btnLimpar = document.getElementById('btnLimparFiltro');

        if (btnAplicar) {
            btnAplicar.removeEventListener('click', this.aplicarFiltroHandler);
            this.aplicarFiltroHandler = () => this.aplicarFiltroRelatorios();
            btnAplicar.addEventListener('click', this.aplicarFiltroHandler);
        }
        if (btnLimpar) {
            btnLimpar.removeEventListener('click', this.limparFiltroHandler);
            this.limparFiltroHandler = () => this.limparFiltroRelatorios();
            btnLimpar.addEventListener('click', this.limparFiltroHandler);
        }

        // Event listeners para botões preset
        const presetButtons = document.querySelectorAll('[data-preset]');
        presetButtons.forEach(btn => {
            const preset = btn.getAttribute('data-preset');
            btn.addEventListener('click', () => this.setFiltroPreset(preset));
        });
    }

    setFiltroPreset(preset) {
        const dataFim = new Date();
        let dataInicio = new Date();

        switch (preset) {
            case 'hoje':
                dataInicio = new Date();
                break;
            case 'semana':
                dataInicio.setDate(dataInicio.getDate() - 7);
                break;
            case 'mes':
                dataInicio = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 1);
                break;
            case 'trimestre':
                dataInicio.setMonth(dataInicio.getMonth() - 3);
                break;
            case 'ano':
                dataInicio = new Date(dataInicio.getFullYear(), 0, 1);
                break;
        }

        document.getElementById('filtroDataInicio').value = dataInicio.toISOString().split('T')[0];
        document.getElementById('filtroDataFim').value = dataFim.toISOString().split('T')[0];
    }

    async aplicarFiltroRelatorios() {
        const dataInicio = document.getElementById('filtroDataInicio').value;
        const dataFim = document.getElementById('filtroDataFim').value;

        if (!dataInicio || !dataFim) {
            this.showNotification('Por favor, selecione as datas de início e fim', 'error');
            return;
        }

        const token = localStorage.getItem('sb-hvqckoajxhdqaxfawisd-auth-token');
        if (!token) return;

        try {
            const accessToken = JSON.parse(token).access_token;

            // Buscar movimentações com filtro
            const response = await fetch(`${this.apiBaseUrl}/relatorios/movimentacoes?dataInicio=${dataInicio}&dataFim=${dataFim}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) throw new Error('Erro ao buscar movimentações');

            const data = await response.json();

            // Atualizar KPIs
            document.getElementById('totalMonthEntries').textContent = data.total_entradas || 0;
            document.getElementById('totalMonthExits').textContent = data.total_saidas || 0;

            // Mensagem de sucesso
            const periodoTexto = `${new Date(dataInicio).toLocaleDateString('pt-PT')} - ${new Date(dataFim).toLocaleDateString('pt-PT')}`;
            this.showNotification(`✅ Período: ${periodoTexto} | Entradas: ${data.total_entradas} | Saídas: ${data.total_saidas}`, 'success');

            return data;
        } catch (error) {
            console.error('Erro ao aplicar filtro:', error);
            this.showNotification('Erro ao aplicar filtro: ' + error.message, 'error');
        }
    }

    limparFiltroRelatorios() {
        const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const hoje = new Date();

        document.getElementById('filtroDataInicio').value = primeiroDia.toISOString().split('T')[0];
        document.getElementById('filtroDataFim').value = hoje.toISOString().split('T')[0];

        // Recarregar dados do mês atual
        this.loadReportStats();
        this.showNotification('Filtro limpo! Mostrando dados do mês atual', 'info');
    }

    // =====================================================
    // RELATÓRIOS - EXPORTAÇÃO
    // =====================================================

    async exportInventoryReport() {
        try {
            this.showNotification('Exportando relatório de estoque...', 'info');
            await this.downloadReport('/relatorios/estoque/export', 'relatorio-estoque.csv');
        } catch (error) {
            this.showNotification('Erro ao exportar relatório: ' + error.message, 'error');
        }
    }

    async exportMovementsReport() {
        try {
            this.showNotification('Exportando relatório de movimentações...', 'info');
            await this.downloadReport('/relatorios/movimentacoes/export', 'relatorio-movimentacoes.csv');
        } catch (error) {
            this.showNotification('Erro ao exportar relatório: ' + error.message, 'error');
        }
    }

    async exportValueReport() {
        try {
            this.showNotification('Exportando análise de valor...', 'info');
            await this.downloadReport('/relatorios/valor/export', 'analise-valor.csv');
        } catch (error) {
            this.showNotification('Erro ao exportar relatório: ' + error.message, 'error');
        }
    }

    async exportConsumptionReport() {
        try {
            this.showNotification('Exportando análise de consumo...', 'info');
            await this.downloadReport('/relatorios/consumo/export', 'analise-consumo.csv');
        } catch (error) {
            this.showNotification('Erro ao exportar relatório: ' + error.message, 'error');
        }
    }

    async downloadReport(endpoint, filename) {
        const token = localStorage.getItem('sb-hvqckoajxhdqaxfawisd-auth-token');
        if (!token) {
            throw new Error('Token de autenticação não encontrado');
        }

        const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${JSON.parse(token).access_token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao exportar relatório');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        this.showNotification('Relatório exportado com sucesso!', 'success');
    }

    // =====================================================
    // NOTIFICAÇÕES
    // =====================================================

    showNotification(message, type = 'info') {
        const bgColors = {
            'success': 'bg-green-500',
            'error': 'bg-red-500',
            'warning': 'bg-yellow-500',
            'info': 'bg-blue-500'
        };

        const notification = document.createElement('div');
        notification.className = `fixed top-20 right-4 ${bgColors[type]} text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-slide-in-right`;
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'} text-xl"></i>
                <span class="font-medium">${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Inicializar o módulo quando a aba de estoque for acessada
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que o authManager está pronto
    setTimeout(() => {
        if (window.authManager && window.authManager.isUserAuthenticated()) {
            window.prostoralLab = new LaboratorioModule();
        }
    }, 1000);
});

