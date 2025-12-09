// laboratorio-movimentacoes.js

let currentPage = 1;
let totalPages = 1;
let selectedProduct = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadMovimentacoes();
    setupEventListeners();
});

// Check authentication
async function checkAuth() {
    const session = getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Auto-calculate total price
    document.getElementById('entrada-quantidade').addEventListener('input', calcularPrecoTotal);
    document.getElementById('entrada-preco-unitario').addEventListener('input', calcularPrecoTotal);
    
    // Search on Enter
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadMovimentacoes();
        }
    });
}

// Calculate total price
function calcularPrecoTotal() {
    const quantidade = parseFloat(document.getElementById('entrada-quantidade').value) || 0;
    const precoUnitario = parseFloat(document.getElementById('entrada-preco-unitario').value) || 0;
    const total = quantidade * precoUnitario;
    document.getElementById('entrada-preco-total').value = total.toFixed(2);
}

// Load movimentações
async function loadMovimentacoes() {
    try {
        showLoading();
        
        const searchTerm = document.getElementById('search-input').value.trim();
        const tipo = document.getElementById('filter-tipo').value;
        const dataInicio = document.getElementById('filter-data-inicio').value;
        const dataFim = document.getElementById('filter-data-fim').value;
        
        let url = `${API_URL}/laboratorio/movimentacoes?page=${currentPage}&limit=20`;
        
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (tipo) url += `&tipo=${tipo}`;
        if (dataInicio) url += `&dataInicio=${dataInicio}`;
        if (dataFim) url += `&dataFim=${dataFim}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getSession().access_token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar movimentações');
        }
        
        const data = await response.json();
        const movimentacoes = data.data || [];
        totalPages = data.totalPages || 1;
        currentPage = data.currentPage || 1;
        
        displayMovimentacoes(movimentacoes);
        updatePagination();
        
    } catch (error) {
        console.error('Erro ao carregar movimentações:', error);
        showError('Erro ao carregar movimentações. Tente novamente.');
        showEmptyState();
    }
}

// Display movimentações in table
function displayMovimentacoes(movimentacoes) {
    const tbody = document.getElementById('movimentacoes-tbody');
    
    if (!movimentacoes || movimentacoes.length === 0) {
        showEmptyState();
        return;
    }
    
    tbody.innerHTML = movimentacoes.map(mov => `
        <tr>
            <td>
                ${formatDateTime(mov.data_movimento)}
            </td>
            <td>
                <span class="tipo-badge tipo-${mov.tipo_movimento}">
                    ${formatTipo(mov.tipo_movimento)}
                </span>
            </td>
            <td>
                <strong>${escapeHtml(mov.produto_nome || '-')}</strong>
            </td>
            <td>
                <strong>${formatNumber(mov.quantidade)}</strong> ${mov.unidade_medida || ''}
                <br>
                <small style="color: #7f8c8d;">
                    ${formatNumber(mov.quantidade_anterior || 0)} → ${formatNumber(mov.quantidade_nova || 0)}
                </small>
            </td>
            <td>${escapeHtml(mov.responsavel_nome || '-')}</td>
            <td>${mov.caso_clinico ? escapeHtml(mov.caso_clinico) : '-'}</td>
            <td>${mov.motivo ? escapeHtml(mov.motivo) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewMovimentacao('${mov.id}')">
                    👁️ Ver
                </button>
            </td>
        </tr>
    `).join('');
}

// Show loading state
function showLoading() {
    const tbody = document.getElementById('movimentacoes-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Carregando movimentações...</td></tr>';
}

// Show empty state
function showEmptyState() {
    const tbody = document.getElementById('movimentacoes-tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="empty-state">
                <div style="font-size: 48px; margin-bottom: 15px;">📦</div>
                <div>Nenhuma movimentação encontrada</div>
            </td>
        </tr>
    `;
}

// Clear filters
function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('filter-tipo').value = '';
    document.getElementById('filter-data-inicio').value = '';
    document.getElementById('filter-data-fim').value = '';
    loadMovimentacoes();
}

// Pagination
function updatePagination() {
    document.getElementById('page-info').textContent = `Página ${currentPage} de ${totalPages}`;
    document.getElementById('btn-prev').disabled = currentPage === 1;
    document.getElementById('btn-next').disabled = currentPage === totalPages;
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadMovimentacoes();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadMovimentacoes();
    }
}

// Show entrada modal
function showEntradaModal() {
    document.getElementById('entrada-form').reset();
    document.getElementById('entrada-produto-id').value = '';
    document.getElementById('entrada-product-preview').style.display = 'none';
    selectedProduct = null;
    document.getElementById('entrada-modal').classList.add('active');
}

// Close entrada modal
function closeEntradaModal() {
    document.getElementById('entrada-modal').classList.remove('active');
}

// Show saida modal
function showSaidaModal() {
    document.getElementById('saida-form').reset();
    document.getElementById('saida-produto-id').value = '';
    document.getElementById('saida-product-preview').style.display = 'none';
    selectedProduct = null;
    document.getElementById('saida-modal').classList.add('active');
}

// Close saida modal
function closeSaidaModal() {
    document.getElementById('saida-modal').classList.remove('active');
}

// Start scanner (placeholder - would integrate with real scanner library)
function startScanner(tipo) {
    // TODO: Integrate with QR Code scanner library (like html5-qrcode)
    alert('Scanner de QR Code/Código de Barras\n\nEm desenvolvimento: Será integrado com biblioteca de leitura de câmera.');
    
    // For now, focus on manual input
    if (tipo === 'entrada') {
        document.getElementById('entrada-codigo-manual').focus();
    } else {
        document.getElementById('saida-codigo-manual').focus();
    }
}

// Buscar produto
async function buscarProduto(tipo) {
    try {
        const codigo = document.getElementById(`${tipo}-codigo-manual`).value.trim();
        
        if (!codigo) {
            showError('Digite um código para buscar.');
            return;
        }
        
        // Try to search by QR code or barcode
        const response = await fetch(`${API_URL}/laboratorio/produtos/codigo/${encodeURIComponent(codigo)}`, {
            headers: {
                'Authorization': `Bearer ${getSession().access_token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Produto não encontrado');
        }
        
        const produto = await response.json();
        selectedProduct = produto;
        
        // Show product preview
        document.getElementById(`${tipo}-produto-id`).value = produto.id;
        document.getElementById(`${tipo}-product-preview`).style.display = 'block';
        document.getElementById(`${tipo}-product-info`).innerHTML = `
            <div class="product-info-item">
                <span class="label">Nome:</span>
                <span>${escapeHtml(produto.nome_material)}</span>
            </div>
            <div class="product-info-item">
                <span class="label">Marca:</span>
                <span>${produto.marca || '-'}</span>
            </div>
            <div class="product-info-item">
                <span class="label">Estoque Atual:</span>
                <span><strong>${formatNumber(produto.quantidade_atual || 0)} ${produto.unidade_medida}</strong></span>
            </div>
            <div class="product-info-item">
                <span class="label">Localização:</span>
                <span>${produto.localizacao || '-'}</span>
            </div>
            <div class="product-info-item">
                <span class="label">Status:</span>
                <span>
                    <span class="status-badge status-${produto.status || 'ok'}">
                        ${formatStatus(produto.status || 'ok')}
                    </span>
                </span>
            </div>
        `;
        
        // Focus on quantity field
        document.getElementById(`${tipo}-quantidade`).focus();
        
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        showError('Produto não encontrado. Verifique o código digitado.');
    }
}

// Save entrada
async function saveEntrada() {
    try {
        const produtoId = document.getElementById('entrada-produto-id').value;
        
        if (!produtoId) {
            showError('Por favor, busque e selecione um produto primeiro.');
            return;
        }
        
        const quantidade = parseFloat(document.getElementById('entrada-quantidade').value);
        
        if (!quantidade || quantidade <= 0) {
            showError('Digite uma quantidade válida.');
            return;
        }
        
        const data = {
            produto_id: produtoId,
            quantidade: quantidade,
            fornecedor: document.getElementById('entrada-fornecedor').value || null,
            numero_pedido: document.getElementById('entrada-numero-pedido').value || null,
            preco_unitario: parseFloat(document.getElementById('entrada-preco-unitario').value) || null,
            motivo: document.getElementById('entrada-motivo').value || 'Entrada de estoque',
            observacoes: document.getElementById('entrada-observacoes').value || null
        };
        
        const response = await fetch(`${API_URL}/laboratorio/movimentacoes/entrada`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getSession().access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao registrar entrada');
        }
        
        showSuccess('Entrada registrada com sucesso!');
        closeEntradaModal();
        loadMovimentacoes();
        
    } catch (error) {
        console.error('Erro ao registrar entrada:', error);
        showError(error.message || 'Erro ao registrar entrada.');
    }
}

// Save saida
async function saveSaida() {
    try {
        const produtoId = document.getElementById('saida-produto-id').value;
        
        if (!produtoId) {
            showError('Por favor, busque e selecione um produto primeiro.');
            return;
        }
        
        const quantidade = parseFloat(document.getElementById('saida-quantidade').value);
        
        if (!quantidade || quantidade <= 0) {
            showError('Digite uma quantidade válida.');
            return;
        }
        
        // Check if quantity is available
        if (selectedProduct && quantidade > selectedProduct.quantidade_atual) {
            const confirmar = confirm(
                `Atenção: A quantidade solicitada (${quantidade}) é maior que o estoque disponível (${selectedProduct.quantidade_atual}).\n\n` +
                `Deseja continuar mesmo assim?`
            );
            if (!confirmar) return;
        }
        
        const data = {
            produto_id: produtoId,
            quantidade: quantidade,
            caso_clinico: document.getElementById('saida-caso-clinico').value || null,
            paciente: document.getElementById('saida-paciente').value || null,
            setor: document.getElementById('saida-setor').value || null,
            motivo: document.getElementById('saida-motivo').value || 'Saída de estoque',
            observacoes: document.getElementById('saida-observacoes').value || null
        };
        
        const response = await fetch(`${API_URL}/laboratorio/movimentacoes/saida`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getSession().access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao registrar saída');
        }
        
        showSuccess('Saída registrada com sucesso!');
        closeSaidaModal();
        loadMovimentacoes();
        
    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        showError(error.message || 'Erro ao registrar saída.');
    }
}

// View movimentação details
async function viewMovimentacao(movimentacaoId) {
    try {
        const response = await fetch(`${API_URL}/laboratorio/movimentacoes/${movimentacaoId}`, {
            headers: {
                'Authorization': `Bearer ${getSession().access_token}`
            }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar detalhes');
        
        const mov = await response.json();
        
        const html = `
            <div style="display: grid; gap: 20px;">
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Informações da Movimentação</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; font-weight: bold; width: 40%;">Tipo:</td>
                            <td style="padding: 8px;">
                                <span class="tipo-badge tipo-${mov.tipo_movimento}">
                                    ${formatTipo(mov.tipo_movimento)}
                                </span>
                            </td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Data/Hora:</td>
                            <td style="padding: 8px;">${formatDateTime(mov.data_movimento)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Produto:</td>
                            <td style="padding: 8px;">${escapeHtml(mov.produto_nome || '-')}</td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Quantidade:</td>
                            <td style="padding: 8px;"><strong>${formatNumber(mov.quantidade)} ${mov.unidade_medida || ''}</strong></td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Saldo Anterior:</td>
                            <td style="padding: 8px;">${formatNumber(mov.quantidade_anterior || 0)}</td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Saldo Novo:</td>
                            <td style="padding: 8px;">${formatNumber(mov.quantidade_nova || 0)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Responsável:</td>
                            <td style="padding: 8px;">${escapeHtml(mov.responsavel_nome || '-')}</td>
                        </tr>
                    </table>
                </div>
                
                ${mov.caso_clinico || mov.paciente || mov.setor ? `
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Informações Clínicas</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        ${mov.caso_clinico ? `
                        <tr>
                            <td style="padding: 8px; font-weight: bold; width: 40%;">Caso Clínico:</td>
                            <td style="padding: 8px;">${escapeHtml(mov.caso_clinico)}</td>
                        </tr>
                        ` : ''}
                        ${mov.paciente ? `
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Paciente:</td>
                            <td style="padding: 8px;">${escapeHtml(mov.paciente)}</td>
                        </tr>
                        ` : ''}
                        ${mov.setor ? `
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Setor:</td>
                            <td style="padding: 8px;">${escapeHtml(mov.setor)}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                ` : ''}
                
                ${mov.fornecedor || mov.numero_pedido || mov.preco_unitario ? `
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Informações de Compra</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        ${mov.fornecedor ? `
                        <tr>
                            <td style="padding: 8px; font-weight: bold; width: 40%;">Fornecedor:</td>
                            <td style="padding: 8px;">${escapeHtml(mov.fornecedor)}</td>
                        </tr>
                        ` : ''}
                        ${mov.numero_pedido ? `
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Número do Pedido:</td>
                            <td style="padding: 8px;">${escapeHtml(mov.numero_pedido)}</td>
                        </tr>
                        ` : ''}
                        ${mov.preco_unitario ? `
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Preço Unitário:</td>
                            <td style="padding: 8px;">€ ${formatNumber(mov.preco_unitario)}</td>
                        </tr>
                        ` : ''}
                        ${mov.preco_total ? `
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Preço Total:</td>
                            <td style="padding: 8px;"><strong>€ ${formatNumber(mov.preco_total)}</strong></td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                ` : ''}
                
                ${mov.motivo ? `
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Motivo</h3>
                    <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">${escapeHtml(mov.motivo)}</p>
                </div>
                ` : ''}
                
                ${mov.observacoes ? `
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Observações</h3>
                    <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">${escapeHtml(mov.observacoes)}</p>
                </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('view-modal-body').innerHTML = html;
        document.getElementById('view-modal').classList.add('active');
        
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showError('Erro ao carregar detalhes da movimentação.');
    }
}

// Close view modal
function closeViewModal() {
    document.getElementById('view-modal').classList.remove('active');
}

// Utility functions
function formatTipo(tipo) {
    const tipos = {
        'entrada': 'Entrada',
        'saida': 'Saída',
        'ajuste': 'Ajuste',
        'perda': 'Perda',
        'transferencia': 'Transferência'
    };
    return tipos[tipo] || tipo;
}

function formatStatus(status) {
    const statuses = {
        'ok': 'OK',
        'alerta': 'Alerta',
        'critico': 'Crítico',
        'vencido': 'Vencido',
        'vencendo': 'Vencendo'
    };
    return statuses[status] || status;
}

function formatNumber(number) {
    return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(number);
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '-';
    const date = new Date(dateTimeString);
    return date.toLocaleString('pt-PT');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Alert functions
function showSuccess(message) {
    showAlert(message, 'success');
}

function showError(message) {
    showAlert(message, 'danger');
}

function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    container.innerHTML = '';
    container.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

