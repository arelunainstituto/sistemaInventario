// RH Absences Module

const absencesTemplate = `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <!-- Toolbar -->
        <div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4 bg-gray-50">
            <div class="flex gap-2 flex-1">
                <select id="absenceStatusFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todos Status</option>
                    <option value="PENDING">Pendentes</option>
                    <option value="APPROVED">Aprovados</option>
                    <option value="REJECTED">Rejeitados</option>
                </select>
                <select id="absenceTypeFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todos Tipos</option>
                    <option value="FERIAS">Férias</option>
                    <option value="ATESTADO">Atestado</option>
                    <option value="FOLGA">Folga</option>
                </select>
            </div>
            <button onclick="openAbsenceModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2" data-permission="hr:request_absence">
                <i class="fas fa-plus"></i>
                Solicitar Ausência
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
                        <th class="px-6 py-3 text-center">Dias</th>
                        <th class="px-6 py-3 text-center">Status</th>
                        <th class="px-6 py-3 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody id="absencesTableBody" class="divide-y divide-gray-200 bg-white">
                    <!-- Rows injected by JS -->
                </tbody>
            </table>
        </div>
    </div>

    <!-- Absence Request Modal -->
    <div id="absenceModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4">
            <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-800">Solicitar Ausência</h3>
                <button onclick="closeAbsenceModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <form id="absenceForm" onsubmit="handleAbsenceSubmit(event)" class="p-6 space-y-4">
                <div>
                    <label class="form-label">Funcionário *</label>
                    <select name="employee_id" id="absenceEmployeeSelect" required class="form-input">
                        <option value="">Carregando...</option>
                    </select>
                </div>

                <div>
                    <label class="form-label">Tipo *</label>
                    <select name="type" required class="form-input">
                        <option value="FERIAS">Férias</option>
                        <option value="ATESTADO">Atestado Médico</option>
                        <option value="LICENCA_MATERNIDADE">Licença Maternidade</option>
                        <option value="LICENCA_PATERNIDADE">Licença Paternidade</option>
                        <option value="FOLGA">Folga Compensatória</option>
                        <option value="FALTA_JUSTIFICADA">Falta Justificada</option>
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Início *</label>
                        <input type="date" name="start_date" required class="form-input">
                    </div>
                    <div>
                        <label class="form-label">Fim *</label>
                        <input type="date" name="end_date" required class="form-input">
                    </div>
                </div>

                <div>
                    <label class="form-label">Motivo (Opcional)</label>
                    <textarea name="reason" rows="3" class="form-input"></textarea>
                </div>

                <div class="pt-4 border-t border-gray-200 flex justify-end gap-3">
                    <button type="button" onclick="closeAbsenceModal()" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                    <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">Solicitar</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Approve Confirmation Modal -->
    <div id="approveConfirmModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md m-4">
            <div class="p-6 border-b border-gray-200">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <i class="fas fa-check text-green-600 text-xl"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800">Aprovar Ausência</h3>
                </div>
            </div>
            
            <div class="p-6">
                <p class="text-gray-600">Tem certeza que deseja aprovar esta solicitação de ausência?</p>
            </div>

            <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button onclick="closeApproveModal()" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                <button onclick="confirmApprove()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    <i class="fas fa-check mr-2"></i>Aprovar
                </button>
            </div>
        </div>
    </div>

    <!-- Reject Modal -->
    <div id="rejectModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md m-4">
            <div class="p-6 border-b border-gray-200">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <i class="fas fa-times text-red-600 text-xl"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800">Rejeitar Ausência</h3>
                </div>
            </div>
            
            <div class="p-6 space-y-4">
                <p class="text-gray-600">Por favor, informe o motivo da rejeição:</p>
                <textarea id="rejectionReasonInput" rows="3" class="form-input" placeholder="Motivo da rejeição..."></textarea>
            </div>

            <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button onclick="closeRejectModal()" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                <button onclick="confirmReject()" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                    <i class="fas fa-times mr-2"></i>Rejeitar
                </button>
            </div>
        </div>
    </div>

    <!-- Success Toast -->
    <div id="successToast" class="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg hidden z-50 flex items-center gap-3">
        <i class="fas fa-check-circle"></i>
        <span id="successToastMessage"></span>
    </div>
`;

window.loadAbsences = async function () {
    const container = document.getElementById('absences-tab');
    if (!container.innerHTML.includes('absencesTableBody')) {
        container.innerHTML = absencesTemplate;

        // Listeners
        document.getElementById('absenceStatusFilter').addEventListener('change', loadAbsencesList);
        document.getElementById('absenceTypeFilter').addEventListener('change', loadAbsencesList);
    }

    await loadAbsencesList();
};

async function loadAbsencesList() {
    window.showLoading();
    try {
        const status = document.getElementById('absenceStatusFilter').value;
        const type = document.getElementById('absenceTypeFilter').value;

        const params = new URLSearchParams({ status, type });
        const response = await window.authenticatedFetch(`/api/rh/absences?${params}`);

        if (!response.ok) throw new Error('Erro ao carregar ausências');

        const { data } = await response.json();
        renderAbsencesTable(data);

    } catch (error) {
        console.error(error);
        alert('Erro ao carregar ausências');
    } finally {
        window.hideLoading();
    }
}

function renderAbsencesTable(absences) {
    const tbody = document.getElementById('absencesTableBody');
    tbody.innerHTML = absences.map(a => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">${a.rh_employees?.name || 'N/A'}</div>
                <div class="text-xs text-gray-500">${a.rh_employees?.department || ''}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">
                ${formatAbsenceType(a.type)}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                ${new Date(a.start_date).toLocaleDateString('pt-PT')} até ${new Date(a.end_date).toLocaleDateString('pt-PT')}
            </td>
            <td class="px-6 py-4 text-center text-sm font-medium text-gray-900">
                ${a.days_count}
            </td>
            <td class="px-6 py-4 text-center">
                <span class="badge ${getAbsenceStatusBadge(a.status)}">
                    ${getAbsenceStatusLabel(a.status)}
                </span>
            </td>
            <td class="px-6 py-4 text-right text-sm font-medium">
                ${a.status === 'PENDING' ? `
                    <button onclick="approveAbsence('${a.id}')" class="text-green-600 hover:text-green-900 mr-3" title="Aprovar" data-permission="hr:approve_absences">
                        <i class="fas fa-check"></i>
                    </button>
                    <button onclick="rejectAbsence('${a.id}')" class="text-red-600 hover:text-red-900" title="Rejeitar" data-permission="hr:approve_absences">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');

    if (absences.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Nenhuma ausência encontrada</td></tr>`;
    }
}

window.openAbsenceModal = async function () {
    const modal = document.getElementById('absenceModal');
    const select = document.getElementById('absenceEmployeeSelect');

    // Load employees
    if (select.options.length <= 1) {
        try {
            console.log('[Absences] Fetching employees...');
            const response = await window.authenticatedFetch('/api/rh/employees?status=ACTIVE');
            console.log('[Absences] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Absences] Error response:', errorText);
                throw new Error(`Failed to fetch employees: ${response.status}`);
            }

            const { data } = await response.json();
            console.log('[Absences] Employees loaded:', data.length);

            select.innerHTML = '<option value="">Selecione...</option>' +
                data.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        } catch (error) {
            console.error('[Absences] Error loading employees:', error);
            select.innerHTML = '<option value="">Erro ao carregar funcionários</option>';
            showSuccessToast('Erro ao carregar lista de funcionários. Verifique as permissões.');
        }
    }

    modal.classList.remove('hidden');
};

window.closeAbsenceModal = function () {
    document.getElementById('absenceModal').classList.add('hidden');
};

window.handleAbsenceSubmit = async function (e) {
    e.preventDefault();
    window.showLoading();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await window.authenticatedFetch('/api/rh/absences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Erro ao solicitar');

        window.closeAbsenceModal();
        await loadAbsencesList();
        showSuccessToast('Solicitação enviada com sucesso!');

    } catch (error) {
        console.error(error);
        alert('Erro ao solicitar ausência');
    } finally {
        window.hideLoading();
    }
};

// Store the ID for approval
let pendingApprovalId = null;

window.approveAbsence = function (id) {
    pendingApprovalId = id;
    document.getElementById('approveConfirmModal').classList.remove('hidden');
};

window.closeApproveModal = function () {
    document.getElementById('approveConfirmModal').classList.add('hidden');
    pendingApprovalId = null;
};

window.confirmApprove = async function () {
    if (!pendingApprovalId) {
        return;
    }

    const approvalId = pendingApprovalId;
    window.closeApproveModal();
    window.showLoading();

    try {
        const response = await window.authenticatedFetch(`/api/rh/absences/${approvalId}/approve`, {
            method: 'PUT'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Absences] Approve failed:', errorText);
            throw new Error('Erro ao aprovar');
        }

        await loadAbsencesList();
        showSuccessToast('Ausência aprovada com sucesso!');

    } catch (error) {
        console.error(error);
        showSuccessToast('Erro ao aprovar ausência');
    } finally {
        window.hideLoading();
        pendingApprovalId = null;
    }
};

// Store the ID for rejection
let pendingRejectionId = null;

window.rejectAbsence = function (id) {
    pendingRejectionId = id;
    document.getElementById('rejectionReasonInput').value = '';
    document.getElementById('rejectModal').classList.remove('hidden');
};

window.closeRejectModal = function () {
    document.getElementById('rejectModal').classList.add('hidden');
    pendingRejectionId = null;
};

window.confirmReject = async function () {
    if (!pendingRejectionId) return;

    const reason = document.getElementById('rejectionReasonInput').value.trim();
    if (!reason) {
        showSuccessToast('Por favor, informe o motivo da rejeição');
        return;
    }

    const rejectionId = pendingRejectionId;
    window.closeRejectModal();
    window.showLoading();

    try {
        const response = await window.authenticatedFetch(`/api/rh/absences/${rejectionId}/reject`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejection_reason: reason })
        });

        if (!response.ok) throw new Error('Erro ao rejeitar');

        await loadAbsencesList();
        showSuccessToast('Ausência rejeitada com sucesso!');

    } catch (error) {
        console.error(error);
        showSuccessToast('Erro ao rejeitar ausência');
    } finally {
        window.hideLoading();
        pendingRejectionId = null;
    }
};

// Helper function to show success toast
function showSuccessToast(message) {
    const toast = document.getElementById('successToast');
    const messageSpan = document.getElementById('successToastMessage');

    messageSpan.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function formatAbsenceType(type) {
    const types = {
        'FERIAS': 'Férias',
        'ATESTADO': 'Atestado Médico',
        'LICENCA_MATERNIDADE': 'Licença Maternidade',
        'LICENCA_PATERNIDADE': 'Licença Paternidade',
        'FOLGA': 'Folga',
        'FALTA_JUSTIFICADA': 'Falta Justificada',
        'FALTA_INJUSTIFICADA': 'Falta Injustificada'
    };
    return types[type] || type;
}

function getAbsenceStatusBadge(status) {
    switch (status) {
        case 'APPROVED': return 'badge-success';
        case 'PENDING': return 'badge-warning';
        case 'REJECTED': return 'badge-danger';
        default: return 'badge-gray';
    }
}

function getAbsenceStatusLabel(status) {
    switch (status) {
        case 'APPROVED': return 'Aprovado';
        case 'PENDING': return 'Pendente';
        case 'REJECTED': return 'Rejeitado';
        default: return status;
    }
}
