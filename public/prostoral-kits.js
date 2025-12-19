// ============================================
// PROSTORAL KITS - Módulo de Gerenciamento de Kits
// Integrado ao prostoral.html
// ============================================

(function () {
    'use strict';

    // Variáveis do módulo
    let allKits = [];
    let allProdutos = [];
    let kitProdutos = [];
    let selectedProduto = null;
    let editingKitId = null;

    // Inicializar módulo quando a aba Kits for ativada
    function initKitsModule() {
        if (!window.authManager || !window.authManager.supabase) {
            console.error('❌ Supabase não inicializado');
            showNotification('Erro: Sistema de autenticação não disponível', 'error');
            return;
        }

        console.log('✅ Inicializando módulo de Kits...');

        // Event listeners
        setupEventListeners();

        // Carregar dados
        loadKits();
        loadProdutos();
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    function setupEventListeners() {
        // Botões criar kit
        document.getElementById('btnCreateKit')?.addEventListener('click', openCreateKitModal);
        document.getElementById('btnCreateKitEmpty')?.addEventListener('click', openCreateKitModal);

        // Modal kit
        document.getElementById('btnCloseKitModal')?.addEventListener('click', closeKitModal);
        document.getElementById('btnCancelKit')?.addEventListener('click', closeKitModal);
        document.getElementById('kitForm')?.addEventListener('submit', saveKit);

        // Modal produto
        document.getElementById('btnAddProduto')?.addEventListener('click', openProdutoModal);
        document.getElementById('btnCloseProdutoModal')?.addEventListener('click', closeProdutoModal);
        document.getElementById('btnCancelProduto')?.addEventListener('click', closeProdutoModal);
        document.getElementById('btnConfirmProduto')?.addEventListener('click', addProdutoToKit);
        document.getElementById('searchProduto')?.addEventListener('input', searchProdutos);

        // Filtros
        document.getElementById('searchKit')?.addEventListener('input', filterKits);
        document.getElementById('filterKitType')?.addEventListener('change', filterKits);
    }

    // ============================================
    // CARREGAR DADOS
    // ============================================

    async function loadKits(force = false) {
        if (!force && allKits.length > 0) {
            console.log('📦 Kits carregados do cache');
            renderKits();
            return;
        }
        try {
            const { data, error } = await window.authManager.supabase
                .from('kits')
                .select(`
                    *,
                    kit_produtos (
                        id,
                        quantidade,
                        produtoslaboratorio (
                            id,
                            nome_material,
                            qr_code,
                            unidade_medida,
                            estoquelaboratorio (
                                quantidade_atual
                            )
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            allKits = data || [];
            console.log('✅ Kits carregados:', allKits.length);
            renderKits();
        } catch (error) {
            console.error('❌ Erro ao carregar kits:', error);
            showNotification('Erro ao carregar kits', 'error');
        }
    }

    async function loadProdutos() {
        try {
            const { data, error } = await window.authManager.supabase
                .from('produtoslaboratorio')
                .select(`
                    id,
                    nome_material,
                    codigo_barras,
                    unidade_medida,
                    estoquelaboratorio (
                        quantidade_atual
                    )
                `)
                .eq('ativo', true)
                .order('nome_material');

            if (error) throw error;

            allProdutos = (data || []).map(p => ({
                id: p.id,
                name: p.nome_material,
                code: p.codigo_barras,
                unit: p.unidade_medida,
                quantity: p.estoquelaboratorio ? p.estoquelaboratorio.quantidade_atual : 0
            }));

            console.log('✅ Produtos carregados:', allProdutos.length);
        } catch (error) {
            console.error('❌ Erro ao carregar produtos:', error);
            showNotification('Erro ao carregar produtos do estoque', 'error');
        }
    }

    // ============================================
    // RENDERIZAÇÃO
    // ============================================

    function renderKits(kitsToRender = null) {
        const container = document.getElementById('kitsContainer');
        const emptyState = document.getElementById('emptyKitsState');
        const kits = kitsToRender || allKits;

        if (!container) return;

        if (kits.length === 0) {
            container.innerHTML = '';
            emptyState?.classList.remove('hidden');
            return;
        }

        emptyState?.classList.add('hidden');

        const html = kits.map(kit => {
            const totalProdutos = kit.kit_produtos?.length || 0;
            const tipoLabel = getTipoLabel(kit.tipo);
            const tipoColor = getTipoColor(kit.tipo);

            return `
                <div class="kit-card bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all">
                    <div class="flex justify-between items-start mb-4">
                        <span class="px-3 py-1 rounded-full text-xs font-semibold" style="background: ${tipoColor}; color: white;">${tipoLabel}</span>
                        <div class="flex gap-2">
                            <button data-kit-id="${kit.id}" data-action="edit" class="kit-action-btn text-blue-600 hover:text-blue-700 p-2" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button data-kit-id="${kit.id}" data-action="delete" class="kit-action-btn text-red-600 hover:text-red-700 p-2" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">${escapeHtml(kit.nome)}</h3>
                    
                    ${kit.descricao ? `
                        <p class="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">${escapeHtml(kit.descricao)}</p>
                    ` : ''}
                    
                    <div class="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div class="flex items-center text-gray-600 dark:text-gray-400">
                            <i class="fas fa-boxes mr-2"></i>
                            <span class="font-semibold">${totalProdutos}</span>
                            <span class="ml-1 text-sm">${totalProdutos === 1 ? 'produto' : 'produtos'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

        // Event delegation para botões de ação dos kits
        container.querySelectorAll('.kit-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const kitId = btn.getAttribute('data-kit-id');
                const action = btn.getAttribute('data-action');

                if (action === 'edit') {
                    editKit(kitId);
                } else if (action === 'delete') {
                    deleteKit(kitId);
                }
            });
        });
    }

    // ============================================
    // MODALS
    // ============================================

    function openCreateKitModal() {
        editingKitId = null;
        kitProdutos = [];
        document.getElementById('kitModalTitle').textContent = 'Criar Novo Kit';
        document.getElementById('kitForm')?.reset();
        document.getElementById('kitId').value = '';
        updateProdutosList();
        showModal('kitModal');
    }

    function closeKitModal() {
        hideModal('kitModal');
        editingKitId = null;
        kitProdutos = [];
    }

    function openProdutoModal() {
        selectedProduto = null;
        document.getElementById('searchProduto').value = '';
        document.getElementById('selectedProdutoInfo')?.classList.add('hidden');
        searchProdutos();
        showModal('produtoModal');
    }

    function closeProdutoModal() {
        hideModal('produtoModal');
        selectedProduto = null;
    }

    function showModal(modalId) {
        document.getElementById(modalId)?.classList.remove('hidden');
    }

    function hideModal(modalId) {
        document.getElementById(modalId)?.classList.add('hidden');
    }

    // ============================================
    // AÇÕES DE KIT
    // ============================================

    async function saveKit(event) {
        event.preventDefault();

        const nome = document.getElementById('kitNome').value.trim();
        const tipo = document.getElementById('kitTipo').value;
        const descricao = document.getElementById('kitDescricao').value.trim();

        if (!nome || !tipo) {
            showNotification('Preencha todos os campos obrigatórios', 'error');
            return;
        }

        if (kitProdutos.length === 0) {
            showNotification('Adicione pelo menos um produto ao kit', 'error');
            return;
        }

        try {
            let kitId = editingKitId;

            if (editingKitId) {
                // Atualizar kit existente
                const { error: updateError } = await window.authManager.supabase
                    .from('kits')
                    .update({ nome, tipo, descricao })
                    .eq('id', editingKitId);

                if (updateError) throw updateError;

                // Remover produtos antigos
                const { error: deleteError } = await window.authManager.supabase
                    .from('kit_produtos')
                    .delete()
                    .eq('kit_id', editingKitId);

                if (deleteError) throw deleteError;
            } else {
                // Criar novo kit
                const { data: newKit, error: insertError } = await window.authManager.supabase
                    .from('kits')
                    .insert({ nome, tipo, descricao })
                    .select()
                    .single();

                if (insertError) throw insertError;
                kitId = newKit.id;
            }

            // Adicionar produtos ao kit
            const kitProdutosData = kitProdutos.map(p => ({
                kit_id: kitId,
                produto_id: p.produto_id,
                quantidade: p.quantidade
            }));

            const { error: productsError } = await window.authManager.supabase
                .from('kit_produtos')
                .insert(kitProdutosData);

            if (productsError) throw productsError;
            showNotification(`Kit ${editingKitId ? 'atualizado' : 'criado'} com sucesso!`, 'success');
            closeKitModal();
            await loadKits(true); // Forçar recarregamento sem cache
        } catch (error) {
            console.error('❌ Erro ao salvar kit:', error);
            showNotification('Erro ao salvar kit: ' + error.message, 'error');
        }
    }

    async function editKit(kitId) {
        try {
            const kit = allKits.find(k => k.id === kitId);
            if (!kit) {
                showNotification('Kit não encontrado', 'error');
                return;
            }

            editingKitId = kitId;
            document.getElementById('kitModalTitle').textContent = 'Editar Kit';
            document.getElementById('kitId').value = kitId;
            document.getElementById('kitNome').value = kit.nome;
            document.getElementById('kitTipo').value = kit.tipo;
            document.getElementById('kitDescricao').value = kit.descricao || '';

            // Carregar produtos do kit
            kitProdutos = kit.kit_produtos.map(kp => ({
                produto_id: kp.produtoslaboratorio.id,
                nome: kp.produtoslaboratorio.nome_material,
                codigo: kp.produtoslaboratorio.qr_code,
                quantidade: kp.quantidade,
                unidade_medida: kp.produtoslaboratorio.unidade_medida,
                quantidade_estoque: kp.produtoslaboratorio.estoquelaboratorio ? kp.produtoslaboratorio.estoquelaboratorio.quantidade_atual : 0
            }));

            updateProdutosList();
            showModal('kitModal');
        } catch (error) {
            console.error('❌ Erro ao carregar kit:', error);
            showNotification('Erro ao carregar kit', 'error');
        }
    }

    async function deleteKit(kitId) {
        const kit = allKits.find(k => k.id === kitId);
        if (!kit) return;

        if (!confirm(`Tem certeza que deseja excluir o kit "${kit.nome}"?`)) {
            return;
        }

        try {
            await window.authManager.supabase
                .from('kit_produtos')
                .delete()
                .eq('kit_id', kitId);

            await window.authManager.supabase
                .from('kits')
                .delete()
                .eq('id', kitId);

            showNotification('Kit excluído com sucesso!', 'success');
            await loadKits();
        } catch (error) {
            console.error('❌ Erro ao excluir kit:', error);
            showNotification('Erro ao excluir kit: ' + error.message, 'error');
        }
    }

    // ============================================
    // PRODUTOS DO KIT
    // ============================================

    function searchProdutos() {
        const searchTerm = document.getElementById('searchProduto').value.toLowerCase();
        const filteredProdutos = allProdutos.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            (p.code && p.code.toLowerCase().includes(searchTerm))
        );

        const resultsContainer = document.getElementById('produtoSearchResults');
        if (!resultsContainer) return;

        if (filteredProdutos.length === 0) {
            resultsContainer.innerHTML = '<div class="text-center text-gray-400 py-8"><i class="fas fa-search text-4xl mb-2"></i><p>Nenhum produto encontrado</p></div>';
            return;
        }

        const html = filteredProdutos.map(produto => `
            <div data-produto-id="${produto.id}" 
                 class="produto-item p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors ${selectedProduto?.id === produto.id ? 'bg-emerald-100 dark:bg-emerald-900/30' : ''}">
                <div class="flex justify-between items-center">
                    <div>
                        <div class="font-semibold text-gray-800 dark:text-white">${escapeHtml(produto.name)}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                            ${produto.code ? `Código: ${escapeHtml(produto.code)} | ` : ''}
                            Estoque: ${produto.quantity} ${produto.unit}
                        </div>
                    </div>
                    ${selectedProduto?.id === produto.id ? '<i class="fas fa-check-circle text-emerald-600 text-xl"></i>' : ''}
                </div>
            </div>
        `).join('');

        resultsContainer.innerHTML = html;

        // Event delegation para cliques nos produtos
        resultsContainer.querySelectorAll('.produto-item').forEach(item => {
            item.addEventListener('click', () => {
                const produtoId = item.getAttribute('data-produto-id');
                selectProduto(produtoId);
            });
        });
    }

    function selectProduto(produtoId) {
        selectedProduto = allProdutos.find(p => p.id === produtoId);

        if (selectedProduto) {
            const info = document.getElementById('selectedProdutoInfo');
            const details = document.getElementById('selectedProdutoDetails');

            if (info && details) {
                details.innerHTML = `
                    <div class="font-semibold text-gray-800 dark:text-white">${escapeHtml(selectedProduto.name)}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                        ${selectedProduto.code ? `Código: ${escapeHtml(selectedProduto.code)} | ` : ''}
                        Disponível: ${selectedProduto.quantity} ${selectedProduto.unit}
                    </div>
                `;
                info.classList.remove('hidden');
            }

            searchProdutos();
        }
    }

    function addProdutoToKit() {
        if (!selectedProduto) {
            showNotification('Selecione um produto', 'error');
            return;
        }

        const quantidade = parseFloat(document.getElementById('produtoQuantidade').value);

        if (!quantidade || quantidade <= 0) {
            showNotification('Informe uma quantidade válida', 'error');
            return;
        }

        const existingIndex = kitProdutos.findIndex(p => p.produto_id === selectedProduto.id);

        if (existingIndex >= 0) {
            kitProdutos[existingIndex].quantidade = quantidade;
        } else {
            kitProdutos.push({
                produto_id: selectedProduto.id,
                nome: selectedProduto.name,
                codigo: selectedProduto.code,
                quantidade: quantidade,
                unidade_medida: selectedProduto.unit,
                quantidade_estoque: selectedProduto.quantity
            });
        }

        updateProdutosList();
        closeProdutoModal();
        showNotification('Produto adicionado ao kit', 'success');
    }

    function removeProdutoFromKit(produtoId) {
        kitProdutos = kitProdutos.filter(p => p.produto_id !== produtoId);
        updateProdutosList();
        showNotification('Produto removido do kit', 'info');
    }

    function updateProdutosList() {
        const container = document.getElementById('produtosList');
        const countElement = document.getElementById('produtoCount');

        if (!container) return;

        if (countElement) {
            countElement.textContent = `(${kitProdutos.length} ${kitProdutos.length === 1 ? 'produto' : 'produtos'})`;
        }

        if (kitProdutos.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 dark:text-gray-500 py-8"><i class="fas fa-box-open text-4xl mb-2"></i><p>Nenhum produto adicionado</p></div>';
            return;
        }

        const html = kitProdutos.map(produto => `
            <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                    <div class="font-semibold text-gray-800 dark:text-white">${escapeHtml(produto.nome)}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                        ${produto.codigo ? `Código: ${escapeHtml(produto.codigo)} | ` : ''}
                        Quantidade: ${produto.quantidade} ${produto.unidade_medida}
                    </div>
                </div>
                <button type="button" data-produto-id="${produto.produto_id}" class="remove-produto-btn text-red-600 hover:text-red-700 p-2">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        container.innerHTML = html;

        // Event listeners para botões de remover produto
        container.querySelectorAll('.remove-produto-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const produtoId = btn.getAttribute('data-produto-id');
                removeProdutoFromKit(produtoId);
            });
        });
    }

    // ============================================
    // FILTROS
    // ============================================

    function filterKits() {
        const searchTerm = document.getElementById('searchKit')?.value.toLowerCase() || '';
        const filterType = document.getElementById('filterKitType')?.value || '';

        let filtered = allKits;

        if (searchTerm) {
            filtered = filtered.filter(kit =>
                kit.nome.toLowerCase().includes(searchTerm) ||
                (kit.descricao && kit.descricao.toLowerCase().includes(searchTerm))
            );
        }

        if (filterType) {
            filtered = filtered.filter(kit => kit.tipo === filterType);
        }

        renderKits(filtered);
    }

    // ============================================
    // UTILITÁRIOS
    // ============================================

    function getTipoLabel(tipo) {
        const tipos = {
            'zirconia': 'Zircônia',
            'dissilicato': 'Dissilicato de Lítio',
            'hibrida': 'Híbridas',
            'provisoria': 'Provisórias',
            'outro': 'Outro'
        };
        return tipos[tipo] || tipo;
    }

    function getTipoColor(tipo) {
        const colors = {
            'zirconia': 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            'dissilicato': 'linear-gradient(135deg, #3b82f6, #2563eb)',
            'hibrida': 'linear-gradient(135deg, #f59e0b, #d97706)',
            'provisoria': 'linear-gradient(135deg, #10b981, #059669)',
            'outro': 'linear-gradient(135deg, #6b7280, #4b5563)'
        };
        return colors[tipo] || colors.outro;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-[10001] px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;

        const colors = {
            'success': 'bg-emerald-600 text-white',
            'error': 'bg-red-600 text-white',
            'warning': 'bg-yellow-600 text-white',
            'info': 'bg-blue-600 text-white'
        };

        notification.className += ` ${colors[type] || colors.info}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);

        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // ============================================
    // EXPOSIÇÃO PÚBLICA
    // ============================================

    let isInitialized = false;

    // Wrapper para garantir inicialização única
    function initOnce() {
        if (isInitialized) {
            console.log('⚠️ Módulo de Kits já inicializado');
            return;
        }
        isInitialized = true;
        initKitsModule();
    }

    window.kitsModule = {
        init: initOnce,
        loadKits,
        editKit,
        deleteKit,
        selectProduto,
        removeProdutoFromKit
    };

    console.log('✅ Módulo de Kits carregado (aguardando ativação da aba)');

})();
