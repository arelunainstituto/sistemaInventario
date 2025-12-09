// RH Performance Module

const performanceTemplate = `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <!-- Toolbar -->
        <div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4 bg-gray-50">
            <div class="flex gap-2 flex-1">
                <select id="reviewStatusFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todos Status</option>
                    <option value="DRAFT">Rascunho</option>
                    <option value="COMPLETED">Concluído</option>
                </select>
            </div>
            <button onclick="openReviewModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2" data-permission="hr:manage_reviews">
                <i class="fas fa-star"></i>
                Nova Avaliação
            </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="w-full rh-table">
                <thead>
                    <tr>
                        <th class="px-6 py-3 text-left">Funcionário</th>
                        <th class="px-6 py-3 text-left">Tipo</th>
                        <th class="px-6 py-3 text-left">Período</th>
                        <th class="px-6 py-3 text-center">Nota Geral</th>
                        <th class="px-6 py-3 text-center">Status</th>
                        <th class="px-6 py-3 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody id="reviewsTableBody" class="divide-y divide-gray-200 bg-white">
                    <!-- Rows injected by JS -->
                </tbody>
            </table>
        </div>
    </div>

    <!-- Review Modal -->
    <div id="reviewModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
            <div class="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 class="text-xl font-bold text-gray-800">Avaliação de Desempenho</h3>
                <button onclick="closeReviewModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <form id="reviewForm" onsubmit="handleReviewSubmit(event)" class="p-6 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="form-label">Funcionário *</label>
                        <select name="employee_id" id="reviewEmployeeSelect" required class="form-input">
                            <option value="">Carregando...</option>
                        </select>
                    </div>

                    <div>
                        <label class="form-label">Tipo *</label>
                        <select name="review_type" required class="form-input">
                            <option value="ANNUAL">Anual</option>
                            <option value="PROBATION">Experiência</option>
                            <option value="PROJECT">Projeto</option>
                            <option value="360">Feedback 360°</option>
                        </select>
                    </div>

                    <div>
                        <label class="form-label">Início do Período *</label>
                        <input type="date" name="review_period_start" required class="form-input">
                    </div>

                    <div>
                        <label class="form-label">Fim do Período *</label>
                        <input type="date" name="review_period_end" required class="form-input">
                    </div>
                </div>

                <!-- Scores -->
                <div>
                    <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Critérios (1-5)</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="form-label">Produtividade</label>
                            <input type="number" name="productivity_score" min="1" max="5" required class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Qualidade</label>
                            <input type="number" name="quality_score" min="1" max="5" required class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Trabalho em Equipe</label>
                            <input type="number" name="teamwork_score" min="1" max="5" required class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Pontualidade</label>
                            <input type="number" name="punctuality_score" min="1" max="5" required class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Iniciativa</label>
                            <input type="number" name="initiative_score" min="1" max="5" required class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Comunicação</label>
                            <input type="number" name="communication_score" min="1" max="5" required class="form-input">
                        </div>
                    </div>
                </div>

                <!-- Text Fields -->
                <div class="space-y-4">
                    <div>
                        <label class="form-label">Pontos Fortes</label>
                        <textarea name="strengths" rows="3" class="form-input"></textarea>
                    </div>
                    <div>
                        <label class="form-label">Pontos a Melhorar</label>
                        <textarea name="areas_for_improvement" rows="3" class="form-input"></textarea>
                    </div>
                    <div>
                        <label class="form-label">Metas</label>
                        <textarea name="goals" rows="3" class="form-input"></textarea>
                    </div>
                </div>

                <div class="pt-6 border-t border-gray-200 flex justify-end gap-3">
                    <button type="button" onclick="closeReviewModal()" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                    <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">Salvar Avaliação</button>
                </div>
            </form>
        </div>
    </div>
`;

window.loadPerformance = async function () {
    const container = document.getElementById('performance-tab');
    if (!container.innerHTML.includes('reviewsTableBody')) {
        container.innerHTML = performanceTemplate;

        // Listeners
        document.getElementById('reviewStatusFilter').addEventListener('change', loadReviewsList);
    }

    await loadReviewsList();
};

async function loadReviewsList() {
    window.showLoading();
    try {
        const status = document.getElementById('reviewStatusFilter').value;

        const params = new URLSearchParams({ status });
        const response = await window.authenticatedFetch(`/api/rh/performance?${params}`);

        if (!response.ok) throw new Error('Erro ao carregar avaliações');

        const { data } = await response.json();
        renderReviewsTable(data);

    } catch (error) {
        console.error(error);
        alert('Erro ao carregar avaliações');
    } finally {
        window.hideLoading();
    }
}

function renderReviewsTable(reviews) {
    const tbody = document.getElementById('reviewsTableBody');
    tbody.innerHTML = reviews.map(r => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">${r.rh_employees?.name || 'N/A'}</div>
                <div class="text-xs text-gray-500">${r.rh_employees?.role || ''}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">
                ${formatReviewType(r.review_type)}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                ${new Date(r.review_period_end).getFullYear()}
            </td>
            <td class="px-6 py-4 text-center">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(r.overall_score)}">
                    ${r.overall_score ? r.overall_score.toFixed(1) : '-'}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <span class="badge ${r.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}">
                    ${r.status === 'COMPLETED' ? 'Concluído' : 'Rascunho'}
                </span>
            </td>
            <td class="px-6 py-4 text-right text-sm font-medium">
                <button class="text-purple-600 hover:text-purple-900 mr-3">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');

    if (reviews.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Nenhuma avaliação encontrada</td></tr>`;
    }
}

window.openReviewModal = async function () {
    const modal = document.getElementById('reviewModal');
    const select = document.getElementById('reviewEmployeeSelect');

    // Load employees
    if (select.options.length <= 1) {
        try {
            const response = await window.authenticatedFetch('/api/rh/employees?status=ACTIVE');
            const { data } = await response.json();
            select.innerHTML = '<option value="">Selecione...</option>' +
                data.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        } catch (error) {
            console.error(error);
        }
    }

    modal.classList.remove('hidden');
};

window.closeReviewModal = function () {
    document.getElementById('reviewModal').classList.add('hidden');
};

window.handleReviewSubmit = async function (e) {
    e.preventDefault();
    window.showLoading();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Convert scores to numbers
    ['productivity_score', 'quality_score', 'teamwork_score', 'punctuality_score', 'initiative_score', 'communication_score'].forEach(key => {
        if (data[key]) data[key] = parseInt(data[key]);
    });

    data.status = 'COMPLETED'; // For now, auto-complete

    try {
        const response = await window.authenticatedFetch('/api/rh/performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Erro ao salvar');

        window.closeReviewModal();
        await loadReviewsList();
        alert('Avaliação salva com sucesso!');

    } catch (error) {
        console.error(error);
        alert('Erro ao salvar avaliação');
    } finally {
        window.hideLoading();
    }
};

function formatReviewType(type) {
    const types = {
        'ANNUAL': 'Anual',
        'PROBATION': 'Experiência',
        'PROJECT': 'Projeto',
        '360': 'Feedback 360°'
    };
    return types[type] || type;
}

function getScoreColor(score) {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score >= 4.5) return 'bg-green-100 text-green-800';
    if (score >= 3.5) return 'bg-blue-100 text-blue-800';
    if (score >= 2.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
}
