// laboratorio-produtos.js

// Inicializar cliente Supabase
const supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
);

let currentPage = 1;
let totalPages = 1;
let currentSort = { field: 'nome_material', order: 'asc' };
let allProducts = [];
let currentSession = null;

// Helper function to get session
async function getSession() {
    if (currentSession) return currentSession;
    const { data: { session } } = await supabase.auth.getSession();
    currentSession = session;
    return session;
}

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth();
    loadProducts();
    loadStats();
    
    // Search on Enter
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadProducts();
        }
    });
});

// Check authentication
async function checkAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
}

// Load products
async function loadProducts() {
    try {
        showLoading();
        
        const searchTerm = document.getElementById('search-input').value.trim();
        const categoria = document.getElementById('filter-categoria').value;
        const status = document.getElementById('filter-status').value;
        
        let url = `${window.CONFIG.API_URL}/laboratorio/produtos?page=${currentPage}&limit=20`;
        
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (categoria) url += `&categoria=${categoria}`;
        if (status) url += `&status=${status}`;
        if (currentSort.field) url += `&sort=${currentSort.field}&order=${currentSort.order}`;
        
        const session = await getSession();
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar produtos');
        }
        
        const data = await response.json();
        allProducts = data.data || [];
        totalPages = data.totalPages || 1;
        currentPage = data.currentPage || 1;
        
        displayProducts(allProducts);
        updatePagination();
        
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showError('Erro ao carregar produtos. Tente novamente.');
        showEmptyState();
    }
}

// Display products in table
function displayProducts(products) {
    const tbody = document.getElementById('products-tbody');
    
    if (!products || products.length === 0) {
        showEmptyState();
        return;
    }
    
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>
                <strong>${escapeHtml(product.nome_material)}</strong>
                ${product.marca ? `<br><small style="color: #7f8c8d;">${escapeHtml(product.marca)}</small>` : ''}
            </td>
            <td>${formatCategoria(product.categoria)}</td>
            <td>${product.marca || '-'}</td>
            <td>
                <strong>${formatNumber(product.quantidade_atual || 0)}</strong> ${product.unidade_medida}
                ${product.quantidade_minima > 0 ? `<br><small style="color: #7f8c8d;">Mín: ${formatNumber(product.quantidade_minima)}</small>` : ''}
            </td>
            <td>
                <span class="status-badge status-${product.status || 'ok'}">
                    ${formatStatus(product.status || 'ok')}
                </span>
            </td>
            <td>${product.localizacao || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary btn-icon tooltip" onclick="viewProduct('${product.id}')" title="Ver detalhes">
                        👁️
                    </button>
                    <button class="btn btn-sm btn-warning btn-icon tooltip" onclick="editProduct('${product.id}')" title="Editar">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-success btn-icon tooltip" onclick="quickEntry('${product.id}')" title="Entrada rápida">
                        ➕
                    </button>
                    <button class="btn btn-sm btn-danger btn-icon tooltip" onclick="quickExit('${product.id}')" title="Saída rápida">
                        ➖
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Show loading state
function showLoading() {
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Carregando produtos...</td></tr>';
}

// Show empty state
function showEmptyState() {
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div>Nenhum produto encontrado</div>
                <div style="margin-top: 10px;">
                    <button class="btn btn-primary" onclick="showAddProductModal()">Adicionar Primeiro Produto</button>
                </div>
            </td>
        </tr>
    `;
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch(`${window.CONFIG.API_URL}/laboratorio/produtos/stats`, {
            headers: {
                'Authorization': `Bearer ${(await getSession()).access_token}`
            }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar estatísticas');
        
        const stats = await response.json();
        
        document.getElementById('stat-total').textContent = stats.total || 0;
        document.getElementById('stat-ok').textContent = stats.ok || 0;
        document.getElementById('stat-alerta').textContent = stats.alerta || 0;
        document.getElementById('stat-critico').textContent = stats.critico || 0;
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
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
        loadProducts();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadProducts();
    }
}

// Sort table
function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.order = 'asc';
    }
    loadProducts();
}

// Show add product modal
function showAddProductModal() {
    document.getElementById('modal-title').textContent = 'Novo Produto';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-modal').classList.add('active');
}

// Close product modal
function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
}

// Save product
async function saveProduct() {
    try {
        const productId = document.getElementById('product-id').value;
        const isEdit = !!productId;
        
        const productData = {
            nome_material: document.getElementById('nome_material').value,
            categoria: document.getElementById('categoria').value,
            marca: document.getElementById('marca').value || null,
            fornecedor: document.getElementById('fornecedor').value || null,
            unidade_medida: document.getElementById('unidade_medida').value,
            referencia_lote: document.getElementById('referencia_lote').value || null,
            localizacao: document.getElementById('localizacao').value || null,
            codigo_barras: document.getElementById('codigo_barras').value || null,
            data_validade: document.getElementById('data_validade').value || null,
            descricao: document.getElementById('descricao').value || null,
            observacoes: document.getElementById('observacoes').value || null,
            ativo: document.getElementById('ativo').value === 'true'
        };
        
        // Validações
        if (!productData.nome_material || !productData.categoria || !productData.unidade_medida) {
            showError('Por favor, preencha todos os campos obrigatórios.');
            return;
        }
        
        // Se for novo produto, incluir dados de estoque
        if (!isEdit) {
            productData.quantidade_inicial = parseFloat(document.getElementById('quantidade_inicial').value) || 0;
            productData.quantidade_minima = parseFloat(document.getElementById('quantidade_minima').value) || 0;
            productData.quantidade_maxima = parseFloat(document.getElementById('quantidade_maxima').value) || null;
        }
        
        const url = isEdit 
            ? `${window.CONFIG.API_URL}/laboratorio/produtos/${productId}`
            : `${window.CONFIG.API_URL}/laboratorio/produtos`;
        
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${(await getSession()).access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao salvar produto');
        }
        
        showSuccess(isEdit ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!');
        closeProductModal();
        loadProducts();
        loadStats();
        
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showError(error.message || 'Erro ao salvar produto. Tente novamente.');
    }
}

// Edit product
async function editProduct(productId) {
    try {
        const response = await fetch(`${window.CONFIG.API_URL}/laboratorio/produtos/${productId}`, {
            headers: {
                'Authorization': `Bearer ${(await getSession()).access_token}`
            }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar produto');
        
        const product = await response.json();
        
        document.getElementById('modal-title').textContent = 'Editar Produto';
        document.getElementById('product-id').value = product.id;
        document.getElementById('nome_material').value = product.nome_material || '';
        document.getElementById('categoria').value = product.categoria || '';
        document.getElementById('marca').value = product.marca || '';
        document.getElementById('fornecedor').value = product.fornecedor || '';
        document.getElementById('unidade_medida').value = product.unidade_medida || '';
        document.getElementById('referencia_lote').value = product.referencia_lote || '';
        document.getElementById('localizacao').value = product.localizacao || '';
        document.getElementById('codigo_barras').value = product.codigo_barras || '';
        document.getElementById('data_validade').value = product.data_validade || '';
        document.getElementById('descricao').value = product.descricao || '';
        document.getElementById('observacoes').value = product.observacoes || '';
        document.getElementById('ativo').value = product.ativo ? 'true' : 'false';
        
        // Esconder campos de estoque inicial na edição
        document.getElementById('quantidade_inicial').value = '';
        document.getElementById('quantidade_minima').value = '';
        document.getElementById('quantidade_maxima').value = '';
        
        document.getElementById('product-modal').classList.add('active');
        
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        showError('Erro ao carregar dados do produto.');
    }
}

// View product details
async function viewProduct(productId) {
    try {
        const response = await fetch(`${window.CONFIG.API_URL}/laboratorio/produtos/${productId}/detalhes`, {
            headers: {
                'Authorization': `Bearer ${(await getSession()).access_token}`
            }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar detalhes');
        
        const product = await response.json();
        
        const html = `
            <div style="display: grid; gap: 20px;">
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Informações do Produto</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; font-weight: bold; width: 40%;">Nome:</td>
                            <td style="padding: 8px;">${escapeHtml(product.nome_material)}</td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Categoria:</td>
                            <td style="padding: 8px;">${formatCategoria(product.categoria)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Marca:</td>
                            <td style="padding: 8px;">${product.marca || '-'}</td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Fornecedor:</td>
                            <td style="padding: 8px;">${product.fornecedor || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Unidade:</td>
                            <td style="padding: 8px;">${product.unidade_medida}</td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Localização:</td>
                            <td style="padding: 8px;">${product.localizacao || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">QR Code:</td>
                            <td style="padding: 8px; font-family: monospace; font-size: 12px;">${product.qr_code || '-'}</td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Código de Barras:</td>
                            <td style="padding: 8px;">${product.codigo_barras || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Data Validade:</td>
                            <td style="padding: 8px;">${product.data_validade ? formatDate(product.data_validade) : '-'}</td>
                        </tr>
                    </table>
                </div>
                
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Estoque</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; font-weight: bold; width: 40%;">Quantidade Atual:</td>
                            <td style="padding: 8px;"><strong>${formatNumber(product.quantidade_atual || 0)} ${product.unidade_medida}</strong></td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Quantidade Mínima:</td>
                            <td style="padding: 8px;">${formatNumber(product.quantidade_minima || 0)} ${product.unidade_medida}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Quantidade Máxima:</td>
                            <td style="padding: 8px;">${product.quantidade_maxima ? formatNumber(product.quantidade_maxima) + ' ' + product.unidade_medida : '-'}</td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 8px; font-weight: bold;">Status:</td>
                            <td style="padding: 8px;">
                                <span class="status-badge status-${product.status || 'ok'}">
                                    ${formatStatus(product.status || 'ok')}
                                </span>
                            </td>
                        </tr>
                    </table>
                </div>
                
                ${product.descricao ? `
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Descrição</h3>
                    <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">${escapeHtml(product.descricao)}</p>
                </div>
                ` : ''}
                
                ${product.observacoes ? `
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Observações</h3>
                    <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">${escapeHtml(product.observacoes)}</p>
                </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('view-modal-body').innerHTML = html;
        document.getElementById('view-modal').classList.add('active');
        
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showError('Erro ao carregar detalhes do produto.');
    }
}

// Close view modal
function closeViewModal() {
    document.getElementById('view-modal').classList.remove('active');
}

// Quick entry
async function quickEntry(productId) {
    const quantidade = prompt('Quantidade de entrada:');
    if (!quantidade || isNaN(quantidade) || parseFloat(quantidade) <= 0) {
        showError('Quantidade inválida.');
        return;
    }
    
    const motivo = prompt('Motivo da entrada (opcional):') || 'Entrada rápida';
    
    try {
        const response = await fetch(`${window.CONFIG.API_URL}/laboratorio/movimentacoes/entrada`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${(await getSession()).access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                produto_id: productId,
                quantidade: parseFloat(quantidade),
                motivo: motivo
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao registrar entrada');
        }
        
        showSuccess('Entrada registrada com sucesso!');
        loadProducts();
        loadStats();
        
    } catch (error) {
        console.error('Erro ao registrar entrada:', error);
        showError(error.message || 'Erro ao registrar entrada.');
    }
}

// Quick exit
async function quickExit(productId) {
    const quantidade = prompt('Quantidade de saída:');
    if (!quantidade || isNaN(quantidade) || parseFloat(quantidade) <= 0) {
        showError('Quantidade inválida.');
        return;
    }
    
    const motivo = prompt('Motivo da saída (opcional):') || 'Saída rápida';
    
    try {
        const response = await fetch(`${window.CONFIG.API_URL}/laboratorio/movimentacoes/saida`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${(await getSession()).access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                produto_id: productId,
                quantidade: parseFloat(quantidade),
                motivo: motivo
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao registrar saída');
        }
        
        showSuccess('Saída registrada com sucesso!');
        loadProducts();
        loadStats();
        
    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        showError(error.message || 'Erro ao registrar saída.');
    }
}

// Utility functions
function formatCategoria(categoria) {
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

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-PT');
}

function escapeHtml(text) {
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

