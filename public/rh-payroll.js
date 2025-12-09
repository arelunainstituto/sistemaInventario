// RH Payroll Module

const payrollTemplate = `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <!-- Toolbar -->
        <div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4 bg-gray-50">
            <div class="flex gap-2 flex-1">
                <select id="payrollMonthFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todos Meses</option>
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Março</option>
                    <option value="4">Abril</option>
                    <option value="5">Maio</option>
                    <option value="6">Junho</option>
                    <option value="7">Julho</option>
                    <option value="8">Agosto</option>
                    <option value="9">Setembro</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                </select>
                <select id="payrollYearFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todos Anos</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                </select>
            </div>
            <button onclick="openPayrollModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2" data-permission="hr:payroll_process">
                <i class="fas fa-calculator"></i>
                Processar Folha
            </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="w-full rh-table">
                <thead>
                    <tr>
                        <th class="px-6 py-3 text-left">Período</th>
                        <th class="px-6 py-3 text-left">Funcionário</th>
                        <th class="px-6 py-3 text-right">Salário Base</th>
                        <th class="px-6 py-3 text-right">Líquido</th>
                        <th class="px-6 py-3 text-center">Status</th>
                        <th class="px-6 py-3 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody id="payrollTableBody" class="divide-y divide-gray-200 bg-white">
                    <!-- Rows injected by JS -->
                </tbody>
            </table>
        </div>
    </div>

    <!-- Payroll Modal -->
    <div id="payrollModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4">
            <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-800">Processar Folha</h3>
                <button onclick="closePayrollModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <form id="payrollForm" onsubmit="handlePayrollSubmit(event)" class="p-6 space-y-4">
                <div>
                    <label class="form-label">Funcionário *</label>
                    <select name="employee_id" id="payrollEmployeeSelect" required class="form-input">
                        <option value="">Carregando...</option>
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Mês *</label>
                        <select name="period_month" required class="form-input">
                            <option value="1">Janeiro</option>
                            <option value="2">Fevereiro</option>
                            <option value="3">Março</option>
                            <option value="4">Abril</option>
                            <option value="5">Maio</option>
                            <option value="6">Junho</option>
                            <option value="7">Julho</option>
                            <option value="8">Agosto</option>
                            <option value="9">Setembro</option>
                            <option value="10">Outubro</option>
                            <option value="11">Novembro</option>
                            <option value="12">Dezembro</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Ano *</label>
                        <input type="number" name="period_year" value="2025" required class="form-input">
                    </div>
                </div>

                <div>
                    <label class="form-label">Salário Base (€) *</label>
                    <input type="number" name="base_salary" step="0.01" required class="form-input">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Horas Extras (€)</label>
                        <input type="number" name="overtime_value" step="0.01" value="0" class="form-input">
                    </div>
                    <div>
                        <label class="form-label">Bônus (€)</label>
                        <input type="number" name="bonus" step="0.01" value="0" class="form-input">
                    </div>
                </div>

                <div>
                    <label class="form-label">Outros Descontos (€)</label>
                    <input type="number" name="other_discounts" step="0.01" value="0" class="form-input">
                </div>

                <div class="pt-4 border-t border-gray-200 flex justify-end gap-3">
                    <button type="button" onclick="closePayrollModal()" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                    <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">Processar</button>
                </div>
            </form>
        </div>
    </div>
`;

window.loadPayroll = async function () {
    const container = document.getElementById('payroll-tab');
    if (!container.innerHTML.includes('payrollTableBody')) {
        container.innerHTML = payrollTemplate;

        // Listeners
        document.getElementById('payrollMonthFilter').addEventListener('change', loadPayrollList);
        document.getElementById('payrollYearFilter').addEventListener('change', loadPayrollList);
    }

    await loadPayrollList();
};

async function loadPayrollList() {
    window.showLoading();
    try {
        const month = document.getElementById('payrollMonthFilter').value;
        const year = document.getElementById('payrollYearFilter').value;

        const params = new URLSearchParams({ month, year });
        const response = await window.authenticatedFetch(`/api/rh/payroll?${params}`);

        if (!response.ok) throw new Error('Erro ao carregar folha');

        const { data } = await response.json();
        renderPayrollTable(data);

    } catch (error) {
        console.error(error);
        alert('Erro ao carregar folha de pagamento');
    } finally {
        window.hideLoading();
    }
}

function renderPayrollTable(payrolls) {
    const tbody = document.getElementById('payrollTableBody');
    tbody.innerHTML = payrolls.map(p => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 text-sm text-gray-900">
                ${p.period_month}/${p.period_year}
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">${p.rh_employees?.name || 'N/A'}</div>
                <div class="text-xs text-gray-500">${p.rh_employees?.role || ''}</div>
            </td>
            <td class="px-6 py-4 text-right text-sm text-gray-500">
                ${formatCurrency(p.base_salary)}
            </td>
            <td class="px-6 py-4 text-right text-sm font-bold text-gray-900">
                ${formatCurrency(p.net_salary)}
            </td>
            <td class="px-6 py-4 text-center">
                <span class="badge ${p.status === 'FINALIZED' ? 'badge-success' : 'badge-warning'}">
                    ${p.status === 'FINALIZED' ? 'Finalizado' : 'Rascunho'}
                </span>
            </td>
            <td class="px-6 py-4 text-right text-sm font-medium">
                ${p.status === 'DRAFT' ? `
                    <button onclick="finalizePayroll('${p.id}')" class="text-green-600 hover:text-green-900 mr-3" title="Finalizar">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                <button class="text-gray-400 hover:text-gray-600" title="Ver Detalhes">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');

    if (payrolls.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Nenhum registro encontrado</td></tr>`;
    }
}

window.openPayrollModal = async function () {
    const modal = document.getElementById('payrollModal');
    const select = document.getElementById('payrollEmployeeSelect');

    // Load employees for select
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

window.closePayrollModal = function () {
    document.getElementById('payrollModal').classList.add('hidden');
};

window.handlePayrollSubmit = async function (e) {
    e.preventDefault();
    window.showLoading();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await window.authenticatedFetch('/api/rh/payroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Erro ao processar');

        window.closePayrollModal();
        await loadPayrollList();
        alert('Folha processada com sucesso!');

    } catch (error) {
        console.error(error);
        alert('Erro ao processar folha');
    } finally {
        window.hideLoading();
    }
};

window.finalizePayroll = async function (id) {
    if (!confirm('Tem certeza que deseja finalizar esta folha? A ação não pode ser desfeita.')) return;

    window.showLoading();
    try {
        const response = await window.authenticatedFetch(`/api/rh/payroll/${id}/finalize`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Erro ao finalizar');

        await loadPayrollList();
        alert('Folha finalizada com sucesso!');

    } catch (error) {
        console.error(error);
        alert('Erro ao finalizar folha');
    } finally {
        window.hideLoading();
    }
};

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
}
